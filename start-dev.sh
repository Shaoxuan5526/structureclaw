#!/usr/bin/env bash
# StructureClaw 本地开发一键启动脚本
# 用法：bash start-dev.sh
# 退出：Ctrl+C 会同时停止前后端

# ── 颜色 ──────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'
YELLOW='\033[1;33m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${CYAN}[start-dev]${RESET} $*"; }
ok()   { echo -e "${GREEN}[start-dev] ✓${RESET} $*"; }
warn() { echo -e "${YELLOW}[start-dev] ⚠${RESET} $*"; }
err()  { echo -e "${RED}[start-dev] ✗${RESET} $*"; }

# ── 项目根目录（脚本所在位置）────────────────────────
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"

# ── 端口 ─────────────────────────────────────────────
BACKEND_PORT=30010
FRONTEND_PORT=3000

# ── 清理函数（Ctrl+C 时触发）─────────────────────────
cleanup() {
  echo ""
  log "正在停止前后端进程..."
  [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null && ok "后端已停止 (PID $BACKEND_PID)"
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null && ok "前端已停止 (PID $FRONTEND_PID)"
  exit 0
}
trap cleanup INT TERM

# ── 检查端口是否被占用 ───────────────────────────────
kill_port() {
  local port=$1
  local pids
  pids=$(lsof -t -i:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    warn "端口 $port 被占用，正在释放..."
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
    ok "端口 $port 已释放"
  fi
}

# ── 确保数据库目录存在 ───────────────────────────────
mkdir -p "$ROOT/.runtime/data"
mkdir -p "$ROOT/.runtime/logs"

# ══════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║     StructureClaw 开发环境启动中...       ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════╝${RESET}"
echo ""

# ── 释放端口 ─────────────────────────────────────────
kill_port $BACKEND_PORT
kill_port $FRONTEND_PORT

# ── 启动后端 ─────────────────────────────────────────
log "启动后端 (Fastify · 端口 $BACKEND_PORT)..."
cd "$BACKEND_DIR"

# 确保 Prisma 已生成
if [ ! -d "node_modules" ]; then
  warn "后端 node_modules 不存在，正在安装依赖..."
  npm install
fi

if [ ! -d "node_modules/.prisma" ]; then
  log "初始化 Prisma..."
  npm run db:generate 2>/dev/null || true
  npm run db:push     2>/dev/null || true
fi

# 强制后端监听 0.0.0.0（同时支持 IPv4 和 IPv6）
HOST=0.0.0.0 npm run dev > "$ROOT/.runtime/logs/backend.log" 2>&1 &
BACKEND_PID=$!
ok "后端进程已启动 (PID $BACKEND_PID)"

# ── 等待后端就绪 ─────────────────────────────────────
log "等待后端就绪..."
MAX_WAIT=30
WAITED=0
while ! curl -s "http://127.0.0.1:$BACKEND_PORT/health" > /dev/null 2>&1; do
  sleep 1
  WAITED=$((WAITED + 1))
  if [ $WAITED -ge $MAX_WAIT ]; then
    warn "后端 ${MAX_WAIT}s 内未响应 /health，继续启动前端（后端可能仍在初始化）"
    break
  fi
done
[ $WAITED -lt $MAX_WAIT ] && ok "后端已就绪 ✓"

# ── 启动前端 ─────────────────────────────────────────
log "启动前端 (Next.js · 端口 $FRONTEND_PORT)..."
cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
  warn "前端 node_modules 不存在，正在安装依赖..."
  npm install
fi

# 强制前端监听所有网卡地址（兼容 IPv4/IPv6 和 Windows 访问 WSL 的场景）
npm run dev -- --hostname 0.0.0.0 > "$ROOT/.runtime/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
ok "前端进程已启动 (PID $FRONTEND_PID)"

# ── 等待前端就绪 ─────────────────────────────────────
log "等待前端就绪..."
WAITED=0
while ! curl -s "http://127.0.0.1:$FRONTEND_PORT" > /dev/null 2>&1; do
  sleep 1
  WAITED=$((WAITED + 1))
  if [ $WAITED -ge 30 ]; then
    warn "前端 30s 内未响应，请手动检查 .runtime/logs/frontend.log"
    break
  fi
done
[ $WAITED -lt 30 ] && ok "前端已就绪 ✓"

# ── 启动完成提示 ─────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  ✅  StructureClaw 已启动！${RESET}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════${RESET}"
echo ""
echo -e "  🌐 前端地址：${CYAN}http://localhost:$FRONTEND_PORT${RESET}"
echo -e "  🔧 后端地址：${CYAN}http://localhost:$BACKEND_PORT${RESET}"
echo ""
echo -e "  📄 后端日志：${YELLOW}$ROOT/.runtime/logs/backend.log${RESET}"
echo -e "  📄 前端日志：${YELLOW}$ROOT/.runtime/logs/frontend.log${RESET}"
echo ""
echo -e "  💡 如样式异常：浏览器按 ${BOLD}F12 → Console${RESET} 查看报错，或强制刷新 ${BOLD}Ctrl+Shift+R${RESET}"
echo -e "  ${BOLD}按 Ctrl+C 停止所有服务${RESET}"
echo ""

# ── 实时输出合并日志（带颜色前缀区分）────────────────
tail -f "$ROOT/.runtime/logs/backend.log"  | sed "s/^/${CYAN}[backend] ${RESET}/" &
tail -f "$ROOT/.runtime/logs/frontend.log" | sed "s/^/${GREEN}[frontend]${RESET}/" &

# ── 保持脚本运行，等待进程退出 ───────────────────────
wait $BACKEND_PID $FRONTEND_PID
