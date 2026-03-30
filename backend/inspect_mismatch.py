import sys
import os
sys.path.insert(0, os.path.abspath('.'))
from app import create_app
from app.extensions import db
from app.models.patient import PatientDocument
from app.models.document import Document

app = create_app()
with app.app_context():
    pds = PatientDocument.query.filter_by(is_deleted=False).all()
    print("PDs with is_deleted=False:")
    for pd in pds:
        doc = Document.query.get(pd.document_id)
        print(f"PD {pd.id} -> Doc {pd.document_id} [doc.is_deleted={doc.is_deleted if doc else 'MISSING'}]")
