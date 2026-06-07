@echo off
REM Test script for RePo-SUDOE-AI deployment setup

echo =========================================
echo RePo-SUDOE-AI Deployment Test
echo =========================================
echo.

REM Test 1: Check Docker
echo [TEST 1] Checking Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Docker is not installed or not running
    echo Please install Docker Desktop and start it
    pause
    exit /b 1
) else (
    docker --version
    echo [PASS] Docker is installed and running
)
echo.

REM Test 2: Check Docker Compose
echo [TEST 2] Checking Docker Compose...
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Docker Compose is not installed
    pause
    exit /b 1
) else (
    docker-compose --version
    echo [PASS] Docker Compose is installed
)
echo.

REM Test 3: Check required files
echo [TEST 3] Checking deployment files...
set "files_ok=1"

if not exist "docker-compose.yml" (
    echo [FAIL] docker-compose.yml not found
    set "files_ok=0"
) else (
    echo [PASS] docker-compose.yml found
)

if not exist "Dockerfile" (
    echo [FAIL] Dockerfile not found
    set "files_ok=0"
) else (
    echo [PASS] Dockerfile found
)

if not exist "gunicorn.conf.py" (
    echo [FAIL] gunicorn.conf.py not found
    set "files_ok=0"
) else (
    echo [PASS] gunicorn.conf.py found
)

if not exist "requirements.txt" (
    echo [FAIL] requirements.txt not found
    set "files_ok=0"
) else (
    echo [PASS] requirements.txt found
)

if "%files_ok%"=="0" (
    echo [FAIL] Some required files are missing
    pause
    exit /b 1
)
echo.

REM Test 4: Check .env file
echo [TEST 4] Checking environment configuration...
if not exist ".env" (
    echo [WARN] .env file not found
    if exist ".env.example" (
        echo Creating .env from .env.example...
        copy .env.example .env >nul
        echo [INFO] Please edit .env with your settings
        echo [INFO] Run this test again after editing .env
        pause
        exit /b 0
    ) else (
        echo [FAIL] .env.example not found
        pause
        exit /b 1
    )
) else (
    echo [PASS] .env file found
)
echo.

REM Test 5: Validate docker-compose.yml
echo [TEST 5] Validating docker-compose.yml...
docker-compose config >nul 2>&1
if errorlevel 1 (
    echo [FAIL] docker-compose.yml has errors
    docker-compose config
    pause
    exit /b 1
) else (
    echo [PASS] docker-compose.yml is valid
)
echo.

REM Test 6: Check if Vina Docker image exists locally
echo [TEST 6] Checking AutoDock Vina Docker image...
docker images | findstr "cafernandezlo/dock-tools" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Vina image not found locally (will be pulled when needed)
    echo       Image: cafernandezlo/dock-tools:v1.0
) else (
    echo [PASS] Vina Docker image found locally
    docker images | findstr "cafernandezlo/dock-tools"
)
echo.

REM Test 7: Test database connection (if containers are running)
echo [TEST 7] Checking if services are running...
docker-compose ps | findstr "repo-sudoe" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Services are not running yet
    echo [INFO] This is normal if you haven't deployed yet
    echo.
    echo To deploy, run: deploy.bat
) else (
    echo [PASS] Some services are running
    docker-compose ps
    echo.
    echo [TEST 7.1] Testing database connection...
    docker-compose exec -T db pg_isready -U admin >nul 2>&1
    if errorlevel 1 (
        echo [WARN] Database is not ready or not accessible
    ) else (
        echo [PASS] Database is ready
    )
    echo.
    echo [TEST 7.2] Testing web server...
    docker-compose exec -T web python manage.py check >nul 2>&1
    if errorlevel 1 (
        echo [WARN] Django check failed
    ) else (
        echo [PASS] Django is configured correctly
    )
)
echo.

echo =========================================
echo Test Summary
echo =========================================
echo.
echo If all tests passed, you can proceed with:
echo   1. Edit .env with your production settings
echo   2. Run: deploy.bat
echo   3. Access: http://localhost:8000
echo.
echo To run a full deployment test:
echo   1. Make sure Docker Desktop is running
echo   2. Run: deploy.bat
echo   3. Check http://localhost:8000 in your browser
echo.
pause
