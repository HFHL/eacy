import uuid
from datetime import datetime
from ..extensions import db
from sqlalchemy.dialects.postgresql import JSONB

class PipelineTrace(db.Model):
    __tablename__ = 'pipeline_traces'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = db.Column(db.String(36), index=True, nullable=False)
    document_name = db.Column(db.String(500), nullable=True)   # 文档文件名，方便直观查看
    project_id = db.Column(db.String(36), index=True, nullable=True)   # 关联项目
    patient_id = db.Column(db.String(36), index=True, nullable=True)   # 关联患者
    
    stage = db.Column(db.String(100), nullable=False) # 例如 OCR_EXTRACTION, METADATA_ANALYSIS
    status = db.Column(db.String(50), nullable=False) # PROCESSING, SUCCESS, FAILED
    
    # 支持 PostgreSQL JSONB，存储大模型 Prompt 和 Completion 原始履历
    llm_payload = db.Column(db.JSON().with_variant(JSONB, 'postgresql'), nullable=True)
    
    error_msg = db.Column(db.Text, nullable=True)
    duration_ms = db.Column(db.Integer, nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "document_id": self.document_id,
            "document_name": self.document_name,
            "project_id": self.project_id,
            "patient_id": self.patient_id,
            "stage": self.stage,
            "status": self.status,
            "llm_payload": self.llm_payload,
            "error_msg": self.error_msg,
            "duration_ms": self.duration_ms,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
