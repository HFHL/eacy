import sys
import os
sys.path.insert(0, os.path.abspath('.'))
from app import create_app
from app.models.document import Document
from app.models.patient import PatientDocument

app = create_app()
with app.app_context():
    docs_undeleted = Document.query.filter_by(is_deleted=False).count()
    docs_total = Document.query.count()
    pds_undeleted = PatientDocument.query.filter_by(is_deleted=False).count()
    pds_total = PatientDocument.query.count()
    print(f"Documents: {docs_undeleted} undeleted out of {docs_total} total")
    print(f"PatientDocuments: {pds_undeleted} undeleted out of {pds_total} total")
