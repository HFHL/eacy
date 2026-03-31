FROM python:3.12-slim

WORKDIR /app

# 安装系统依赖（psycopg[binary] 需要 libpq-dev，alembic 等工具需要 gcc）
# 使用国内腾讯云镜像加速
RUN sed -i 's/deb.debian.org/mirrors.tencent.com/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖（豆瓣镜像加速）
COPY requirements.txt .
RUN pip install --no-cache-dir -i https://pypi.doubanio.com/simple/ -r requirements.txt
# psycopg2-binary 兼容 Flask-SQLAlchemy 默认的 postgresql:// 驱动
RUN pip install --no-cache-dir -i https://pypi.doubanio.com/simple/ psycopg2-binary

# 复制应用代码（保持目录结构）
COPY . .

# 暴露端口
EXPOSE 5001

# 启动命令：启用 Flask 开发服务器 + 热重载 + Celery Worker
CMD ["sh", "-c", "python app.py --debug & celery -A celery_worker.celery worker --loglevel=info --pool=solo"]
FROM python:3.12-slim

WORKDIR /app

# 安装系统依赖（psycopg[binary] 需要 libpq-dev，alembic 等工具需要 gcc）
# 使用国内腾讯云镜像加速
RUN sed -i 's/deb.debian.org/mirrors.tencent.com/g' /etc/apt/sources.list.d/debian.sources && \
    apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖（豆瓣镜像加速）
COPY requirements.txt .
RUN pip install --no-cache-dir -i https://pypi.doubanio.com/simple/ -r requirements.txt
# psycopg2-binary 兼容 Flask-SQLAlchemy 默认的 postgresql:// 驱动
RUN pip install --no-cache-dir -i https://pypi.doubanio.com/simple/ psycopg2-binary

# 复制应用代码（保持目录结构）
COPY . .

# 暴露端口
EXPOSE 5001

# 启动命令：启用 Flask 开发服务器 + 热重载 + Celery Worker
CMD ["sh", "-c", "python app.py --debug & celery -A celery_worker.celery worker --loglevel=info --pool=solo"]
