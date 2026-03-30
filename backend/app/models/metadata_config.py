"""
元数据抽取配置模型 — 替代 3 个 JSON 配置文件
"""
from ..extensions import db
from sqlalchemy.dialects.postgresql import JSONB


class MetadataField(db.Model):
    """元数据字段定义（原 metadata_fields.json）"""
    __tablename__ = 'metadata_fields'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    field_name = db.Column(db.String(50), unique=True, nullable=False)   # 中文名: 患者姓名
    field_key = db.Column(db.String(50), unique=True, nullable=False)    # 英文键: patient_name
    field_type = db.Column(db.String(20), nullable=False, default='string')  # string/integer/array
    required = db.Column(db.Boolean, default=False)
    enum_values = db.Column(db.JSON().with_variant(JSONB, 'postgresql'), nullable=True)  # ["男","女","不详"]
    description = db.Column(db.Text, nullable=True)    # 字段说明 / LLM 提示
    items_schema = db.Column(db.JSON().with_variant(JSONB, 'postgresql'), nullable=True)  # array 子项 schema
    sort_order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)


class DocTypeCategory(db.Model):
    """文档主类型（原 document_types.json 顶层）"""
    __tablename__ = 'doc_type_categories'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), unique=True, nullable=False)     # 病历记录、实验室检查...
    description = db.Column(db.Text, nullable=True)
    default_subtype = db.Column(db.String(100), nullable=True)       # 默认子类型
    sort_order = db.Column(db.Integer, default=0)

    subtypes = db.relationship('DocTypeSubtype', backref='category', lazy='dynamic')


class DocTypeSubtype(db.Model):
    """文档子类型 + 分类提示词"""
    __tablename__ = 'doc_type_subtypes'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    category_id = db.Column(db.Integer, db.ForeignKey('doc_type_categories.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)     # 门诊病历、血常规...
    prompt = db.Column(db.Text, nullable=True)           # 分类依据 prompt
    sort_order = db.Column(db.Integer, default=0)


class ExtractionRule(db.Model):
    """抽取规则配置（原 extraction_rules.json）"""
    __tablename__ = 'extraction_rules'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    rule_key = db.Column(db.String(50), unique=True, nullable=False)   # system_role, null_policy...
    rule_value = db.Column(db.JSON().with_variant(JSONB, 'postgresql'), nullable=True)
    description = db.Column(db.Text, nullable=True)
