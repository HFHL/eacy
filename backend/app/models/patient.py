"""
患者（电子病历夹）模型
"""
import uuid
from datetime import datetime
from ..extensions import db
from sqlalchemy.dialects.postgresql import JSONB


class Patient(db.Model):
    """电子病历夹主表 — 一个患者 = 一个病历夹"""
    __tablename__ = 'patients'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    # 患者元数据（动态 JSON，字段随 metadata_fields 配置变化）
    metadata_json = db.Column(db.JSON().with_variant(JSONB, 'postgresql'), nullable=True, default=dict)

    # 唯一标识符数组，用于归档匹配（从 metadata 中冗余出来加速查询）
    identifiers = db.Column(db.JSON().with_variant(JSONB, 'postgresql'), nullable=True, default=list)

    # 冗余计数
    document_count = db.Column(db.Integer, nullable=False, default=0)

    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    documents = db.relationship('PatientDocument', backref='patient', lazy='dynamic')

    def to_dict(self):
        return {
            "id": self.id,
            "metadata_json": self.metadata_json,
            "identifiers": self.identifiers,
            "document_count": self.document_count,
            "is_deleted": self.is_deleted,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class PatientDocument(db.Model):
    """患者-文档关联表"""
    __tablename__ = 'patient_documents'
    __table_args__ = (
        db.UniqueConstraint('patient_id', 'document_id', name='uq_patient_document'),
    )

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    patient_id = db.Column(db.String(36), db.ForeignKey('patients.id'), nullable=False, index=True)
    document_id = db.Column(db.String(36), db.ForeignKey('documents.id'), nullable=False, index=True)

    # 文档元数据快照（归档时冻结，便于列表展示）
    doc_type = db.Column(db.String(50), nullable=True)
    doc_subtype = db.Column(db.String(100), nullable=True)
    doc_title = db.Column(db.String(200), nullable=True)
    doc_date = db.Column(db.String(30), nullable=True)

    source = db.Column(db.String(30), nullable=False, default='AUTO')  # AUTO / MANUAL

    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        from .document import Document
        doc = Document.query.get(self.document_id)
        return {
            "id": self.id,
            "patient_id": self.patient_id,
            "document_id": self.document_id,
            "doc_type": self.doc_type,
            "doc_subtype": self.doc_subtype,
            "doc_title": self.doc_title,
            "doc_date": self.doc_date,
            "source": self.source,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "file_name": doc.filename if doc else None,
            "mime_type": doc.mime_type if doc else None,
        }
