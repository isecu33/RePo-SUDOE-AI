@echo off
REM Script para ejecutar el servidor de desarrollo

echo =========================================
echo RePo-SUDOE-AI - Servidor de Desarrollo
echo =========================================
echo.

REM Verificar entorno virtual
if not exist "venv\" (
    echo [ERROR] No existe entorno virtual
    echo Ejecuta primero: setup-venv.bat
    pause
    exit /b 1
)

REM Activar entorno virtual
call venv\Scripts\activate.bat

REM Verificar .env
if not exist ".env" (
    echo [AVISO] No existe archivo .env
    if exist ".env.example" (
        echo Creando .env desde .env.example...
        copy .env.example .env
        echo.
        echo [INFO] Por favor edita .env con tu configuracion
        echo Para desarrollo local, asegurate de configurar:
        echo   - DEBUG=True
        echo   - DB_HOST=localhost
        echo.
    )
)

REM Verificar si hay migraciones pendientes
echo Verificando migraciones...
python manage.py showmigrations --plan | findstr "\[ \]" >nul 2>&1
if not errorlevel 1 (
    echo.
    echo [AVISO] Hay migraciones pendientes
    set /p migrate="¿Ejecutar migraciones? (s/n): "
    if /i "%migrate%"=="s" (
        python manage.py migrate
    )
    echo.
)

REM Ejecutar servidor
echo.
echo Iniciando servidor de desarrollo...
echo URL: http://localhost:8000
echo.
echo Para detener el servidor, presiona Ctrl+C
echo.
python manage.py runserver

pause
