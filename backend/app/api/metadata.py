"""
元数据配置管理 API — CRUD for metadata_fields, doc_type_categories
"""
from flask import Blueprint, jsonify, request
from ..extensions import db
from ..models.metadata_config import MetadataField, DocTypeCategory, DocTypeSubtype

metadata_bp = Blueprint('metadata', __name__)


# ─── 元数据字段 CRUD ─────────────────────────────────
@metadata_bp.route('/fields', methods=['GET'])
def list_fields():
    fields = MetadataField.query.order_by(MetadataField.sort_order).all()
    return jsonify({
        "success": True,
        "data": [{
            "id": f.id,
            "field_name": f.field_name,
            "field_key": f.field_key,
            "field_type": f.field_type,
            "required": f.required,
            "enum_values": f.enum_values,
            "description": f.description,
            "items_schema": f.items_schema,
            "sort_order": f.sort_order,
            "is_active": f.is_active,
        } for f in fields]
    })


@metadata_bp.route('/fields', methods=['POST'])
def create_field():
    data = request.json
    if MetadataField.query.filter_by(field_name=data.get('field_name')).first():
        return jsonify({"success": False, "message": "字段名已存在"}), 400

    f = MetadataField(
        field_name=data['field_name'],
        field_key=data.get('field_key', ''),
        field_type=data.get('field_type', 'string'),
        required=data.get('required', False),
        enum_values=data.get('enum_values'),
        description=data.get('description'),
        items_schema=data.get('items_schema'),
        sort_order=data.get('sort_order', 0),
        is_active=data.get('is_active', True),
    )
    db.session.add(f)
    db.session.commit()
    return jsonify({"success": True, "data": {"id": f.id}})


@metadata_bp.route('/fields/<int:field_id>', methods=['PUT'])
def update_field(field_id):
    f = MetadataField.query.get(field_id)
    if not f:
        return jsonify({"success": False, "message": "字段不存在"}), 404

    data = request.json
    for key in ['field_name', 'field_key', 'field_type', 'required',
                'enum_values', 'description', 'items_schema', 'sort_order', 'is_active']:
        if key in data:
            setattr(f, key, data[key])

    db.session.commit()
    return jsonify({"success": True})


@metadata_bp.route('/fields/<int:field_id>', methods=['DELETE'])
def delete_field(field_id):
    f = MetadataField.query.get(field_id)
    if not f:
        return jsonify({"success": False, "message": "字段不存在"}), 404

    db.session.delete(f)
    db.session.commit()
    return jsonify({"success": True})


# ─── 文档类型 CRUD ────────────────────────────────────
@metadata_bp.route('/doc-types', methods=['GET'])
def list_doc_types():
    categories = DocTypeCategory.query.order_by(DocTypeCategory.sort_order).all()
    result = []
    for cat in categories:
        subtypes = DocTypeSubtype.query.filter_by(category_id=cat.id).order_by(DocTypeSubtype.sort_order).all()
        result.append({
            "id": cat.id,
            "name": cat.name,
            "description": cat.description,
            "default_subtype": cat.default_subtype,
            "sort_order": cat.sort_order,
            "subtypes": [{
                "id": st.id,
                "name": st.name,
                "prompt": st.prompt,
                "sort_order": st.sort_order,
            } for st in subtypes]
        })
    return jsonify({"success": True, "data": result})


@metadata_bp.route('/doc-types', methods=['POST'])
def create_doc_type():
    data = request.json
    if DocTypeCategory.query.filter_by(name=data.get('name')).first():
        return jsonify({"success": False, "message": "主类型已存在"}), 400
    cat = DocTypeCategory(
        name=data['name'],
        description=data.get('description'),
        default_subtype=data.get('default_subtype'),
        sort_order=data.get('sort_order', 0),
    )
    db.session.add(cat)
    db.session.commit()
    return jsonify({"success": True, "data": {"id": cat.id}})


@metadata_bp.route('/doc-types/<int:cat_id>', methods=['PUT'])
def update_doc_type(cat_id):
    cat = DocTypeCategory.query.get(cat_id)
    if not cat:
        return jsonify({"success": False, "message": "主类型不存在"}), 404
    data = request.json
    for key in ['name', 'description', 'default_subtype', 'sort_order']:
        if key in data:
            setattr(cat, key, data[key])
    db.session.commit()
    return jsonify({"success": True})


@metadata_bp.route('/doc-types/<int:cat_id>', methods=['DELETE'])
def delete_doc_type(cat_id):
    cat = DocTypeCategory.query.get(cat_id)
    if not cat:
        return jsonify({"success": False, "message": "主类型不存在"}), 404
    DocTypeSubtype.query.filter_by(category_id=cat_id).delete()
    db.session.delete(cat)
    db.session.commit()
    return jsonify({"success": True})


# ─── 子类型 CRUD ──────────────────────────────────────
@metadata_bp.route('/doc-types/<int:cat_id>/subtypes', methods=['POST'])
def create_subtype(cat_id):
    cat = DocTypeCategory.query.get(cat_id)
    if not cat:
        return jsonify({"success": False, "message": "主类型不存在"}), 404
    data = request.json
    st = DocTypeSubtype(
        category_id=cat_id,
        name=data['name'],
        prompt=data.get('prompt'),
        sort_order=data.get('sort_order', 0),
    )
    db.session.add(st)
    db.session.commit()
    return jsonify({"success": True, "data": {"id": st.id}})


@metadata_bp.route('/subtypes/<int:subtype_id>', methods=['PUT'])
def update_subtype(subtype_id):
    st = DocTypeSubtype.query.get(subtype_id)
    if not st:
        return jsonify({"success": False, "message": "子类型不存在"}), 404
    data = request.json
    for key in ['name', 'prompt', 'sort_order']:
        if key in data:
            setattr(st, key, data[key])
    db.session.commit()
    return jsonify({"success": True})


@metadata_bp.route('/subtypes/<int:subtype_id>', methods=['DELETE'])
def delete_subtype(subtype_id):
    st = DocTypeSubtype.query.get(subtype_id)
    if not st:
        return jsonify({"success": False, "message": "子类型不存在"}), 404
    db.session.delete(st)
    db.session.commit()
    return jsonify({"success": True})


# ─── Prompt 组装预览 ──────────────────────────────────
@metadata_bp.route('/prompt-preview', methods=['GET'])
def prompt_preview():
    """实时预览当前配置组装出的 System Prompt 和 User Prompt 模板"""
    from ..models.metadata_config import ExtractionRule
    try:
        from app.tasks.metadata_tasks import _build_system_prompt
        system_prompt = _build_system_prompt()
    except Exception as e:
        system_prompt = f"（构建失败：{str(e)}）"

    user_prompt_template = "请从以下医疗文档OCR文本中提取元数据：\n\n{ocr_text}"

    return jsonify({
        "success": True,
        "data": {
            "system_prompt": system_prompt,
            "user_prompt_template": user_prompt_template,
        }
    })


# ─── 抽取规则 CRUD ────────────────────────────────────
@metadata_bp.route('/extraction-rules', methods=['GET'])
def list_extraction_rules():
    from ..models.metadata_config import ExtractionRule
    rules = ExtractionRule.query.all()
    return jsonify({
        "success": True,
        "data": [{
            "id": r.id,
            "rule_key": r.rule_key,
            "rule_value": r.rule_value,
            "description": r.description,
        } for r in rules]
    })


@metadata_bp.route('/extraction-rules/<int:rule_id>', methods=['PUT'])
def update_extraction_rule(rule_id):
    from ..models.metadata_config import ExtractionRule
    rule = ExtractionRule.query.get(rule_id)
    if not rule:
        return jsonify({"success": False, "message": "规则不存在"}), 404
    data = request.json
    if 'rule_value' in data:
        rule.rule_value = data['rule_value']
    if 'description' in data:
        rule.description = data['description']
    db.session.commit()
    return jsonify({"success": True})

