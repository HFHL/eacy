import sys
import os
import json
sys.path.insert(0, os.path.abspath('.'))
from app import create_app
from app.models.document import Document

app = create_app()
with app.app_context():
    docs = Document.query.filter_by(is_deleted=False).all()
    doc_ids = [d.id for d in docs]
    
    with app.test_client() as client:
        res = client.post('/api/batch/preflight', json={'document_ids': doc_ids})
        if res.status_code == 200:
            print(json.dumps(res.get_json(), ensure_ascii=False, indent=2))
        else:
            print("Failed to call preflight:", res.status_code, res.data)
