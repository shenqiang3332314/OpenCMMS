@echo off
chcp 65001 >nul
title CMMS系统启动器

echo.
echo 🏭 CMMS设备维护管理系统
echo ========================
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到Python，请先安装Python 3.8或更高版本
    echo    下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM 检查是否已安装依赖
echo 🔄 检查依赖...
python -c "import django; import rest_framework; import jwt; import pandas; import openpyxl" >nul 2>&1
if errorlevel 1 (
    echo 📦 首次运行，正在安装依赖包...
    echo.

    REM 安装依赖
    echo 🔄 安装依赖包...
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )

    REM 数据库迁移
    echo 🔄 设置数据库...
    python manage.py makemigrations
    python manage.py migrate

    REM 创建管理员账户
    echo 🔄 创建管理员账户...
    python manage.py shell -c "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.create_superuser('admin', 'admin@example.com', 'admin123', role='admin', full_name='System Administrator') if not User.objects.filter(username='admin').exists() else print('Admin already exists')"

    REM 收集静态文件
    echo 🔄 收集静态文件...
    python manage.py collectstatic --noinput

    echo ✅ 系统设置完成！
    echo.
) else (
    echo ✅ 依赖已安装
)

REM 获取本机IP地址
set LOCAL_IP=未知IP
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr "IPv4" ^| findstr /v "127.0.0.1"') do (
    for /f "tokens=1" %%j in ("%%i") do (
        set LOCAL_IP=%%j
        goto :found_ip
    )
)
:found_ip
REM 去除IP地址前后的空格
for /f "tokens=* delims= " %%a in ("%LOCAL_IP%") do set LOCAL_IP=%%a

echo.
echo 🚀 启动CMMS系统...
echo.
echo 📋 系统信息:
echo    管理员账户: admin
echo    管理员密码: admin123
echo    本机访问: http://127.0.0.1:8000
echo    局域网访问: http://%LOCAL_IP%:8000
echo    前端界面: http://%LOCAL_IP%:8000/static/index.html
echo    管理后台: http://%LOCAL_IP%:8000/admin
echo.
echo 💡 按 Ctrl+C 停止服务器
echo.

REM 启动Django服务器，绑定到所有网络接口
python manage.py runserver 0.0.0.0:8000

echo.
echo 👋 服务器已停止
pause