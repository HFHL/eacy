import os
from flask import Flask
from .extensions import db, cors, celery_app

def create_app(config_object="config.Config"):
    app = Flask(__name__)
    # 对于跨目录导入配置，可以直接传字符串，如果 config.py 在更外层，我们这里可以传类引用或从环境变量读取
    # 为了方便，可以直接在应用外面传进来，或者硬编码
    
    # 因为 app 目录是在 backend 下面，需要确保 config 模块能被找到
    # 我们可以通过直接传对象方式比较通用
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from config import Config
    app.config.from_object(Config)

    # 初始化扩展
    db.init_app(app)
    cors.init_app(app)

    # 初始化 Celery
    init_celery(app, celery_app)

    # 注册 Blueprints
    from .api import register_blueprints
    register_blueprints(app)

    return app

def init_celery(app, celery):
    """
    配置 Celery 对象并和 Flask App 绑定
    """
    celery.conf.update(app.config)

    # TaskBase 需要获取 Flask 的 app context 这样可以在任务里调用 db.session
    class ContextTask(celery.Task):
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)

    celery.Task = ContextTask
