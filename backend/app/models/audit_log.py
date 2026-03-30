import uuid
from datetime import datetime
from ..extensions import db
from sqlalchemy.dialects.postgresql import JSONB

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.Integer, nullable=True) # 发起动作的用户ID
    action_type = db.Column(db.String(100), nullable=False) # 例如 UPLOAD_DOCUMENT, LOGIN
    target_type = db.Column(db.String(100), nullable=True)  # 操作实体类型，例如 DOCUMENT
    target_id = db.Column(db.String(100), nullable=True)    # 实体ID
    
    # 支持 PostgreSQL 的 JSONB 类型，存储上下文信息如 IP、Diff 差异
    details = db.Column(db.JSON().with_variant(JSONB, 'postgresql'), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    
    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "action_type": self.action_type,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "details": self.details,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
