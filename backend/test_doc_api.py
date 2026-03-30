from app import create_app
from app.extensions import db

app = create_app()

with app.app_context():
    with app.test_client() as client:
        # User ID 1 is the default admin
        res = client.get('/api/documents/', headers={'X-User-Id': '1'})
        print("Status Code:", res.status_code)
        try:
            print("Response JSON:", res.get_json())
        except Exception as e:
            print("Response Text:", res.data.decode('utf-8'))
