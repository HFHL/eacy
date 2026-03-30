"""
科研项目模型
"""
import uuid
from datetime import datetime
from ..extensions import db
from sqlalchemy.dialects.postgresql import JSONB


class ResearchProject(db.Model):
    """研究项目主表"""
    __tablename__ = 'research_projects'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    project_name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)

    # 项目负责人 = 创建者
    creator_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # 项目周期
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)

    # 关联 CRF 模版
    crf_template_id = db.Column(db.String(36), db.ForeignKey('crf_templates.id'), nullable=True)
    crf_template_version_id = db.Column(db.String(36), db.ForeignKey('crf_template_versions.id'), nullable=True)

    status = db.Column(db.String(20), nullable=False, default='planning')  # planning/active/paused/completed

    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "project_name": self.project_name,
            "description": self.description,
            "creator_id": self.creator_id,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "crf_template_id": self.crf_template_id,
            "crf_template_version_id": self.crf_template_version_id,
            "status": self.status,
            "is_deleted": self.is_deleted,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class ProjectPatient(db.Model):
    """项目-患者关联表（受试者入组）"""
    __tablename__ = 'project_patients'
    __table_args__ = (
        db.UniqueConstraint('project_id', 'patient_id', name='uq_project_patient'),
    )

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    project_id = db.Column(db.String(36), db.ForeignKey('research_projects.id'), nullable=False, index=True)
    patient_id = db.Column(db.String(36), db.ForeignKey('patients.id'), nullable=False, index=True)

    # CRF 抽取结果（按项目绑定的模版结构存储）
    crf_data = db.Column(db.JSON().with_variant(JSONB, 'postgresql'), nullable=True, default=dict)

    is_deleted = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, include_crf=False):
        result = {
            "id": self.id,
            "project_id": self.project_id,
            "patient_id": self.patient_id,
            "is_deleted": self.is_deleted,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_crf:
            result["crf_data"] = self.crf_data
        return result

