#!/usr/bin/env python
"""
CMMS 系统启动脚本
功能：检查依赖、安装缺失的库、执行数据库迁移、启动服务
"""
import os
import sys
import subprocess
import importlib
from pathlib import Path


# 项目根目录
BASE_DIR = Path(__file__).resolve().parent

# 需要检查的依赖包
REQUIRED_PACKAGES = [
    'django',
    'djangorestframework',
    'rest_framework',
    'corsheaders',
    'celery',
    'redis',
    'jwt',
    'pandas',
    'openpyxl',
    'pytest',
    'factory',
    'faker',
]


def print_header(text: str):
    """打印标题"""
    print("\n" + "=" * 60)
    print(f"  {text}")
    print("=" * 60)


def print_step(text: str):
    """打印步骤"""
    print(f"\n>>> {text}")


def print_success(text: str):
    """打印成功信息"""
    print(f"    [OK] {text}")


def print_error(text: str):
    """打印错误信息"""
    print(f"    [ERROR] {text}")


def print_warning(text: str):
    """打印警告信息"""
    print(f"    [WARN] {text}")


def check_python_version():
    """检查Python版本"""
    print_step("检查Python版本...")
    version = sys.version_info
    print(f"    当前Python版本: {version.major}.{version.minor}.{version.micro}")

    if version.major < 3 or (version.major == 3 and version.minor < 10):
        print_error("需要Python 3.10或更高版本")
        return False

    print_success("Python版本符合要求")
    return True


def check_package_installed(package_name: str) -> bool:
    """检查包是否已安装"""
    try:
        importlib.import_module(package_name)
        return True
    except ImportError:
        return False


def get_installed_packages():
    """获取已安装的包列表"""
    print_step("检查已安装的依赖包...")

    installed = []
    missing = []

    for package in REQUIRED_PACKAGES:
        if check_package_installed(package):
            try:
                mod = importlib.import_module(package)
                version = getattr(mod, '__version__', 'unknown')
                installed.append((package, version))
                print_success(f"{package}: {version}")
            except Exception:
                installed.append((package, 'installed'))
        else:
            missing.append(package)
            print_warning(f"{package}: 未安装")

    return installed, missing


def install_dependencies():
    """安装依赖"""
    print_step("安装依赖包...")
    requirements_file = BASE_DIR / "requirements.txt"

    if not requirements_file.exists():
        print_error("未找到 requirements.txt 文件")
        return False

    try:
        # 使用pip安装依赖
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", "-r", str(requirements_file)
        ])
        print_success("依赖包安装完成")
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"依赖包安装失败: {e}")
        return False


def run_migrations():
    """执行数据库迁移"""
    print_step("执行数据库迁移...")

    try:
        # 检查是否有迁移文件
        subprocess.check_call([
            sys.executable, "manage.py", "showmigrations"
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except subprocess.CalledProcessError:
        print_warning("未找到迁移文件，跳过迁移步骤")
        return True

    try:
        # 执行迁移
        subprocess.check_call([sys.executable, "manage.py", "migrate"])
        print_success("数据库迁移完成")
        return True
    except subprocess.CalledProcessError as e:
        print_error(f"数据库迁移失败: {e}")
        return False


def start_server():
    """启动Django开发服务器"""
    print_step("启动Django开发服务器...")

    host = os.environ.get("DJANGO_HOST", "127.0.0.1")
    port = os.environ.get("DJANGO_PORT", "8000")

    print(f"    访问地址: http://{host}:{port}")
    print(f"    管理后台: http://{host}:{port}/admin")
    print("\n按 Ctrl+C 停止服务器\n")

    try:
        subprocess.call([sys.executable, "manage.py", "runserver", f"{host}:{port}"])
    except KeyboardInterrupt:
        print("\n服务器已停止")
    except Exception as e:
        print_error(f"启动服务器失败: {e}")
        return False

    return True


def create_superuser():
    """询问是否创建超级用户"""
    print_step("是否创建超级用户? (y/n): ", end="")
    choice = input().strip().lower()

    if choice == 'y':
        try:
            subprocess.call([sys.executable, "manage.py", "createsuperuser"])
        except Exception as e:
            print_error(f"创建超级用户失败: {e}")
    else:
        print("跳过创建超级用户")


def main():
    """主函数"""
    print_header("CMMS 设备维护保养系统启动脚本")

    # 1. 检查Python版本
    if not check_python_version():
        sys.exit(1)

    # 2. 检查依赖
    installed, missing = get_installed_packages()

    # 3. 安装缺失的依赖
    if missing:
        print_warning(f"发现 {len(missing)} 个未安装的依赖包")
        response = input("    是否立即安装? (y/n): ").strip().lower()

        if response == 'y':
            if not install_dependencies():
                sys.exit(1)
        else:
            print_error("缺少必要的依赖包，无法启动系统")
            sys.exit(1)
    else:
        print_success("所有依赖包已安装")

    # 4. 设置Django环境
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cmms_project.settings')

    # 5. 执行数据库迁移
    if not run_migrations():
        print_warning("数据库迁移有问题，但继续启动...")

    # 6. 询问是否创建超级用户（可选）
    create_superuser()

    # 7. 启动服务器
    print_header("启动服务")
    start_server()


if __name__ == "__main__":
    main()
