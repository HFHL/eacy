import sys
import os
sys.path.insert(0, os.path.abspath('.'))
from app import create_app
from app.extensions import db
from app.models.patient import PatientDocument

app = create_app()
with app.app_context():
    docs = PatientDocument.query.all()
    print("ALL PATIENT DOCUMENTS:")
    for d in docs:
        print(f"PD ID: {d.id}, Patient: {d.patient_id}, Doc: {d.document_id}, is_deleted: {d.is_deleted}")
