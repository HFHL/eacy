import sys
import os
sys.path.insert(0, os.path.abspath('.'))
from app import create_app
from app.extensions import db

app = create_app()
with app.app_context():
    db.drop_all()
    db.create_all()
    print("All database tables dropped and recreated.")

