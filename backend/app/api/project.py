"""
科研项目 API
"""
import os
from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models.project import ResearchProject, ProjectPatient
from ..models.patient import Patient, PatientDocument
from ..models.crf_template import CrfTemplate
from ..utils.auth_utils import get_current_user_id
from sqlalchemy import text
from celery import chain
from app.tasks.crf_tasks import extract_crf_from_document

project_bp = Blueprint('project', __name__)


def _parse_form_key(form_key: str):
    """将 'form_name__anchor_value' 拆分为 (form_name, anchor_value)。

    前端传入的 form_name 可能包含 '__' 分隔的锚点后缀：
      - "住院病案首页"           -> ("住院病案首页", None)
      - "血常规检查__2024-01-15" -> ("血常规检查", "2024-01-15")
    """
    if form_key and "__" in form_key:
        idx = form_key.index("__")
        return form_key[:idx], form_key[idx + 2:]
    return form_key, None


def _compute_patient_extraction_status(project_id, patient_id, template_schema=None):
    """
    计算单个患者的抽取进度与完整度。
    返回: { total_docs, success, failed, running, status, completeness }
    """
    from ..models.pipeline_trace import PipelineTrace
    from ..services.crf_assembler import compute_extraction_status
    
    docs = PatientDocument.query.filter_by(patient_id=patient_id, is_deleted=False).all()
    doc_ids = [d.document_id for d in docs]
    total_docs = len(doc_ids)
    
    if total_docs == 0:
        return {
            "total_docs": 0, "success": 0, "failed": 0, "running": 0,
            "status": "pending", "completeness": 0
        }
    
    success_count = 0
    failed_count = 0
    running_count = 0
    
    for doc_id in doc_ids:
        trace = PipelineTrace.query.filter_by(
            document_id=doc_id, stage='CRF_EXTRACTION'
        ).order_by(PipelineTrace.created_at.desc()).first()
        
        if not trace:
            continue
        elif trace.status == 'SUCCESS':
            success_count += 1
        elif trace.status == 'FAILED':
            failed_count += 1
        else:
            running_count += 1
    
    traced_count = success_count + failed_count + running_count
    if traced_count == 0:
        status = "pending"
    elif running_count > 0:
        status = "extracting"
    elif success_count == total_docs:
        status = "done"
    elif failed_count == total_docs:
        status = "error"
    elif success_count > 0:
        status = "partial"
    else:
        status = "pending"
    
    # CRF 填报完整度 — 从 CrfFieldExtraction 表统计
    completeness = 0
    if template_schema:
        stats = compute_extraction_status(project_id, patient_id, template_schema)
        completeness = round(stats["progress"] * 100)
    
    return {
        "total_docs": total_docs,
        "success": success_count,
        "failed": failed_count,
        "running": running_count,
        "status": status,
        "completeness": completeness,
        "doc_ids": doc_ids
    }


@project_bp.route('/', methods=['GET'])
def list_projects():
    """获取项目列表（按当前登录用户隔离）"""
    user_id = get_current_user_id()
    projects = ResearchProject.query.filter_by(
        is_deleted=False, creator_id=user_id
    ).order_by(ResearchProject.created_at.desc()).all()

    result = []
    for p in projects:
        d = p.to_dict()
        # 附带入组患者数
        d['patient_count'] = ProjectPatient.query.filter_by(project_id=p.id, is_deleted=False).count()
        result.append(d)

    return jsonify({"success": True, "data": result})


@project_bp.route('/', methods=['POST'])
def create_project():
    """创建项目"""
    data = request.get_json()
    if not data or not data.get('project_name'):
        return jsonify({"success": False, "message": "项目名称不能为空"}), 400

    # 从请求头获取当前用户
    creator_id_raw = request.headers.get('X-User-Id') or data.get('creator_id')
    creator_id = int(creator_id_raw) if creator_id_raw else None

    # 同一用户下项目不允许重名
    existing = ResearchProject.query.filter_by(
        project_name=data['project_name'],
        creator_id=creator_id,
        is_deleted=False
    ).first()
    if existing:
        return jsonify({"success": False, "message": "该项目名称已存在，请使用其他名称"}), 400

    project = ResearchProject(
        project_name=data['project_name'],
        description=data.get('description'),
        creator_id=creator_id,
        start_date=datetime.strptime(data['start_date'], '%Y-%m-%d').date() if data.get('start_date') else None,
        end_date=datetime.strptime(data['end_date'], '%Y-%m-%d').date() if data.get('end_date') else None,
        crf_template_id=data.get('crf_template_id'),
    )
    db.session.add(project)
    db.session.commit()

    return jsonify({"success": True, "data": project.to_dict()}), 201


@project_bp.route('/<project_id>', methods=['GET'])
def get_project(project_id):
    """获取项目详情"""
    project = ResearchProject.query.get(project_id)
    if not project or project.is_deleted:
        return jsonify({"success": False, "message": "项目不存在"}), 404

    d = project.to_dict()
    d['patient_count'] = ProjectPatient.query.filter_by(project_id=project.id, is_deleted=False).count()
    
    # 附加 crf_template_schema 提供前端生成穿透视图使用
    if project.crf_template_id:
        template = CrfTemplate.query.get(project.crf_template_id)
        if template:
            d['crf_template_schema'] = template.schema_json

    return jsonify({"success": True, "data": d})


@project_bp.route('/<project_id>', methods=['PUT'])
def update_project(project_id):
    """更新项目"""
    project = ResearchProject.query.get(project_id)
    if not project or project.is_deleted:
        return jsonify({"success": False, "message": "项目不存在"}), 404

    data = request.get_json()
    for field in ['project_name', 'description', 'status', 'crf_template_id', 'crf_template_version_id']:
        if field in data:
            setattr(project, field, data[field])

    if 'start_date' in data:
        project.start_date = datetime.strptime(data['start_date'], '%Y-%m-%d').date() if data['start_date'] else None
    if 'end_date' in data:
        project.end_date = datetime.strptime(data['end_date'], '%Y-%m-%d').date() if data['end_date'] else None

    db.session.commit()
    return jsonify({"success": True, "data": project.to_dict()})


@project_bp.route('/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    """软删除项目"""
    project = ResearchProject.query.get(project_id)
    if not project or project.is_deleted:
        return jsonify({"success": False, "message": "项目不存在"}), 404

    project.is_deleted = True
    db.session.commit()
    return jsonify({"success": True, "message": "已删除"})


@project_bp.route('/<project_id>/patients', methods=['GET'])
def get_project_patients(project_id):
    """获取项目的受试者列表"""
    page = int(request.args.get('page', 1))
    size = int(request.args.get('size', 10))
    keyword = request.args.get('keyword', '').strip()

    # Query ProjectPatient joined with Patient
    query = db.session.query(ProjectPatient, Patient).join(
        Patient, ProjectPatient.patient_id == Patient.id
    ).filter(
        ProjectPatient.project_id == project_id,
        ProjectPatient.is_deleted == False,
        Patient.is_deleted == False
    )

    if keyword:
        query = query.filter(Patient.metadata_json.cast(db.String).ilike(f'%{keyword}%'))

    pagination = query.order_by(ProjectPatient.created_at.desc()).paginate(
        page=page, per_page=size, error_out=False
    )

    # 预加载 CRF 模版 schema
    proj = ResearchProject.query.get(project_id)
    template_schema = None
    if proj and proj.crf_template_id:
        template = CrfTemplate.query.get(proj.crf_template_id)
        template_schema = template.schema_json if template else None

    result = []
    for pp, p in pagination.items:
        # Merge project_patient data with patient metadata
        p_dict = p.to_dict()
        meta = p_dict.get('metadata_json') or {}
        
        # 计算真实抽取状态
        ext_status = _compute_patient_extraction_status(
            project_id, p.id, template_schema
        )
        
        from ..services.crf_assembler import assemble_crf_view_light
        crf_data_light = assemble_crf_view_light(project_id, p.id, template_schema)

        item = {
            "id": p.id,
            "project_patient_id": pp.id,
            "patient_code": meta.get('患者编号', ''),
            "name": meta.get('患者姓名', ''),
            "gender": meta.get('患者性别', ''),
            "age": meta.get('患者年龄', ''),
            "diagnosis": meta.get('临床诊断', []),
            "extractionStatus": ext_status["status"],
            "completeness": ext_status["completeness"],
            "total_docs": ext_status["total_docs"],
            "success_docs": ext_status["success"],
            "failed_docs": ext_status["failed"],
            "running_docs": ext_status["running"],
            "document_ids": ext_status.get("doc_ids", []),
            "enrollment_date": pp.created_at.strftime('%Y-%m-%d') if pp.created_at else '',
            "crf_data": crf_data_light
        }
        result.append(item)

    return jsonify({
        "success": True, 
        "data": {
            "list": result,
            "total": pagination.total,
            "page": page,
            "size": size
        }
    })


@project_bp.route('/<project_id>/patients/<patient_id>/crf-field', methods=['GET'])
def get_crf_field_detail(project_id, patient_id):
    """获取提取结果中的某一个字段详情的完整拆分 JSON"""
    form_name = request.args.get('form', '')
    field_name = request.args.get('field', '')

    pp = ProjectPatient.query.filter_by(
        project_id=project_id, patient_id=patient_id, is_deleted=False
    ).first()

    if not pp:
        return jsonify({"success": False, "message": "受试者不存在"}), 404

    # 加载 CRF 模版 schema
    proj = ResearchProject.query.get(project_id)
    tmpl_schema = None
    if proj and proj.crf_template_id:
        tmpl = CrfTemplate.query.get(proj.crf_template_id)
        tmpl_schema = tmpl.schema_json if tmpl else None
    
    from ..services.crf_assembler import assemble_crf_view
    crf = assemble_crf_view(project_id, patient_id, tmpl_schema)
    val = crf.get(form_name, {}).get(field_name)

    return jsonify({"success": True, "data": val})

@project_bp.route('/<project_id>/patients/<patient_id>/crf-field', methods=['PUT'])
def update_patient_crf_field(project_id, patient_id):
    """更新提取结果中的某一个字段值（采纳历史值）。form 支持 '表单名' 或 '表单名__锚点值'。"""
    data = request.get_json() or {}
    form_key = data.get('form')
    field_name = data.get('field')
    new_value = data.get('value')
    source_blocks = data.get('source_blocks', [])

    if not form_key or not field_name:
        return jsonify({"success": False, "message": "缺少必要的参数"}), 400

    form_name, anchor_value = _parse_form_key(form_key)

    pp = ProjectPatient.query.filter_by(
        project_id=project_id, patient_id=patient_id, is_deleted=False
    ).first()

    if not pp:
        return jsonify({"success": False, "message": "受试者不存在"}), 404

    from ..models.crf_field_extraction import CrfFieldExtraction
    
    # 将同一 anchor 实例中该字段的 adopted 记录取消
    CrfFieldExtraction.query.filter_by(
        project_id=project_id, patient_id=patient_id,
        form_name=form_name, field_name=field_name,
        anchor_value=anchor_value, is_adopted=True
    ).update({"is_adopted": False})
    
    doc_id = data.get('document_id')
    if not doc_id:
        doc_id = None
        
    # 写入一条新的 adopted 记录
    record = CrfFieldExtraction(
        project_id=project_id,
        patient_id=patient_id,
        document_id=doc_id,
        form_name=form_name,
        field_name=field_name,
        anchor_value=anchor_value,
        extracted_value=new_value,
        source_blocks=source_blocks,
        merge_action='adopted',
        is_adopted=True,
    )
    db.session.add(record)
    db.session.commit()
    
    return jsonify({
        "success": True, 
        "message": "已成功采用该值", 
        "data": {"value": new_value, "source_blocks": source_blocks}
    })


@project_bp.route('/<project_id>/patients/<patient_id>/crf-form/save', methods=['POST'])
def save_patient_crf_form(project_id, patient_id):
    """保存整个表单的手动修改。form_name 支持 '表单名' 或 '表单名__锚点值' 格式。"""
    data = request.get_json() or {}
    form_key = data.get('form_name')
    form_data = data.get('data', {})

    if not form_key or not isinstance(form_data, dict):
        return jsonify({"success": False, "message": "参数错误"}), 400

    # 解析 form_name 和 anchor_value
    form_name, anchor_value = _parse_form_key(form_key)

    pp = ProjectPatient.query.filter_by(
        project_id=project_id, patient_id=patient_id, is_deleted=False
    ).first()

    if not pp:
        return jsonify({"success": False, "message": "受试者不存在"}), 404

    from ..models.crf_field_extraction import CrfFieldExtraction

    try:
        # 1. 查出当前 adopted 记录（限定在同一 anchor 实例内）
        q = CrfFieldExtraction.query.filter_by(
            project_id=project_id, patient_id=patient_id,
            form_name=form_name, is_adopted=True,
            anchor_value=anchor_value
        )
        existing_adopted = q.all()
        existing_map = {r.field_name: r for r in existing_adopted}

        new_records = []
        unchanged_fields = set()

        for field_name, field_dict in form_data.items():
            if isinstance(field_dict, dict) and "value" in field_dict:
                val = field_dict["value"]
                source_blocks = field_dict.get("source_blocks", [])
            else:
                val = field_dict
                source_blocks = []

            # 对比已有 adopted 值，判断是否有实际改动
            existing = existing_map.get(field_name)
            if existing:
                old_val = existing.extracted_value
                if str(old_val).strip() == str(val).strip():
                    unchanged_fields.add(field_name)
                    continue  # 值未变，不产生新记录

            # 从 source_blocks 获取 document_id (如果有)
            doc_id = None
            if source_blocks and isinstance(source_blocks, list) and len(source_blocks) > 0 and isinstance(source_blocks[0], dict):
                doc_id = source_blocks[0].get("document_id")

            rec = CrfFieldExtraction(
                project_id=project_id,
                patient_id=patient_id,
                document_id=doc_id,
                form_name=form_name,
                field_name=field_name,
                anchor_value=anchor_value,
                extracted_value=val,
                source_blocks=[],  # 手动修改不需要溯源
                merge_action='manual',
                is_adopted=True,
            )
            new_records.append(rec)

        # 把被修改的字段的旧 adopted 记录取消 adopted 标记
        if new_records:
            changed_field_names = [r.field_name for r in new_records]
            for r in existing_adopted:
                if r.field_name in changed_field_names:
                    r.is_adopted = False
            db.session.add_all(new_records)

        db.session.commit()
        return jsonify({"success": True, "message": "表单保存成功", "changed_fields": len(new_records)})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500


@project_bp.route('/<project_id>/patients/<patient_id>/crf-form/upload-extract', methods=['POST'])
def upload_extract_patient_crf_form(project_id, patient_id):
    """
    专门针对单个表单上传文档并串行触发抽取：
    上传文档 -> OCR -> 元数据 -> 指定表单强制靶向抽取
    """
    data = request.get_json() or {}
    form_name = data.get('form_name')
    oss_url = data.get('oss_url')
    filename = data.get('filename')
    
    if not form_name or not oss_url or not filename:
        return jsonify({"success": False, "code": 400, "message": "缺少必要参数(form_name/oss_url/filename)"}), 400

    pp = ProjectPatient.query.filter_by(
        project_id=project_id, patient_id=patient_id, is_deleted=False
    ).first()
    if not pp:
        return jsonify({"success": False, "message": "项目内未找到该受试者"}), 404

    import uuid
    from ..models.document import Document
    from ..models.patient import PatientDocument

    uploader_id = int(request.headers.get("X-User-Id", 1))
    doc_id = str(uuid.uuid4())
    
    # 1. 创建文档记录
    new_doc = Document(
        id=doc_id,
        filename=filename,
        oss_url=oss_url,
        mime_type=data.get('mime_type', 'application/octet-stream'),
        file_size=data.get('file_size', 0),
        status=Document.STATUS_METADATA_EXTRACTING,
        uploader_id=uploader_id
    )
    db.session.add(new_doc)
    
    # 2. 强行归档给该患者（PatientDocument）
    link = PatientDocument(
        patient_id=patient_id,
        document_id=doc_id,
        doc_type="未分类(表单直传)",
        doc_subtype="",
        doc_title=filename,
        source='MANUAL'
    )
    db.session.add(link)
    
    try:
        db.session.commit()
        
        # 更新受试者文档计数（冗余字段更新）
        from ..models.patient import Patient
        p = Patient.query.get(patient_id)
        if p:
            p.document_count = PatientDocument.query.filter_by(patient_id=patient_id, is_deleted=False).count()
            db.session.commit()
            
        # 3. 触发 OCR，并通过 trigger_form_extract 实现链式传递
        from app.tasks.ocr_tasks import ocr_recognize
        ocr_recognize.delay(
            doc_id, 
            oss_url, 
            trigger_form_extract={
                "project_id": project_id,
                "patient_id": patient_id,
                "form_name": form_name
            }
        )
        
        return jsonify({
            "success": True, 
            "code": 0, 
            "data": {"document_id": doc_id},
            "message": "已成功加入抽取队列"
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"创建文档失败: {str(e)}"}), 500

@project_bp.route('/<project_id>/patients/<patient_id>/crf-form/extract-from-doc', methods=['POST'])
def extract_from_existing_doc(project_id, patient_id):
    """
    从患者已有文档中选取一份，直接触发指定表单的 CRF 靶向抽取。
    跳过 OCR / 元数据阶段（文档已有 OCR 结果）。
    """
    data = request.get_json() or {}
    form_name = data.get('form_name')
    document_id = data.get('document_id')

    if not form_name or not document_id:
        return jsonify({"success": False, "code": 400, "message": "缺少必要参数(form_name/document_id)"}), 400

    pp = ProjectPatient.query.filter_by(
        project_id=project_id, patient_id=patient_id, is_deleted=False
    ).first()
    if not pp:
        return jsonify({"success": False, "message": "项目内未找到该受试者"}), 404

    # 验证文档存在且已完成 OCR
    from ..models.document import Document
    from ..models.ocr_result import OcrResult

    doc = Document.query.get(document_id)
    if not doc:
        return jsonify({"success": False, "message": "文档不存在"}), 404

    ocr = OcrResult.query.filter_by(
        document_id=document_id, status=OcrResult.STATUS_SUCCESS
    ).first()
    if not ocr:
        return jsonify({"success": False, "message": "该文档尚未完成 OCR 识别，无法进行 CRF 抽取"}), 400

    # 构建 documents_meta
    from ..models.patient import PatientDocument
    pd = PatientDocument.query.filter_by(document_id=document_id, is_deleted=False).first()
    documents_meta = [{
        "doc_id": document_id,
        "title": pd.doc_title if pd else (doc.filename or "文档"),
        "type": pd.doc_type if pd else "未分类",
        "subtype": pd.doc_subtype if pd else "",
        "filename": doc.filename or "",
    }]

    try:
        from app.tasks.crf_tasks import extract_crf_by_form
        extract_crf_by_form.delay(
            project_id=project_id,
            patient_id=patient_id,
            form_name=form_name,
            documents_meta=documents_meta,
            target_document_ids=[document_id]
        )

        return jsonify({
            "success": True,
            "code": 0,
            "data": {"document_id": document_id},
            "message": f"已触发 {form_name} 表单靶向抽取"
        })
    except Exception as e:
        return jsonify({"success": False, "message": f"触发抽取失败: {str(e)}"}), 500

@project_bp.route('/<project_id>/extraction-status', methods=['GET'])
def get_extraction_status(project_id):
    """获取项目抽取进度总览（轮询用）"""
    proj = ResearchProject.query.get(project_id)
    if not proj or proj.is_deleted:
        return jsonify({"success": False, "message": "项目不存在"}), 404

    template_schema = None
    if proj.crf_template_id:
        template = CrfTemplate.query.get(proj.crf_template_id)
        template_schema = template.schema_json if template else None

    project_patients = ProjectPatient.query.filter_by(
        project_id=project_id, is_deleted=False
    ).all()

    patients_status = []
    total_patients = len(project_patients)
    completed_count = 0
    extracting_count = 0
    error_count = 0
    total_completeness = 0

    for pp in project_patients:
        ext = _compute_patient_extraction_status(
            project_id, pp.patient_id, template_schema
        )
        patients_status.append({
            "patient_id": pp.patient_id,
            "project_patient_id": pp.id,
            **ext
        })
        if ext["status"] == "done":
            completed_count += 1
        elif ext["status"] == "extracting":
            extracting_count += 1
        elif ext["status"] in ("error", "partial"):
            error_count += 1
        total_completeness += ext["completeness"]

    avg_completeness = round(total_completeness / total_patients) if total_patients > 0 else 0

    return jsonify({
        "success": True,
        "data": {
            "project_id": project_id,
            "total_patients": total_patients,
            "completed": completed_count,
            "extracting": extracting_count,
            "error": error_count,
            "pending": total_patients - completed_count - extracting_count - error_count,
            "avg_completeness": avg_completeness,
            "patients": patients_status
        }
    })


@project_bp.route('/<project_id>/patients/<patient_id>/crf-detail', methods=['GET'])
def get_patient_crf_detail(project_id, patient_id):
    """获取患者 CRF 抽取详情 — 3 面板页面所需全部数据"""
    from ..models.pipeline_trace import PipelineTrace
    from ..models.document import Document
    
    proj = ResearchProject.query.get(project_id)
    if not proj or proj.is_deleted:
        return jsonify({"success": False, "message": "项目不存在"}), 404
    
    pp = ProjectPatient.query.filter_by(
        project_id=project_id, patient_id=patient_id, is_deleted=False
    ).first()
    if not pp:
        return jsonify({"success": False, "message": "患者未加入此项目"}), 404
    
    # Template schema
    template_schema = {}
    if proj.crf_template_id:
        tpl = CrfTemplate.query.get(proj.crf_template_id)
        if tpl:
            template_schema = tpl.schema_json or {}
    
    # Patient metadata
    patient = Patient.query.get(patient_id)
    patient_meta = patient.to_dict().get('metadata_json', {}) if patient else {}
    
    # Documents + traces
    docs = PatientDocument.query.filter_by(patient_id=patient_id, is_deleted=False).all()
    
    # Pre-fetch Document records to get oss_url
    doc_ids = [d.document_id for d in docs]
    base_docs = {d.id: d for d in Document.query.filter(Document.id.in_(doc_ids)).all()} if doc_ids else {}
    
    doc_traces = []
    for d in docs:
        trace = PipelineTrace.query.filter_by(
            document_id=d.document_id, stage='CRF_EXTRACTION'
        ).order_by(PipelineTrace.created_at.desc()).first()
        
        trace_info = None
        if trace:
            payload = trace.llm_payload or {}
            
            trace_info = {
                "status": trace.status,
                "duration_ms": trace.duration_ms,
                "created_at": trace.created_at.strftime('%Y-%m-%d %H:%M:%S') if trace.created_at else '',
            }
        
        from app.models.ocr_result import OcrResult
        ocr = OcrResult.query.filter_by(document_id=d.document_id, status='SUCCESS').order_by(OcrResult.created_at.desc()).first()
        ocr_page_sizes = {}
        if ocr and ocr.ocr_raw_json:
            metrics = ocr.ocr_raw_json.get('metrics', [])
            if metrics and isinstance(metrics, list):
                for m in metrics:
                    pid = m.get('page_id', 1)
                    w = m.get('page_image_width')
                    h = m.get('page_image_height')
                    if w:
                        ocr_page_sizes[str(pid)] = {'w': w, 'h': h}
                
        base_doc = base_docs.get(d.document_id)
        doc_traces.append({
            "document_id": d.document_id,
            "file_name": d.doc_title or d.doc_type or (base_doc.filename if base_doc else '') or '',
            "original_filename": base_doc.filename if base_doc else '',
            "mime_type": base_doc.mime_type if base_doc else '',
            "doc_type": d.doc_type or '',
            "doc_subtype": d.doc_subtype or '',
            "doc_date": d.doc_date or '',
            "oss_url": base_doc.oss_url if base_doc else '',
            "trace": trace_info,
            "ocr_page_sizes": ocr_page_sizes,
        })
    
    from ..services.crf_assembler import assemble_crf_view_light
    crf_light_full = assemble_crf_view_light(project_id, patient_id, template_schema)
    anchor_meta = crf_light_full.pop("_anchor_meta", {})
    crf_data_light = crf_light_full
    
    return jsonify({
        "success": True,
        "data": {
            "patient_id": patient_id,
            "project_patient_id": pp.id,
            "patient_meta": patient_meta,
            "crf_data": crf_data_light,
            "anchor_meta": anchor_meta,
            "template_schema": template_schema,
            "documents": doc_traces,
            "enrollment_date": pp.created_at.strftime('%Y-%m-%d') if pp.created_at else '',
        }
    })


@project_bp.route('/<project_id>/patients/<patient_id>/crf-form', methods=['GET'])
def get_patient_crf_form(project_id, patient_id):
    """获取患者特定表单的完整 JSON（含 source_blocks）。
    
    form 参数支持 "表单名" 或 "表单名__锚点值" 两种格式。
    """
    form_key = request.args.get('form', '')
    
    proj = ResearchProject.query.get(project_id)
    tmpl_schema = None
    if proj and proj.crf_template_id:
        tmpl = CrfTemplate.query.get(proj.crf_template_id)
        tmpl_schema = tmpl.schema_json if tmpl else None
    
    from ..services.crf_assembler import assemble_crf_view
    crf = assemble_crf_view(project_id, patient_id, tmpl_schema)
    crf.pop("_anchor_meta", None)
        
    return jsonify({
        "success": True, 
        "data": crf.get(form_key, {})
    })
@project_bp.route('/<project_id>/patients/<patient_id>/crf-field-history', methods=['GET'])
def get_patient_crf_field_history(project_id, patient_id):
    """获取患者某一个具体字段的历史溯源轨迹"""
    form_name = request.args.get('form', '')
    field_name = request.args.get('field', '')
    
    from ..models.crf_field_extraction import CrfFieldExtraction
    
    # 优先从新的字段级历史表查询
    records = CrfFieldExtraction.query.filter_by(
        project_id=project_id,
        patient_id=patient_id,
        form_name=form_name,
        field_name=field_name
    ).order_by(CrfFieldExtraction.created_at.desc()).all()
    
    if records:
        return jsonify({"success": True, "data": [r.to_dict() for r in records]})
    
    # 向后兼容：如果新表没有数据（迁移前的旧数据），从 PipelineTrace 考古
    from ..models.patient import PatientDocument
    from ..models.pipeline_trace import PipelineTrace
    
    docs = PatientDocument.query.filter_by(patient_id=patient_id, is_deleted=False).all()
    
    history_data = []
    for d in docs:
        trace = PipelineTrace.query.filter_by(
            document_id=d.document_id, stage='CRF_EXTRACTION'
        ).order_by(PipelineTrace.created_at.desc()).first()
        
        if trace:
            payload = trace.llm_payload or {}
            
            field_data = None
            for at in payload.get("agent_trace", []):
                if at.get("form_name") == form_name and at.get("parsed_output"):
                    field_data = at["parsed_output"].get(field_name)
                    break
            
            log_entry = None
            for l in payload.get("merge_log", []):
                if l.get("form") == form_name and l.get("field") == field_name:
                    log_entry = l
                    break
                    
            if field_data or log_entry:
                history_data.append({
                    "document_id": d.document_id,
                    "field_data": field_data,
                    "log_entry": log_entry,
                    "trace_created_at": trace.created_at.strftime('%Y-%m-%d %H:%M:%S') if trace.created_at else ''
                })
                
    return jsonify({"success": True, "data": history_data, "_legacy": True})

@project_bp.route('/<project_id>/patients', methods=['POST'])
def add_project_patients(project_id):
    """批量添加入组受试者"""
    data = request.get_json()
    patient_ids = data.get('patient_ids', [])
    if not patient_ids:
        return jsonify({"success": False, "message": "未提供要添加的患者 ID 列表"}), 400

    project = ResearchProject.query.get(project_id)
    if not project or project.is_deleted:
        return jsonify({"success": False, "message": "项目不存在"}), 404

    try:
        added_count = 0
        for pid in patient_ids:
            existing = ProjectPatient.query.filter_by(project_id=project_id, patient_id=pid).first()
            if not existing:
                pp = ProjectPatient(project_id=project_id, patient_id=pid)
                db.session.add(pp)
                added_count += 1
            elif existing.is_deleted:
                existing.is_deleted = False
                added_count += 1
        db.session.commit()
        return jsonify({"success": True, "message": f"成功添加入组 {added_count} 名患者"}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@project_bp.route('/<project_id>/patients', methods=['DELETE'])
def remove_project_patients(project_id):
    """批量移除项目中已入组的患者"""
    data = request.get_json(silent=True) or {}
    patient_ids = data.get('patient_ids', [])
    if not patient_ids:
        return jsonify({"success": False, "message": "未提供要移除的患者 ID 列表"}), 400

    project = ResearchProject.query.get(project_id)
    if not project or project.is_deleted:
        return jsonify({"success": False, "message": "项目不存在"}), 404

    try:
        removed_count = 0
        pps = ProjectPatient.query.filter(
            ProjectPatient.project_id == project_id,
            ProjectPatient.patient_id.in_(patient_ids),
            ProjectPatient.is_deleted == False
        ).all()
        for pp in pps:
            pp.is_deleted = True
            removed_count += 1
        db.session.commit()
        return jsonify({"success": True, "message": f"成功移除 {removed_count} 名受试者"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@project_bp.route('/<string:project_id>/extract', methods=['POST'])
def trigger_batch_extraction(project_id):
    """
    触发项目中患者的 CRF 批量智能抽取（Form-Centric 管道）。
    
    新管道: 遍历每张表单 → LLM 匹配候选文档 → 按表单并行抽取
    """
    data = request.get_json(silent=True) or {}
    patient_ids = data.get('patient_ids', [])
    force = data.get('force', False) or request.args.get('force', '').lower() == 'true'

    proj = ResearchProject.query.get(project_id)
    if not proj:
        return jsonify({"error": "Project not found"}), 404
        
    if not proj.crf_template_id:
        return jsonify({"error": "Project must bind a CRF Template before extraction."}), 400

    template = CrfTemplate.query.get(proj.crf_template_id)
    if not template or not template.schema_json:
        return jsonify({"error": "CRF Template schema is empty."}), 400

    schema_json = template.schema_json

    query = ProjectPatient.query.filter_by(project_id=project_id)
    if patient_ids:
        query = query.filter(ProjectPatient.patient_id.in_(patient_ids))
    
    project_patients = query.all()
    if not project_patients:
        return jsonify({"message": "No specific patients found to extract"}), 200

    dispatched_count = 0
    form_task_count = 0

    from ..models.pipeline_trace import PipelineTrace
    from app.tasks.crf_tasks import extract_crf_by_form
    from app.services.form_document_matcher import match_documents_for_form, determine_topK
    from app.models.document import Document

    # 解析所有表单
    all_forms = []
    for cat in schema_json.get("categories", []):
        for form in cat.get("forms", []):
            all_forms.append(form)

    for pp in project_patients:
        # 获取该患者名下所有文档及元数据
        docs = PatientDocument.query.filter_by(
            patient_id=pp.patient_id, 
            is_deleted=False
        ).order_by(
            PatientDocument.doc_date.asc().nulls_last(),
            PatientDocument.created_at.asc()
        ).all()
        
        if not docs:
            continue

        # 构建文档元数据列表（用于 LLM 匹配）
        documents_meta = []
        for d in docs:
            doc_record = Document.query.get(d.document_id)
            documents_meta.append({
                "doc_id": d.document_id,
                "title": d.doc_title or (doc_record.filename if doc_record else "未知"),
                "type": d.doc_type or "未分类",
                "subtype": d.doc_subtype or "",
                "filename": doc_record.filename if doc_record else "",
            })

        if force:
            # force 模式：清理旧 trace 和 extraction 记录
            old_traces = PipelineTrace.query.filter_by(
                project_id=project_id, patient_id=pp.patient_id, stage='CRF_EXTRACTION'
            ).all()
            for ot in old_traces:
                db.session.delete(ot)
            from ..models.crf_field_extraction import CrfFieldExtraction
            CrfFieldExtraction.query.filter_by(
                project_id=project_id, patient_id=pp.patient_id
            ).delete()
            db.session.commit()

        # 对每张表单：LLM 匹配文档 → 下发 Celery task
        from celery import group as celery_group
        task_signatures = []
        
        for form_schema in all_forms:
            form_name = form_schema.get("name", "")
            if not form_name:
                continue

            # 跳过已有 SUCCESS trace 的表单（除非 force）
            if not force:
                existing_success = PipelineTrace.query.filter_by(
                    project_id=project_id, patient_id=pp.patient_id,
                    stage='CRF_EXTRACTION', status='SUCCESS',
                    document_name=f"表单抽取: {form_name}"
                ).first()
                if existing_success:
                    continue

            # 预先创建 PENDING 状态的 Trace 以供前端立即显示排队状态
            # document_id 在这里还未匹配，使用占位符 "" 以满足数据库 NOT NULL 约束
            new_trace = PipelineTrace(
                document_id="",
                document_name=f"表单抽取: {form_name}",
                project_id=project_id,
                patient_id=pp.patient_id,
                stage='CRF_EXTRACTION',
                status='PENDING'
            )
            db.session.add(new_trace)

            task_signatures.append(
                extract_crf_by_form.si(project_id, pp.patient_id, form_name, documents_meta)
            )
            form_task_count += 1
        
        if not task_signatures:
            continue
            
        # 集中提交当前患者的所有预排队 Trace
        db.session.commit()
            
        # 按表单并行下发
        if len(task_signatures) == 1:
            task_signatures[0].apply_async()
        else:
            celery_group(task_signatures).apply_async()
            
        dispatched_count += 1

    return jsonify({
        "status": "success",
        "message": f"已下发 {dispatched_count} 个患者、共 {form_task_count} 个表单抽取任务",
        "dispatched_patients": dispatched_count,
        "form_tasks": form_task_count,
        "force": force,
        "pipeline": "form_centric",
    })
