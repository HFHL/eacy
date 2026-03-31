"""
CRF 字段级抽取历史记录模型

每次 LLM 从一份文档中提取一个字段的值时，产生一条不可变记录。
ProjectPatient.crf_data 是"最终快照"，本表是"完整审计历史"。
"""
import uuid
from datetime import datetime
from ..extensions import db
from sqlalchemy.dialects.postgresql import JSONB


class CrfFieldExtraction(db.Model):
    """CRF 字段级抽取历史记录"""
    __tablename__ = 'crf_field_extractions'
    __table_args__ = (
        db.Index(
            'ix_crf_field_lookup',
            'project_id', 'patient_id', 'form_name', 'field_name', 'anchor_value'
        ),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # 关联维度
    project_id = db.Column(db.String(36), db.ForeignKey('research_projects.id'), nullable=False, index=True)
    patient_id = db.Column(db.String(36), db.ForeignKey('patients.id'), nullable=False, index=True)
    document_id = db.Column(db.String(36), db.ForeignKey('documents.id'), nullable=True, index=True)

    # CRF 定位
    form_name = db.Column(db.String(200), nullable=False)
    field_name = db.Column(db.String(200), nullable=False)
    # 锚点值: 用于区分可重复表单的不同实例（如"2024-01-15"）。
    # None 表示该表单不可重复，或本次抽取未能提取到锚点值（退化为单实例）。
    anchor_value = db.Column(db.String(200), nullable=True, index=True)

    # 抽取结果
    extracted_value = db.Column(db.JSON().with_variant(JSONB, 'postgresql'), nullable=True)
    source_blocks = db.Column(db.JSON().with_variant(JSONB, 'postgresql'), nullable=True)

    # 合并动作
    merge_action = db.Column(db.String(20), nullable=True)  # filled / same / conflict

    # 是否被用户手动采用为当前值
    is_adopted = db.Column(db.Boolean, default=False, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "patient_id": self.patient_id,
            "document_id": self.document_id,
            "form_name": self.form_name,
            "field_name": self.field_name,
            "anchor_value": self.anchor_value,
            "extracted_value": self.extracted_value,
            "source_blocks": self.source_blocks,
            "merge_action": self.merge_action,
            "is_adopted": self.is_adopted,
            "created_at": self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None,
        }
