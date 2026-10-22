@echo off
chcp 65001 >nul
echo ========================================================
echo   正修科技大學 3D 模擬校園導覽系統
echo   Cheng Shiu University 3D Virtual Campus Tour
echo ========================================================
echo.
echo 正在啟動本機網頁伺服器 (連接埠: 8088)...
start "" http://localhost:8088/index.html
python -m http.server 8088
pause
