from flask import Blueprint, request, jsonify
from ..models.user import User
from ..extensions import db

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    """重构后的核心登录接口 (Blueprint 模式)"""
    data = request.json
    if not data or not data.get("email") or not data.get("password"):
        return jsonify({"success": False, "message": "邮箱或密码不能为空"}), 400
        
    user = User.query.filter_by(email=data["email"]).first()
    
    if user and user.check_password(data["password"]):
        return jsonify({
            "success": True,
            "code": 0,
            "data": {
                "access_token": f"mock_token_{user.id}",
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
