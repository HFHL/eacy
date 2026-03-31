FROM python:3.12-slim

WORKDIR /app

# 安装系统依赖（psycopg2 需要 libpq-dev）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制应用代码（保持目录结构）
COPY . .

# 暴露端口
EXPOSE 5001

# 启动命令：启用 Flask 开发服务器 + 热重载 + Celery Worker
CMD ["sh", "-c", "python app.py --debug & celery -A celery_worker.celery worker --loglevel=info --pool=solo"]
