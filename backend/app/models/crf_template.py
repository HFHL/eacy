"""
CRF 模版模型
"""
import uuid
from datetime import datetime
from ..extensions import db
from sqlalchemy.dialects.postgresql import JSONB


class CrfTemplate(db.Model):
    """CRF 表单模版主表"""
    __tablename__ = 'crf_templates'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    template_name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    category = db.Column(db.String(50), nullable=True)  # oncology / cardiology / ...

    status = db.Column(db.String(20), nullable=False, default='draft')  # draft / published
    version = db.Column(db.String(20), nullable=False, default='v1')    # 当前活跃版本号

    # 核心：完整的 CRF 表单定义树
    # 结构: { categories: [{ name, forms: [{ name, row_type, anchor_fields, conflict_strategy, prompt, fields: [...] }] }] }
    schema_json = db.Column(db.JSON().with_variant(JSONB, 'postgresql'), nullable=False, default=dict)

    creator_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联版本列表
    versions = db.relationship('CrfTemplateVersion', backref='template', lazy='dynamic')

    def to_dict(self):
        return {
            "id": self.id,
            "template_name": self.template_name,
            "description": self.description,
            "category": self.category,
            "status": self.status,
            "version": self.version,
            "schema_json": self.schema_json,
            "creator_id": self.creator_id,
            "is_deleted": self.is_deleted,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class CrfTemplateVersion(db.Model):
    """CRF 模版版本快照"""
    __tablename__ = 'crf_template_versions'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    template_id = db.Column(db.String(36), db.ForeignKey('crf_templates.id'), nullable=False, index=True)

    version = db.Column(db.String(20), nullable=False)  # v1, v2, v3 ...
    schema_json = db.Column(db.JSON().with_variant(JSONB, 'postgresql'), nullable=False)  # 冻结的完整 schema
    change_notes = db.Column(db.Text, nullable=True)  # 修改备注

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "template_id": self.template_id,
            "version": self.version,
            "schema_json": self.schema_json,
            "change_notes": self.change_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
