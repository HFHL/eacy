import os
from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.extensions import celery_app

# 初始化 Flask App 从而绑定环境
app = create_app()

# 让 Celery 能自动发现 app.tasks 下的所有任务
celery_app.conf.update(
    include=['app.tasks.ocr_tasks', 'app.tasks.metadata_tasks', 'app.tasks.crf_tasks']
)

# 获取 Celery 对象提供给 worker 启动
celery = celery_app