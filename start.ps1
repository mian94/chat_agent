# 前端八股面试智能辅导 Agent — Windows 启动脚本
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "  前端八股面试智能辅导 Agent" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

# 启动后端
Write-Host "`n[1/2] 启动后端服务..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
  Set-Location "$using:PWD\backend"
  npm run dev
}

Start-Sleep -Seconds 3

# 启动前端
Write-Host "[2/2] 启动前端开发服务器..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
  Set-Location "$using:PWD\frontend"
  npm run dev
}

Write-Host "`n==============================" -ForegroundColor Cyan
Write-Host "  服务已启动！" -ForegroundColor Green
Write-Host "  前端: http://localhost:5173" -ForegroundColor Green
Write-Host "  后端: http://localhost:3001" -ForegroundColor Green
Write-Host "  健康检查: http://localhost:3001/api/health" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Cyan
Write-Host "  按任意键停止所有服务" -ForegroundColor Yellow
Write-Host "==============================" -ForegroundColor Cyan

# 等待用户按键停止
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# 停止服务
Write-Host "`n正在停止服务..." -ForegroundColor Yellow
Stop-Job $backendJob -PassThru | Receive-Job | Out-Null
Stop-Job $frontendJob -PassThru | Receive-Job | Out-Null
Remove-Job $backendJob
Remove-Job $frontendJob

# 额外确保 node 进程被清理
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "服务已停止" -ForegroundColor Cyan
