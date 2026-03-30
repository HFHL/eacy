import sys
import os
import json
sys.path.insert(0, os.path.abspath('.'))
from app import create_app
from app.models.metadata_config import MetadataField

app = create_app()
with app.app_context():
    fields = MetadataField.query.all()
    print("COUNT:", len(fields))
