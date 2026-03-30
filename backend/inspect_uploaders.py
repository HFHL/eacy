import sys
import os
sys.path.insert(0, os.path.abspath('.'))
from app import create_app
from app.models.document import Document

app = create_app()
with app.app_context():
    docs = Document.query.filter_by(is_deleted=False).all()
    for d in docs:
        print(f"ID={d.id}, uploader={d.uploader_id}, name={d.filename}")
