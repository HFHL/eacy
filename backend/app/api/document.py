import os
import uuid
from flask import Blueprint, request, jsonify, current_app
from ..models.document import Document
from ..extensions import db
from ..utils.auth_utils import get_current_user_id
import oss2

document_bp = Blueprint('document', __name__)


@document_bp.route('/<doc_id>/preview', methods=['GET'])
def preview_document(doc_id):
    """后端代理预览文档（通过 STS 临时凭证绕过 bucket ACL 限制）"""
    from flask import Response
    from alibabacloud_sts20150401.client import Client as StsClient
    from alibabacloud_sts20150401 import models as sts_models
    from alibabacloud_tea_openapi import models as open_api_models

    doc = Document.query.filter_by(id=doc_id, is_deleted=False).first()
    if not doc or not doc.oss_url:
        return jsonify({"success": False, "message": "文档不存在或无 OSS 链接"}), 404

    try:
        access_key_id = os.getenv("OSS_ACCESS_KEY_ID")
        access_key_secret = os.getenv("OSS_ACCESS_KEY_SECRET")
        endpoint = os.getenv("OSS_ENDPOINT")
        bucket_name = os.getenv("OSS_BUCKET_NAME")
        role_arn = os.getenv("OSS_ROLE_ARN")

        # 1. 通过 STS AssumeRole 获取临时凭证
        sts_config = open_api_models.Config(
            access_key_id=access_key_id,
            access_key_secret=access_key_secret,
            endpoint='sts.cn-shanghai.aliyuncs.com'
        )
        sts_client = StsClient(sts_config)
        sts_request = sts_models.AssumeRoleRequest(
            duration_seconds=900,
            role_arn=role_arn,
            role_session_name="eacy-backend-preview"
        )
        sts_response = sts_client.assume_role(sts_request)
        creds = sts_response.body.credentials

        # 2. 用临时凭证构建 OSS 客户端
        auth = oss2.StsAuth(
            creds.access_key_id,
            creds.access_key_secret,
            creds.security_token
        )
        bucket_obj = oss2.Bucket(auth, f'https://{endpoint}', bucket_name)

        # 3. 从 oss_url 提取 object key
        oss_url = doc.oss_url
        if '/' in oss_url and '.' in oss_url.split('/')[0]:
            object_key = oss_url.split('/', 1)[1]
        else:
            object_key = oss_url

        result = bucket_obj.get_object(object_key)

        import urllib.parse
        content_type = doc.mime_type or 'application/octet-stream'
        safe_filename = urllib.parse.quote(doc.filename or "preview")
        return Response(
            result,
            content_type=content_type,
            headers={
                'Cache-Control': 'private, max-age=3600',
                'Content-Disposition': f"inline; filename*=UTF-8''{safe_filename}",
            }
        )
    except Exception as e:
        return jsonify({"success": False, "message": f"预览失败: {str(e)}"}), 500

@document_bp.route('/callback', methods=['POST'])
def register_oss_document():
    """
    接收前端传输完成的 OSS 回调信息，将记录正式落盘并触发解析任务。
    因为真正的物理文件已经由前端直传到了阿里 OSS，这里只负责存 URL 与流转状态。
    """
    data = request.json
    if not data or not data.get('oss_url') or not data.get('filename'):
        return jsonify({"success": False, "message": "缺失文件核心属性 (url/filename)"}), 400
        
    uploader_id = get_current_user_id()
    doc_id = str(uuid.uuid4())
    
    new_doc = Document(
        id=doc_id,
        filename=data.get('filename'),
        oss_url=data.get('oss_url'),
        mime_type=data.get('mime_type', 'application/octet-stream'),
        file_size=data.get('file_size', 0),
        status=Document.STATUS_METADATA_EXTRACTING, # 文件已经传输完毕，直接进入分析状态
        uploader_id=uploader_id
    )
    
    db.session.add(new_doc)
    
    try:
        db.session.commit()
        
        # 抛入 Celery 队列，触发异步 OCR 识别
        from app.tasks.ocr_tasks import ocr_recognize
        ocr_recognize.delay(doc_id, data.get('oss_url'))
        
        return jsonify({
            "success": True, 
            "code": 0, 
            "data": new_doc.to_dict(),
            "message": "文档信息注册成功，已自动加入 OCR 识别队列"
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"落库失败: {str(e)}"}), 500

@document_bp.route('', methods=['GET'], strict_slashes=False)
@document_bp.route('/', methods=['GET'], strict_slashes=False)
def list_documents():
    """获取文档列表以供 Dashboard 查阅（强制按当前登录用户隔离）
    
    支持的 Query 参数：
    - task_status: 按状态筛选，多个用逗号分隔（如 uploaded,parsing,archived）
    - keyword: 按文件名模糊搜索
    """
    user_id = get_current_user_id()
    # === DEBUG ===
    import sys
    auth_hdr = request.headers.get('Authorization', 'MISSING')
    x_uid = request.headers.get('X-User-Id', 'MISSING')
    print(f"[DEBUG list_documents] Authorization={auth_hdr!r}  X-User-Id={x_uid!r}  resolved user_id={user_id}", flush=True, file=sys.stderr)
    # === END DEBUG ===
    
    # 基础查询
    query = Document.query.filter_by(is_deleted=False, uploader_id=user_id)
    
    # 按 task_status 筛选（支持逗号分隔的多值）
    task_status_param = request.args.get('task_status', '').strip()
    if task_status_param:
        statuses = [s.strip() for s in task_status_param.split(',') if s.strip()]
        if statuses:
            query = query.filter(Document.status.in_(statuses))
    
    # 按文件名关键词搜索
    keyword = request.args.get('keyword', '').strip()
    if keyword:
        query = query.filter(Document.filename.ilike(f'%{keyword}%'))
    
    docs = query.order_by(Document.created_at.desc()).all()
    
    from ..models.metadata_result import MetadataResult
    
    # Pre-fetch all metadata for these documents to avoid N+1 problem
    doc_ids = [d.id for d in docs]
    metas = MetadataResult.query.filter(
        MetadataResult.document_id.in_(doc_ids),
        MetadataResult.status == MetadataResult.STATUS_SUCCESS
    ).all() if doc_ids else []
    
    # Group by latest metadata per document
    meta_map = {}
    for m in metas:
        if m.document_id not in meta_map or meta_map[m.document_id].created_at < m.created_at:
            meta_map[m.document_id] = m

    result_data = []
    for d in docs:
        d_dict = d.to_dict()
        d_dict['document_type'] = '' # Default unclassified
        d_dict['patient_id'] = None
        d_dict['patient_name'] = ''
        
        m = meta_map.get(d.id)
        if m and m.result_json:
            js = m.result_json
            # Safely extract from common schema aliases
            dt = ""
            # 优先匹配当前 schema 的标准字段名
            if js.get('文档类型'):
                dt = str(js['文档类型'])
                sub = js.get('文档子类型', '')
                if sub:
                    dt = f"{dt} - {str(sub)}"
            elif js.get('文档分类'):
                # it could be a string or a dict like {"主类型": "检验检查报告", "子类型": "xx"}
                if isinstance(js['文档分类'], dict):
                    dt = js['文档分类'].get('主类型', '')
                    sub = js['文档分类'].get('子类型', '')
                    if sub:
                         dt = f"{dt} - {sub}"
                else:
                    dt = str(js['文档分类'])
            elif js.get('主类型'):
                dt = str(js['主类型'])
                sub = js.get('子类型', '')
                if sub:
                     dt = f"{dt} - {str(sub)}"
            elif js.get('document_type'):
                dt = str(js['document_type'])
            elif js.get('doc_type'):
                dt = str(js['doc_type'])
            elif js.get('类型'):
                dt = str(js['类型'])
            
            d_dict['document_type'] = dt.strip()
            
        result_data.append(d_dict)

    # 为已归档文档附加患者信息，避免前端需要单独查询
    archived_doc_ids = [d['id'] for d in result_data if d.get('status') == 'ARCHIVED']
    if archived_doc_ids:
        from ..models.patient import Patient, PatientDocument
        patient_links = PatientDocument.query.filter(
            PatientDocument.document_id.in_(archived_doc_ids),
            PatientDocument.is_deleted == False
        ).all()
        link_map = {link.document_id: link for link in patient_links}
        patient_ids = list({link.patient_id for link in patient_links})
        patient_name_map = {}
        if patient_ids:
            patients_list = Patient.query.filter(
                Patient.id.in_(patient_ids),
                Patient.is_deleted == False
            ).all()
            for p in patients_list:
                name = (p.metadata_json or {}).get('患者姓名', '')
                patient_name_map[p.id] = name
        for d_dict in result_data:
            if d_dict.get('status') == 'ARCHIVED':
                link = link_map.get(d_dict['id'])
                if link:
                    d_dict['patient_id'] = link.patient_id
                    d_dict['patient_name'] = patient_name_map.get(link.patient_id, '')

    return jsonify({
        "success": True,
        "code": 0,
        "data": result_data
    })

@document_bp.route('/<doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    """软删除指定文档（带有用户鉴权租户隔离）"""
    user_id = get_current_user_id()
    doc = Document.query.filter_by(id=doc_id, uploader_id=user_id).first()
    
    if not doc:
        return jsonify({"success": False, "code": 404, "message": "文件不存在或无权限"}), 404
        
    doc.is_deleted = True
    
    # 级联软删除与该文档关联的病历夹记录 (PatientDocument)
    from ..models.patient import PatientDocument, Patient
    links = PatientDocument.query.filter_by(document_id=doc_id, is_deleted=False).all()
    for link in links:
        link.is_deleted = True
        # 更新该患者的文档计数
        patient = Patient.query.filter_by(id=link.patient_id, is_deleted=False).first()
        if patient:
            # -1 because we just marked it as deleted but haven't committed
            doc_count = PatientDocument.query.filter_by(patient_id=patient.id, is_deleted=False).count()
            patient.document_count = doc_count

    try:
        db.session.commit()
        return jsonify({"success": True, "code": 0, "message": "删除成功"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"删除失败: {str(e)}"}), 500

@document_bp.route('/<doc_id>/ocr', methods=['GET'])
def get_ocr_result(doc_id):
    """获取指定文档的 OCR 识别结果"""
    from ..models.ocr_result import OcrResult
    ocr = OcrResult.query.filter_by(document_id=doc_id, is_deleted=False).order_by(OcrResult.created_at.desc()).first()
    if not ocr:
        return jsonify({"success": False, "message": "暂无 OCR 结果"}), 404
    return jsonify({
        "success": True,
        "code": 0,
        "data": {
            "id": ocr.id,
            "document_id": ocr.document_id,
            "provider": ocr.provider,
            "total_pages": ocr.total_pages,
            "ocr_markdown": ocr.ocr_text,
            "ocr_raw_json": ocr.ocr_raw_json,
            "confidence_avg": ocr.confidence_avg,
            "duration_ms": ocr.duration_ms,
            "status": ocr.status,
            "error_msg": ocr.error_msg,
            "created_at": ocr.created_at.isoformat() if ocr.created_at else None
        }
    })

@document_bp.route('/<doc_id>/reocr', methods=['POST'])
def re_ocr(doc_id):
    """重新触发 OCR 识别（生成独立的新记录）"""
    doc = Document.query.filter_by(id=doc_id, is_deleted=False).first()
    if not doc:
        return jsonify({"success": False, "message": "文档不存在"}), 404
    
    # 重置文档状态
    doc.status = Document.STATUS_METADATA_EXTRACTING
    db.session.commit()
    
    # 重新派发 OCR 任务（会在 ocr_results 中新增一条记录）
    from app.tasks.ocr_tasks import ocr_recognize
    ocr_recognize.delay(doc_id, doc.oss_url)
    
    return jsonify({
        "success": True,
        "code": 0,
        "message": "已重新加入 OCR 识别队列"
    })

@document_bp.route('/<doc_id>/extract-metadata', methods=['POST'])
def extract_metadata_api(doc_id):
    """手动触发元数据抽取"""
    doc = Document.query.filter_by(id=doc_id, is_deleted=False).first()
    if not doc:
        return jsonify({"success": False, "message": "文档不存在"}), 404

    from app.tasks.metadata_tasks import extract_metadata
    task = extract_metadata.delay(doc_id)

    return jsonify({
        "success": True,
        "code": 0,
        "data": {"task_id": task.id},
        "message": "已加入元数据抽取队列"
    })

@document_bp.route('/<doc_id>/metadata', methods=['GET'])
def get_metadata_result(doc_id):
    """获取指定文档最新的元数据抽取结果"""
    from ..models.metadata_result import MetadataResult
    meta = MetadataResult.query.filter_by(
        document_id=doc_id, is_deleted=False
    ).order_by(MetadataResult.created_at.desc()).first()

    if not meta:
        return jsonify({"success": False, "message": "暂无元数据"}), 404

    return jsonify({
        "success": True,
        "code": 0,
        "data": meta.to_dict()
    })

@document_bp.route('/<doc_id>/metadata', methods=['PUT'])
def update_metadata_result(doc_id):
    """手动修改元数据抽取结果"""
    from ..models.metadata_result import MetadataResult
    meta = MetadataResult.query.filter_by(
        document_id=doc_id, is_deleted=False
    ).order_by(MetadataResult.created_at.desc()).first()

    if not meta:
        return jsonify({"success": False, "message": "暂无元数据记录"}), 404

    data = request.json
    if not data or 'result_json' not in data:
        return jsonify({"success": False, "message": "缺少 result_json"}), 400

    try:
        meta.result_json = data['result_json']
        db.session.commit()
        return jsonify({
            "success": True,
            "code": 0,
            "data": meta.to_dict(),
            "message": "元数据已更新"
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"更新失败: {str(e)}"}), 500

@document_bp.route('/<doc_id>/archive', methods=['POST'])
def archive_document(doc_id):
    """归档文档 — 将文档关联到患者病历夹"""
    from ..models.metadata_result import MetadataResult
    from ..models.patient import Patient, PatientDocument

    doc = Document.query.filter_by(id=doc_id, is_deleted=False).first()
    if not doc:
        return jsonify({"success": False, "message": "文档不存在"}), 404

    # 1. 获取最新元数据
    meta = MetadataResult.query.filter_by(
        document_id=doc_id, is_deleted=False
    ).order_by(MetadataResult.created_at.desc()).first()

    if not meta or not meta.result_json:
        return jsonify({"success": False, "message": "请先完成元数据抽取后再归档"}), 400

    result = meta.result_json

    # 2. 提取患者标识符（用于匹配已有患者）
    # 元数据字段使用中文键名
    identifiers = {}
    if result.get('患者姓名'):
        identifiers['患者姓名'] = result['患者姓名']
    if result.get('唯一标识符'):
        # 唯一标识符是数组，取第一个非空值作为主标识
        uid_list = result['唯一标识符']
        if isinstance(uid_list, list) and len(uid_list) > 0:
            identifiers['唯一标识符'] = uid_list[0]
        elif isinstance(uid_list, str):
            identifiers['唯一标识符'] = uid_list

    if not identifiers:
        return jsonify({"success": False, "message": "元数据中缺少患者标识信息（姓名/唯一标识符），无法归档"}), 400

    # 3. 检查是否已归档
    existing_link = PatientDocument.query.filter_by(
        document_id=doc_id, is_deleted=False
    ).first()
    if existing_link:
        return jsonify({
            "success": False,
            "message": "该文档已归档",
            "data": {"patient_id": existing_link.patient_id}
        }), 409

    try:
        # 4. 查找已有患者（按标识符匹配）
        patient = None
        for key, val in identifiers.items():
            candidates = Patient.query.filter(
                Patient.is_deleted == False
            ).all()
            for c in candidates:
                if c.identifiers and c.identifiers.get(key) == val:
                    patient = c
                    break
            if patient:
                break

        # 5. 没找到则创建新患者
        uploader_id = get_current_user_id()
        if not patient:
            patient = Patient(
                metadata_json={k: result.get(k) for k in [
                    '患者姓名', '患者性别', '患者年龄', '出生日期',
                    '唯一标识符', '机构名称', '科室信息', '联系电话'
                ] if result.get(k)},
                identifiers=identifiers,
                document_count=0,
                uploader_id=uploader_id
            )
            db.session.add(patient)
            db.session.flush()

        # 6. 创建关联
        link = PatientDocument(
            patient_id=patient.id,
            document_id=doc_id,
            doc_type=result.get('文档类型'),
            doc_subtype=result.get('文档子类型'),
            doc_title=result.get('文档标题'),
            doc_date=result.get('文档生效日期'),
            source='MANUAL'
        )
        db.session.add(link)

        # 7. 更新计数
        patient.document_count = PatientDocument.query.filter_by(
            patient_id=patient.id, is_deleted=False
        ).count()

        # 8. 更新文档状态
        doc.status = 'ARCHIVED'
        db.session.commit()

        return jsonify({
            "success": True,
            "code": 0,
            "data": {"patient_id": patient.id, "patient_name": identifiers.get('patient_name', '')},
            "message": f"已归档到患者: {identifiers.get('patient_name', patient.id)}"
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"归档失败: {str(e)}"}), 500

@document_bp.route('/<doc_id>/archive-new', methods=['POST'])
def archive_document_new(doc_id):
    """强制使用文档元数据新建患者并归档（跳过标识符匹配）"""
    from ..models.metadata_result import MetadataResult
    from ..models.patient import Patient, PatientDocument

    doc = Document.query.filter_by(id=doc_id, is_deleted=False).first()
    if not doc:
        return jsonify({"success": False, "message": "文档不存在"}), 404

    # 1. 获取最新元数据
    meta = MetadataResult.query.filter_by(
        document_id=doc_id, is_deleted=False
    ).order_by(MetadataResult.created_at.desc()).first()

    if not meta or not meta.result_json:
        return jsonify({"success": False, "message": "请先完成元数据抽取后再建档"}), 400

    result = meta.result_json

    # 2. 提取患者标识（无需再去重匹配，但也要保证有基本信息）
    identifiers = {}
    if result.get('患者姓名'):
        identifiers['患者姓名'] = result['患者姓名']
    if result.get('唯一标识符'):
        uid_list = result['唯一标识符']
        if isinstance(uid_list, list) and len(uid_list) > 0:
            identifiers['唯一标识符'] = uid_list[0]
        elif isinstance(uid_list, str):
            identifiers['唯一标识符'] = uid_list

    if not identifiers:
        return jsonify({"success": False, "message": "元数据中缺少患者标识信息（姓名/唯一标识符），无法建档"}), 400

    # 3. 检查是否已归档
    existing_link = PatientDocument.query.filter_by(
        document_id=doc_id, is_deleted=False
    ).first()
    if existing_link:
        return jsonify({
            "success": False,
            "message": "该文档已归档",
            "data": {"patient_id": existing_link.patient_id}
        }), 409

    try:
        uploader_id = get_current_user_id()
        
        # 4. 强制新建患者
        patient = Patient(
            metadata_json={k: result.get(k) for k in [
                '患者姓名', '患者性别', '患者年龄', '出生日期',
                '唯一标识符', '机构名称', '科室信息', '联系电话'
            ] if result.get(k)},
            identifiers=identifiers,
            document_count=0,
            uploader_id=uploader_id
        )
        db.session.add(patient)
        db.session.flush()

        # 5. 创建关联
        link = PatientDocument(
            patient_id=patient.id,
            document_id=doc_id,
            doc_type=result.get('文档类型'),
            doc_subtype=result.get('文档子类型'),
            doc_title=result.get('文档标题'),
            doc_date=result.get('文档生效日期'),
            source='MANUAL_NEW_PATIENT'
        )
        db.session.add(link)

        # 6. 更新计数和状态
        patient.document_count = PatientDocument.query.filter_by(
            patient_id=patient.id, is_deleted=False
        ).count()

        doc.status = 'ARCHIVED'
        db.session.commit()

        return jsonify({
            "success": True,
            "code": 0,
            "data": {"patient_id": patient.id, "patient_name": identifiers.get('患者姓名', '')},
            "message": f"已新建患者并归档: {identifiers.get('患者姓名', patient.id)}"
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"强制新建建档失败: {str(e)}"}), 500

@document_bp.route('/<doc_id>/trace', methods=['GET'])
def get_extraction_trace(doc_id):
    """获取文档完整的抽取管道溯源数据（支持多种 Stage）"""
    stage = request.args.get('stage', 'METADATA_EXTRACTION')
    
    from ..models.ocr_result import OcrResult
    
    # 获取通用的 OCR 信息
    ocr_data = None
    ocr = OcrResult.query.filter_by(document_id=doc_id, status=OcrResult.STATUS_SUCCESS).order_by(OcrResult.created_at.desc()).first()
    if ocr:
        ocr_data = {
            "ocr_text": ocr.ocr_text,
            "text_length": len(ocr.ocr_text) if ocr.ocr_text else 0,
            "total_pages": ocr.total_pages,
            "confidence_avg": ocr.confidence_avg,
            "provider": ocr.provider,
            "duration_ms": ocr.duration_ms,
        }

    if stage == 'CRF_EXTRACTION':
        from ..models.pipeline_trace import PipelineTrace
        trace = PipelineTrace.query.filter_by(document_id=doc_id, stage='CRF_EXTRACTION').order_by(PipelineTrace.created_at.desc()).first()
        if not trace:
            return jsonify({"success": False, "message": "暂无 CRF 抽取记录"}), 404
        
        payload = trace.llm_payload or {}
            
        return jsonify({
            "success": True,
            "code": 0,
            "data": {
                "id": trace.id,
                "document_id": doc_id,
                "status": trace.status,
                "error_msg": trace.error_msg,
                "duration_ms": trace.duration_ms,
                "created_at": trace.created_at.isoformat() if trace.created_at else None,
                "ocr": ocr_data,
                "routing_result": payload.get("routing_result"),
                "extracted_forms": payload.get("extracted_forms", []),
                "agent_trace": payload.get("agent_trace", []),
                "merge_log": payload.get("merge_log", []),
                "input_prompt": payload.get("input_prompt"),
                "pipeline": payload.get("pipeline"),
                "docs_processed": payload.get("docs_processed", []),
                "matched_documents": payload.get("matched_documents", []),
            }
        })
        
    # 默认走 Metadata 抽取逻辑
    from ..models.metadata_result import MetadataResult
    from ..models.metadata_config import MetadataField, DocTypeCategory, DocTypeSubtype

    meta = MetadataResult.query.filter_by(
        document_id=doc_id, is_deleted=False
    ).order_by(MetadataResult.created_at.desc()).first()
    if not meta:
        return jsonify({"success": False, "message": "暂无抽取记录"}), 404

    # Node 2: Metadata Config snapshot
    fields = MetadataField.query.filter_by(is_active=True).order_by(MetadataField.sort_order).all()
    field_list = [{
        "field_name": f.field_name,
        "field_type": f.field_type,
        "description": f.description,
        "required": f.required,
    } for f in fields]

    categories = DocTypeCategory.query.order_by(DocTypeCategory.sort_order).all()
    cat_list = []
    for cat in categories:
        subtypes = DocTypeSubtype.query.filter_by(category_id=cat.id).order_by(DocTypeSubtype.sort_order).all()
        cat_list.append({
            "name": cat.name,
            "subtypes": [{"name": st.name, "prompt": st.prompt} for st in subtypes]
        })

    # Node 3: LLM Call
    llm_call = {
        "model": meta.llm_model,
        "system_prompt": meta.system_prompt,
        "user_prompt": meta.user_prompt,
        "raw_response": meta.llm_raw_response,
        "prompt_tokens": meta.prompt_tokens,
        "completion_tokens": meta.completion_tokens,
        "duration_ms": meta.duration_ms,
    }

    # Node 4: Extracted Result
    result_data = meta.result_json

    return jsonify({
        "success": True,
        "code": 0,
        "data": {
            "id": meta.id,
            "document_id": doc_id,
            "status": meta.status,
            "created_at": meta.created_at.isoformat() if meta.created_at else None,
            "ocr": ocr_data,
            "config": {"fields": field_list, "categories": cat_list},
            "llm_call": llm_call,
            "result": result_data,
        }
    })

