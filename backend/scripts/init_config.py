import os
import sys

# 将 backend 根目录放入环境变量路径，以便 Python 顺利引用 app 模块
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(backend_dir)

from app import create_app
from app.extensions import db
from app.models.system import SystemConfig

def init_default_configs():
    app = create_app()
    with app.app_context():
        # 确保表已经创建
        db.create_all()
        
        default_configs = [
            SystemConfig(
                key="max_concurrent_uploads", 
                value="2", 
                description="前端允许同时发起的文件上传任务量，网络差的医院建议设为 1"
            ),
            SystemConfig(
                key="oss_part_size_mb", 
                value="5", 
                description="大文件多线程切片直传时，每个切片的数据大小(MB)，建议维持 5 或 10"
            ),
            SystemConfig(
                key="celery_worker_concurrency", 
                value="4", 
                description="Celery 异步队列最大支持的并发 AI 解析抽取线程数"
            ),
        ]
        
        for conf in default_configs:
            # merge 会在不存在时插入，存在时更新
            db.session.merge(conf)
            
        db.session.commit()
        print("✅ EACY 系统核心参数默认配置注入完成！已下发至 PostgreSQL `system_configs` 表中。")

if __name__ == '__main__':
    init_default_configs()
