"""
CRF 模版 API
"""
from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models.crf_template import CrfTemplate, CrfTemplateVersion

crf_template_bp = Blueprint('crf_template', __name__)


@crf_template_bp.route('/', methods=['GET'])
def list_templates():
    """获取模版列表"""
    templates = CrfTemplate.query.filter_by(is_deleted=False).order_by(CrfTemplate.created_at.desc()).all()
    return jsonify({"success": True, "data": [t.to_dict() for t in templates]})


@crf_template_bp.route('/', methods=['POST'])
def create_template():
    """创建模版"""
    data = request.get_json()
    if not data or not data.get('template_name'):
        return jsonify({"success": False, "message": "模版名称不能为空"}), 400

    creator_id_raw = request.headers.get('X-User-Id') or data.get('creator_id')
    creator_id = int(creator_id_raw) if creator_id_raw else None

    # 同一用户下模版不允许重名
    existing = CrfTemplate.query.filter_by(
        template_name=data['template_name'],
        creator_id=creator_id,
        is_deleted=False
    ).first()
    if existing:
        return jsonify({"success": False, "message": "该模版名称已存在"}), 400

    template = CrfTemplate(
        template_name=data['template_name'],
        description=data.get('description'),
        category=data.get('category'),
        schema_json=data.get('schema_json', {"version": "1.0", "categories": []}),
        creator_id=creator_id,
    )
    db.session.add(template)
    db.session.flush()

    # 自动创建 v1 版本快照
    v1 = CrfTemplateVersion(
        template_id=template.id,
        version='v1',
        schema_json=template.schema_json,
        change_notes='初始版本',
    )
    db.session.add(v1)
    db.session.commit()

    return jsonify({"success": True, "data": template.to_dict()}), 201


@crf_template_bp.route('/import-system-csv', methods=['POST'])
def import_system_csv():
    """导入 CSV 作为系统模版（所有人可见）"""
    if 'file' not in request.files:
        return jsonify({"success": False, "message": "未能获取上传的文件"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "message": "文件名为空"}), 400
        
    try:
        from ..utils.csv_parser import parse_csv_to_schema
        schema_json = parse_csv_to_schema(file.read())
        
        # 默认名称取去除了扩展名的文件名
        template_name = file.filename.rsplit('.', 1)[0]
        
        # creator_id=None 意味着系统模板
        template = CrfTemplate(
            template_name=template_name,
            description="基于 CSV 导入的系统模版",
            category="通用",
            schema_json=schema_json,
            creator_id=None,  # 系统级别
        )
        db.session.add(template)
        db.session.flush()

        v1 = CrfTemplateVersion(
            template_id=template.id,
            version='v1',
            schema_json=template.schema_json,
            change_notes='System CSV Import',
        )
        db.session.add(v1)
        db.session.commit()

        return jsonify({"success": True, "data": template.to_dict()}), 201
    except Exception as e:
        return jsonify({"success": False, "message": f"解析 CSV 失败: {str(e)}"}), 500


@crf_template_bp.route('/<template_id>', methods=['GET'])
def get_template(template_id):
    """获取模版详情"""
    template = CrfTemplate.query.get(template_id)
    if not template or template.is_deleted:
        return jsonify({"success": False, "message": "模版不存在"}), 404
    return jsonify({"success": True, "data": template.to_dict()})


@crf_template_bp.route('/<template_id>', methods=['PUT'])
def update_template(template_id):
    """更新模版（保存时自动创建新版本快照）"""
    template = CrfTemplate.query.get(template_id)
    if not template or template.is_deleted:
        return jsonify({"success": False, "message": "模版不存在"}), 404

    data = request.get_json()

    # 更新基本信息
    for field in ['template_name', 'description', 'category', 'status']:
        if field in data:
            setattr(template, field, data[field])

    # 如果 schema_json 有变更，自动创建新版本快照
    if 'schema_json' in data:
        old_version = template.version
        # 版本号自增: v1 -> v2
        version_num = int(old_version.replace('v', '')) + 1
        new_version = f'v{version_num}'

        template.schema_json = data['schema_json']
        template.version = new_version

        snapshot = CrfTemplateVersion(
            template_id=template.id,
            version=new_version,
            schema_json=data['schema_json'],
            change_notes=data.get('change_notes', ''),
        )
        db.session.add(snapshot)

    db.session.commit()
    return jsonify({"success": True, "data": template.to_dict()})


@crf_template_bp.route('/<template_id>', methods=['DELETE'])
def delete_template(template_id):
    """软删除模版"""
    template = CrfTemplate.query.get(template_id)
    if not template or template.is_deleted:
        return jsonify({"success": False, "message": "模版不存在"}), 404

    template.is_deleted = True
    db.session.commit()
    return jsonify({"success": True, "message": "已删除"})


# ─── 版本管理 ──────────────────────────────────

@crf_template_bp.route('/<template_id>/versions', methods=['GET'])
def list_versions(template_id):
    """获取模版的所有版本"""
    template = CrfTemplate.query.get(template_id)
    if not template or template.is_deleted:
        return jsonify({"success": False, "message": "模版不存在"}), 404

    versions = CrfTemplateVersion.query.filter_by(
        template_id=template_id
    ).order_by(CrfTemplateVersion.created_at.desc()).all()

    return jsonify({"success": True, "data": [v.to_dict() for v in versions]})


@crf_template_bp.route('/<template_id>/versions/<version_id>/rollback', methods=['POST'])
def rollback_version(template_id, version_id):
    """回退到指定版本"""
    template = CrfTemplate.query.get(template_id)
    if not template or template.is_deleted:
        return jsonify({"success": False, "message": "模版不存在"}), 404

    target_version = CrfTemplateVersion.query.get(version_id)
    if not target_version or target_version.template_id != template_id:
        return jsonify({"success": False, "message": "版本不存在"}), 404

    # 用目标版本的 schema 覆盖主表，并创建一个新版本记录
    version_num = int(template.version.replace('v', '')) + 1
    new_version = f'v{version_num}'

    template.schema_json = target_version.schema_json
    template.version = new_version

    snapshot = CrfTemplateVersion(
        template_id=template.id,
        version=new_version,
        schema_json=target_version.schema_json,
        change_notes=f'回退到 {target_version.version}',
    )
    db.session.add(snapshot)
    db.session.commit()

    return jsonify({"success": True, "data": template.to_dict()})
