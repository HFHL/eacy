from flask import Blueprint, jsonify, request
from ..models.patient import Patient, PatientDocument
from ..extensions import db

patient_bp = Blueprint('patient', __name__)

@patient_bp.route('/', methods=['GET'])
def get_patients():
    """获取患者列表（病历夹列表）"""
    page = int(request.args.get('page', 1))
    size = int(request.args.get('size', 10))
    keyword = request.args.get('keyword', '').strip()

    query = Patient.query.filter_by(is_deleted=False)

    if keyword:
        # 支持按姓名或证件号模糊查询（在 JSONB 中查询）
        # 这里用文本匹配简化处理
        query = query.filter(
            Patient.metadata_json.cast(db.String).ilike(f'%{keyword}%')
        )

    pagination = query.order_by(Patient.updated_at.desc()).paginate(
        page=page, per_page=size, error_out=False
    )

    patients = [p.to_dict() for p in pagination.items]

    return jsonify({
        "success": True,
        "code": 0,
        "data": {
            "list": patients,
            "total": pagination.total,
            "page": page,
            "size": size
        }
    })

@patient_bp.route('/<patient_id>', methods=['GET'])
def get_patient_detail(patient_id):
    """获取单个患者详情"""
    patient = Patient.query.filter_by(id=patient_id, is_deleted=False).first()
    if not patient:
        return jsonify({"success": False, "message": "患者不存在"}), 404
        
    return jsonify({
        "success": True,
        "code": 0,
        "data": patient.to_dict()
    })

@patient_bp.route('/<patient_id>/documents', methods=['GET'])
def get_patient_documents(patient_id):
    """获取指定患者名下的归档文档列表"""
    page = int(request.args.get('page', 1))
    size = int(request.args.get('size', 10))

    query = PatientDocument.query.filter_by(
        patient_id=patient_id, is_deleted=False
    )

    pagination = query.order_by(PatientDocument.created_at.desc()).paginate(
        page=page, per_page=size, error_out=False
    )

    docs = []
    from ..models.metadata_result import MetadataResult
    from ..models.document import Document
    for pd in pagination.items:
        pd_dict = pd.to_dict()
        doc = Document.query.filter_by(id=pd.document_id, is_deleted=False).first()
        if not doc:
            continue
            
        # Dynamically fetch classification from MetadataResult to override nulls
        meta = MetadataResult.query.filter_by(document_id=doc.id, status=MetadataResult.STATUS_SUCCESS).order_by(MetadataResult.created_at.desc()).first()
        if meta and meta.result_json:
            js = meta.result_json
            
            # Type Extractor Fallback
            if not pd_dict.get('doc_type') or pd_dict['doc_type'] == '未分类':
                dt = ""
                if js.get('文档分类'):
                    if isinstance(js['文档分类'], dict):
                        dt = js['文档分类'].get('主类型', '')
                        sub = js['文档分类'].get('子类型', '')
                        if sub: dt = f"{dt} - {sub}"
                    else:
                        dt = str(js['文档分类'])
                elif js.get('主类型'):
                    dt = str(js['主类型'])
                    sub = js.get('子类型', '')
                    if sub: dt = f"{dt} - {str(sub)}"
                elif js.get('document_type'):
                    dt = str(js['document_type'])
                elif js.get('doc_type'):
                    dt = str(js['doc_type'])
                elif js.get('类型'):
                    dt = str(js['类型'])
                
                if dt:
                    pd_dict['doc_type'] = dt.strip()

            # Date Extractor Fallback
            if not pd_dict.get('doc_date'):
                date_val = js.get('文档生效日期') or js.get('报告日期') or js.get('检查日期') or js.get('report_date') or js.get('collection_time') or js.get('报告时间')
                if date_val:
                    pd_dict['doc_date'] = str(date_val).strip()
            
        doc_dict = doc.to_dict()
        # Overlay doc_dict on top of pd_dict but ensure id matches the Document ID for the modal
        for k, v in doc_dict.items():
            if k not in pd_dict or not pd_dict[k]:
                pd_dict[k] = v
        pd_dict['patient_document_id'] = pd.id
        pd_dict['id'] = doc.id
        docs.append(pd_dict)

    return jsonify({
        "success": True,
        "code": 0,
        "data": {
            "list": docs,
            "total": pagination.total,
            "page": page,
            "size": size
        }
    })

@patient_bp.route('/<patient_id>', methods=['DELETE'])
def delete_patient(patient_id):
    """软删除患者，同时软删除其所有相关的文档记录及实体文档"""
    patient = Patient.query.filter_by(id=patient_id, is_deleted=False).first()
    if not patient:
        return jsonify({"success": False, "message": "患者不存在或已删除"}), 404

    try:
        # 1. 软删除患者
        patient.is_deleted = True
        
        # 2. 查找并软删除相关的 PatientDocument，收集 Document ID
        links = PatientDocument.query.filter_by(patient_id=patient.id, is_deleted=False).all()
        from ..models.document import Document
        for link in links:
            link.is_deleted = True
            # 3. 软删除实际的 Document
            doc = Document.query.filter_by(id=link.document_id, is_deleted=False).first()
            if doc:
                doc.is_deleted = True
        
        db.session.commit()
        return jsonify({"success": True, "message": "患者及其文档已成功删除"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"删除失败: {str(e)}"}), 500

@patient_bp.route('/<patient_id>/documents/<document_id>', methods=['DELETE'])
def remove_patient_document(patient_id, document_id):
    """从患者病历夹移除文档关联（只软删除关联记录，不删除原始文档和诊断明细）"""
    link = PatientDocument.query.filter_by(patient_id=patient_id, document_id=document_id, is_deleted=False).first()
    if not link:
        return jsonify({"success": False, "message": "该关联不存在"}), 404
        
    try:
        link.is_deleted = True
        
        # 更新该患者的文档计数
        patient = Patient.query.filter_by(id=patient_id, is_deleted=False).first()
        if patient:
            doc_count = PatientDocument.query.filter_by(patient_id=patient.id, is_deleted=False).count()
            patient.document_count = doc_count
            
        db.session.commit()
        return jsonify({"success": True, "message": "文档已从病历夹中移除"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": f"操作失败: {str(e)}"}), 500
