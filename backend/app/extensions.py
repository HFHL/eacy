from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from celery import Celery

db = SQLAlchemy()
cors = CORS()

def make_celery(app_name=__name__):
    # 初始化一个配置了 Redis broker 的 Celery 对象
    return Celery(
        app_name,
        broker='redis://localhost:6379/0',
        backend='redis://localhost:6379/1',
        broker_connection_retry_on_startup=True
    )

celery_app = make_celery()
