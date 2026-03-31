FROM node:20-alpine

WORKDIR /app

# 先复制 package.json，再安装依赖（利用 Docker 缓存层）
COPY package.json ./
RUN npm install --registry https://registry.npmmirror.com

# 复制其余源码
COPY . .

# Vite 开发服务器需要监听所有网卡并启用 HMR
# 容器内无法使用 localhost，需用 0.0.0.0
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
