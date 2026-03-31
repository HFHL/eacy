"""
认证工具函数 — 从 Authorization header 解析当前登录用户 ID。

token 格式: Bearer mock_token_{user_id}
优先用 token，fallback 到 X-User-Id header，最终 fallback 到 1 (admin)。
"""
from flask import request


def get_current_user_id() -> int:
    """从请求头解析当前用户 ID，优先从 Bearer token 读取。"""
    # 1. 尝试从 Authorization: Bearer mock_token_<id> 解析
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer mock_token_'):
        try:
            user_id = int(auth_header.split('Bearer mock_token_')[1])
            return user_id
        except (ValueError, IndexError):
            pass

    # 2. fallback: X-User-Id header
    x_user_id = request.headers.get('X-User-Id', '')
    if x_user_id:
        try:
            return int(x_user_id)
        except ValueError:
            pass

    # 3. 最终 fallback: admin
    return 1
