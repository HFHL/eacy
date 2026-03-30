import os
from flask import Blueprint, jsonify
from alibabacloud_sts20150401.client import Client as StsClient
from alibabacloud_sts20150401 import models as sts_models
from alibabacloud_tea_openapi import models as open_api_models

oss_bp = Blueprint('oss', __name__)

@oss_bp.route('/upload-signature', methods=['GET'])
def get_oss_signature():
    """签发供前端使用的 STS 临时凭证，支持断点续传和分片大文件上传"""
    access_key_id = os.getenv("OSS_ACCESS_KEY_ID")
    access_key_secret = os.getenv("OSS_ACCESS_KEY_SECRET")
    bucket = os.getenv("OSS_BUCKET_NAME")
    endpoint = os.getenv("OSS_ENDPOINT")
    role_arn = os.getenv("OSS_ROLE_ARN")  # 【新增】STS必须依赖 RAM 角色
    region = os.getenv("OSS_REGION")
    
    if not all([access_key_id, access_key_secret, bucket, endpoint, role_arn]):
        return jsonify({
            "success": False, 
            "message": "服务器 STS 配置缺失。请确保 .env 中含有 OSS_ROLE_ARN 等参数"
        }), 500

    config = open_api_models.Config(
        access_key_id=access_key_id,
        access_key_secret=access_key_secret,
        endpoint='sts.cn-shanghai.aliyuncs.com' # STS 服务的统一 endpoint 通常固定或根据区域选择
    )
    
    try:
        client = StsClient(config)
        request = sts_models.AssumeRoleRequest(
            duration_seconds=3600,
            role_arn=role_arn,
            role_session_name="eacy-frontend-upload-session"
        )
        response = client.assume_role(request)
        creds = response.body.credentials
        
        return jsonify({
            "success": True,
            "code": 0,
            "data": {
                "accessKeyId": creds.access_key_id,
                "accessKeySecret": creds.access_key_secret,
                "stsToken": creds.security_token,
                "region": region,
                "bucket": bucket,
                "dir": "documents/"
            }
        })
    except Exception as e:
        return jsonify({"success": False, "message": f"获取 STS Token 失败：{str(e)}"}), 500
