import jwt
import datetime
from flask import Blueprint, request, jsonify
from ..models.user import User
from ..extensions import db
from config import Config

auth_bp = Blueprint('auth', __name__)

def generate_token(user):
    """为指定用户生成 JWT token，返回 (token, expires_at)"""
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=7)
    payload = {
        "user_id": user.id,
        "email": user.email,
        "name": user.name,
        "exp": expires_at,
        "iat": datetime.datetime.utcnow(),
    }
    token = jwt.encode(payload, Config.SECRET_KEY, algorithm="HS256")
    return token, expires_at


def verify_token(token):
    """验证 JWT token，返回 payload（dict）或 None（失败）"""
    try:
        payload = jwt.decode(token, Config.SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


@auth_bp.route('/login', methods=['POST'])
def login():
    """核心登录接口 — 返回真实 JWT"""
    print("[AUTH] login endpoint called, using new code")
    data = request.json
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"success": False, "message": "邮箱或密码不能为空"}), 400

    user = User.query.filter_by(email=data["email"]).first()
    print(f"[AUTH] user found: {user.email if user else None}, user id: {user.id if user else None}")

    if user and user.check_password(data["password"]):
        token, expires_at = generate_token(user)
        print(f"[AUTH] generated token: {token[:30]}...")
        return jsonify({
            "success": True,
            "code": 0,
            "data": {
                "access_token": token,
                "expires_at": expires_at.isoformat(),
                "user": user.to_dict()
            }
        })
    else:
        return jsonify({"success": False, "message": "邮箱或密码错误"}), 401

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.json
    email = data.get("email")
    password = data.get("password")
    name = data.get("name", "测试用户")
    
    if not email or not password:
        return jsonify({"success": False, "message": "邮箱和密码必填"}), 400
        
    if User.query.filter_by(email=email).first():
        return jsonify({"success": False, "message": "改邮箱已注册"}), 409
        
    new_user = User(email=email, name=name)
    new_user.set_password(password)
    db.session.add(new_user)
    db.session.commit()
    return jsonify({"success": True, "code": 0, "message": "注册成功"})
