from app import create_app
from app.extensions import db
from app.models.user import User

app = create_app()

def init_db():
    with app.app_context():
        db.create_all()
        # 自动创建一个测试用户
        if not User.query.filter_by(email="admin@eacy.ai").first():
            admin = User(email="admin@eacy.ai", name="Admin")
            admin.set_password("123456")
            db.session.add(admin)
            db.session.commit()
            print("【✓】已创建默认测试账号: admin@eacy.ai / 123456")

if __name__ == '__main__':
    # 启动前确认建表
    init_db()
    app.run(host='0.0.0.0', port=5001, debug=True)
