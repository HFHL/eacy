import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.extensions import db
from app.models.patient import Patient, PatientDocument
from app.models.metadata_result import MetadataResult
from sqlalchemy.orm.attributes import flag_modified

app = create_app()
with app.app_context():
    patients = Patient.query.all()
    count = 0
    for p in patients:
        meta = p.metadata_json or {}
        if '机构名称' not in meta or '科室信息' not in meta:
            pd = PatientDocument.query.filter_by(patient_id=p.id).first()
            if pd:
                mr = MetadataResult.query.filter_by(document_id=pd.document_id).order_by(MetadataResult.created_at.desc()).first()
                if mr and mr.result_json:
                    meta['机构名称'] = meta.get('机构名称') or mr.result_json.get('机构名称', '')
                    meta['科室信息'] = meta.get('科室信息') or mr.result_json.get('科室信息', '')
                    p.metadata_json = meta
                    flag_modified(p, 'metadata_json')
                    count += 1
    db.session.commit()
    print(f"Successfully fixed {count} patients with missing institution or department.")
