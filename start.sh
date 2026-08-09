#!/bin/bash

# 前端八股面试智能辅导 Agent — 启动脚本

echo "=============================="
echo "  前端八股面试智能辅导 Agent"
echo "=============================="

# 启动后端
echo ""
echo "[1/2] 启动后端服务..."
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

# 等待后端启动
sleep 2

# 启动前端
echo ""
echo "[2/2] 启动前端开发服务器..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "=============================="
echo "  服务已启动！"
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:3001"
echo "  健康检查: http://localhost:3001/api/health"
echo "=============================="
echo "  按 Ctrl+C 停止所有服务"
echo "=============================="

# 捕获退出信号
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM

# 等待
wait
