import uuid
from datetime import datetime
from ..extensions import db
from sqlalchemy.dialects.postgresql import JSONB


class OcrResult(db.Model):
    __tablename__ = 'ocr_results'

    # Status Constants
    STATUS_PROCESSING = 'PROCESSING'
    STATUS_SUCCESS = 'SUCCESS'
    STATUS_FAILED = 'FAILED'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = db.Column(db.String(36), index=True, nullable=False)

    provider = db.Column(db.String(50), nullable=True)       # textin / paddleocr
    total_pages = db.Column(db.Integer, nullable=True)

    # OCR 服务返回的完整原始 JSON（溯源 & 重跑）
    ocr_raw_json = db.Column(db.JSON().with_variant(JSONB, 'postgresql'), nullable=True)
    # 拼接后的纯文本全文（直接喂大模型）
    ocr_text = db.Column(db.Text, nullable=True)

    confidence_avg = db.Column(db.Float, nullable=True)       # 平均识别置信度 0~1
    duration_ms = db.Column(db.Integer, nullable=True)        # OCR 耗时（毫秒）

    status = db.Column(db.String(30), nullable=False, default=STATUS_PROCESSING)
    error_msg = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "document_id": self.document_id,
            "provider": self.provider,
            "total_pages": self.total_pages,
            "ocr_text": self.ocr_text,
            "confidence_avg": self.confidence_avg,
            "duration_ms": self.duration_ms,
            "status": self.status,
            "error_msg": self.error_msg,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
