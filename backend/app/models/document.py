import uuid
from datetime import datetime
from ..extensions import db

class Document(db.Model):
    __tablename__ = 'documents'
    
    # Document Status Constants
    STATUS_PENDING = 'PENDING'
    STATUS_UPLOADING = 'UPLOADING'
    STATUS_UPLOAD_FAILED = 'UPLOAD_FAILED'
    STATUS_METADATA_EXTRACTING = 'METADATA_EXTRACTING'
    STATUS_METADATA_FAILED = 'METADATA_FAILED'
    STATUS_COMPLETED = 'COMPLETED'
    STATUS_EXTRACTING_METADATA = 'EXTRACTING_METADATA'
    STATUS_EXTRACT_DONE = 'EXTRACT_DONE'
    STATUS_EXTRACT_FAILED = 'EXTRACT_FAILED'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = db.Column(db.String(255), nullable=False)
    oss_url = db.Column(db.String(500), nullable=True)  # OSS 下载或查阅链接
    mime_type = db.Column(db.String(100), nullable=False)
    file_size = db.Column(db.Integer, nullable=True)    # 字节
    
    status = db.Column(db.String(50), nullable=False, default=STATUS_PENDING)
    
    # 目前简化外键，如果是真实生产环境可以加 db.ForeignKey('users.id')
    uploader_id = db.Column(db.Integer, nullable=True) 
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 软删除标记
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    
    def to_dict(self):
        return {
            "id": self.id,
            "filename": self.filename,
            "oss_url": self.oss_url,
            "mime_type": self.mime_type,
            "file_size": self.file_size,
            "status": self.status,
            "uploader_id": self.uploader_id,
            "is_deleted": self.is_deleted,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
