#!/bin/bash
# ============================================================
#  EACY Platform — 一键启动脚本
#  用法: ./start.sh          (启动所有服务)
#        ./start.sh stop     (停止所有服务)
# ============================================================

set -e

# ── 端口配置 ──
BACKEND_PORT=5001
FRONTEND_PORT=5173
REDIS_PORT=6379

# ── 路径 ──
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
LOG_DIR="$SCRIPT_DIR/.logs"

# ── 颜色 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }
info()  { echo -e "${CYAN}[i]${NC} $1"; }

# ── 端口清理函数 ──
kill_port() {
    local port=$1
    local pids
    pids=$(lsof -ti:"$port" 2>/dev/null || true)
    if [ -n "$pids" ]; then
        warn "端口 $port 被占用 (PID: $pids)，正在释放..."
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
        log "端口 $port 已释放"
    else
        log "端口 $port 空闲"
    fi
}

# ── 停止所有服务 ──
stop_all() {
    info "正在停止所有 EACY 服务..."
    
    # 停止后台进程
    if [ -f "$LOG_DIR/backend.pid" ]; then
        kill "$(cat "$LOG_DIR/backend.pid")" 2>/dev/null && log "Flask 已停止" || true
        rm -f "$LOG_DIR/backend.pid"
    fi
    if [ -f "$LOG_DIR/celery.pid" ]; then
        kill "$(cat "$LOG_DIR/celery.pid")" 2>/dev/null && log "Celery 已停止" || true
        rm -f "$LOG_DIR/celery.pid"
    fi
    if [ -f "$LOG_DIR/frontend.pid" ]; then
        kill "$(cat "$LOG_DIR/frontend.pid")" 2>/dev/null && log "Frontend 已停止" || true
        rm -f "$LOG_DIR/frontend.pid"
    fi
    
    # 兜底：按端口清理
    kill_port $BACKEND_PORT
    kill_port $FRONTEND_PORT
    
    log "所有服务已停止"
}

# ── 处理 stop 命令 ──
if [ "${1:-}" = "stop" ]; then
    stop_all
    exit 0
fi

# ============================================================
#  启动流程
# ============================================================
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        🚀 EACY Platform Launcher         ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

mkdir -p "$LOG_DIR"

# ── Step 1: 清理端口 ──
info "Step 1/5: 清理端口..."
kill_port $BACKEND_PORT
kill_port $FRONTEND_PORT

# ── Step 2: 检查 Redis ──
info "Step 2/5: 检查 Redis..."
if ! redis-cli -p $REDIS_PORT ping &>/dev/null; then
    warn "Redis 未运行，尝试启动..."
    if command -v redis-server &>/dev/null; then
        redis-server --port $REDIS_PORT --daemonize yes
        sleep 1
        if redis-cli -p $REDIS_PORT ping &>/dev/null; then
            log "Redis 已启动 (端口 $REDIS_PORT)"
        else
            err "Redis 启动失败，请手动检查"
            exit 1
        fi
    else
        err "Redis 未安装，请先安装: brew install redis"
        exit 1
    fi
else
    log "Redis 已运行 (端口 $REDIS_PORT)"
fi

# ── Step 3: 检查 PostgreSQL ──
info "Step 3/5: 检查 PostgreSQL..."
if pg_isready -q 2>/dev/null; then
    log "PostgreSQL 已运行"
else
    warn "PostgreSQL 未运行，尝试启动..."
    if command -v brew &>/dev/null; then
        brew services start postgresql@17 2>/dev/null || brew services start postgresql@16 2>/dev/null || brew services start postgresql 2>/dev/null || true
        sleep 2
        if pg_isready -q 2>/dev/null; then
            log "PostgreSQL 已启动"
        else
            err "PostgreSQL 启动失败，请手动检查"
            exit 1
        fi
    else
        err "请手动启动 PostgreSQL"
        exit 1
    fi
fi

# ── Step 4: 启动后端 (Flask + Celery) ──
info "Step 4/5: 启动后端服务..."

# 激活虚拟环境并启动 Flask
cd "$BACKEND_DIR"
source venv/bin/activate

# Flask
python app.py > "$LOG_DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$LOG_DIR/backend.pid"

# Celery Worker
celery -A celery_worker.celery worker --loglevel=info --concurrency=4 > "$LOG_DIR/celery.log" 2>&1 &
CELERY_PID=$!
echo $CELERY_PID > "$LOG_DIR/celery.pid"

# 等待后端就绪
sleep 2
if curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$BACKEND_PORT/api/system/config" 2>/dev/null | grep -q "200"; then
    log "Flask 已启动 (端口 $BACKEND_PORT, PID: $BACKEND_PID)"
else
    warn "Flask 启动中... (PID: $BACKEND_PID, 日志: $LOG_DIR/backend.log)"
fi
log "Celery Worker 已启动 (PID: $CELERY_PID)"

# ── Step 5: 启动前端 ──
info "Step 5/5: 启动前端..."
cd "$FRONTEND_DIR"
npm run dev > "$LOG_DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo $FRONTEND_PID > "$LOG_DIR/frontend.pid"
sleep 2
log "Frontend 已启动 (端口 $FRONTEND_PORT, PID: $FRONTEND_PID)"

# ── 完成 ──
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         ✅ 所有服务已启动                  ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  🌐 前端:    http://localhost:$FRONTEND_PORT       ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  🔧 后端:    http://127.0.0.1:$BACKEND_PORT       ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  📦 Redis:   localhost:$REDIS_PORT              ${GREEN}║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  日志目录:   $LOG_DIR  ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  停止服务:   ./start.sh stop            ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}按 Ctrl+C 或运行 ./start.sh stop 停止所有服务${NC}"

# 保持前台运行，捕获 Ctrl+C 退出
trap 'echo ""; warn "正在停止所有服务..."; stop_all; exit 0' INT TERM

# 跟踪后端日志
tail -f "$LOG_DIR/backend.log" "$LOG_DIR/celery.log" 2>/dev/null
