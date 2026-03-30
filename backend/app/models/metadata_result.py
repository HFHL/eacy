"""
元数据抽取结果模型
"""
import uuid
from datetime import datetime
from ..extensions import db
from sqlalchemy.dialects.postgresql import JSONB


class MetadataResult(db.Model):
    __tablename__ = 'metadata_results'

    STATUS_PROCESSING = 'PROCESSING'
    STATUS_SUCCESS = 'SUCCESS'
    STATUS_FAILED = 'FAILED'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = db.Column(db.String(36), index=True, nullable=False)
    ocr_result_id = db.Column(db.String(36), nullable=True)   # 关联对应的 OCR 记录

    result_json = db.Column(db.JSON().with_variant(JSONB, 'postgresql'), nullable=True)  # 抽取结果

    llm_model = db.Column(db.String(100), nullable=True)
    system_prompt = db.Column(db.Text, nullable=True)     # 保存完整 system prompt 用于溯源
    user_prompt = db.Column(db.Text, nullable=True)        # 保存完整 user prompt
    llm_raw_response = db.Column(db.Text, nullable=True)
    prompt_tokens = db.Column(db.Integer, nullable=True)
    completion_tokens = db.Column(db.Integer, nullable=True)
    duration_ms = db.Column(db.Integer, nullable=True)

    status = db.Column(db.String(30), nullable=False, default=STATUS_PROCESSING)
    error_msg = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "document_id": self.document_id,
            "ocr_result_id": self.ocr_result_id,
            "result_json": self.result_json,
            "llm_model": self.llm_model,
            "system_prompt": self.system_prompt,
            "user_prompt": self.user_prompt,
            "llm_raw_response": self.llm_raw_response,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "duration_ms": self.duration_ms,
            "status": self.status,
            "error_msg": self.error_msg,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
