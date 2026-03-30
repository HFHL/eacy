from datetime import datetime
from passlib.hash import pbkdf2_sha256
from ..extensions import db

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 软删除标记
    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    
    def set_password(self, password):
        self.password_hash = pbkdf2_sha256.hash(password)
        
    def check_password(self, password):
        return pbkdf2_sha256.verify(password, self.password_hash)
    
    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "is_deleted": self.is_deleted,
            "created_at": self.created_at.isoformat()
        }
