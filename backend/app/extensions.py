from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from celery import Celery
import os

db = SQLAlchemy()
cors = CORS()

def make_celery(app_name=__name__):
    redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
    redis_backend = redis_url.replace('/0', '/1')
    # 初始化一个配置了 Redis broker 的 Celery 对象
    return Celery(
        app_name,
        broker=redis_url,
        backend=redis_backend,
        broker_connection_retry_on_startup=True
    )

celery_app = make_celery()
