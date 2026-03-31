"""
JWT 认证工具函数
所有 API 接口通过此模块获取当前登录用户 ID，不再直接读 X-User-Id header。
"""
from flask import request, jsonify
from .auth import verify_token


def get_current_user_id():
    """
    从请求 Authorization header 中解析 JWT，返回 user_id（int）。
    验证失败或缺失时返回 None，由调用方决定如何响应。
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:].strip()
    if not token:
        return None
    payload = verify_token(token)
    if payload is None:
        return None
    return payload.get("user_id")


def require_auth(f):
    """
    装饰器：保护需要登录的接口。
    未携带合法 JWT 时直接返回 401，不再执行视图函数。
    """
    from functools import wraps

    @wraps(f)
    def decorated(*args, **kwargs):
        user_id = get_current_user_id()
        if user_id is None:
            return jsonify({"success": False, "message": "未登录或 token 无效"}), 401
        return f(*args, **kwargs)

    return decorated
