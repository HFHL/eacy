import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "eacy_dev_secret")
    # 默认连接本地的 postgres 数据库 'eacy_db'
    SQLALCHEMY_DATABASE_URI = os.getenv("DATABASE_URL", "postgresql+psycopg://localhost:5432/eacy_db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Celery 异步任务队列配置 (默认连接本地 Redis 0号库)
    broker_url = os.getenv("CELERY_BROKER_URL", "redis://localhost:6379/0")
    result_backend = os.getenv("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
