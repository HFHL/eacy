import sys
import os
sys.path.insert(0, os.path.abspath('.'))
from app import create_app
from app.extensions import db
from app.models.document import Document

app = create_app()
with app.app_context():
    docs = Document.query.all()
    print("ALL DOCUMENTS:")
    for d in docs:
        print(f"ID={d.id}, status={d.status}, del={d.is_deleted}, name={d.filename}")
