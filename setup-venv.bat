@echo off
REM Script para crear y configurar entorno virtual para RePo-SUDOE-AI

echo =========================================
echo Configuracion de Entorno Virtual
echo RePo-SUDOE-AI
echo =========================================
echo.

REM Verificar si Python esta instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python no esta instalado
    echo Por favor, instala Python 3.11 o 3.12 desde https://www.python.org/downloads/
    pause
    exit /b 1
)

echo [OK] Python encontrado:
python --version

REM Verificar version de Python
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VERSION=%%i
echo.
echo [INFO] Version detectada: %PYTHON_VERSION%
echo [INFO] Se recomienda Python 3.11 o 3.12 para compatibilidad con RDKit
echo.

REM Verificar si ya existe un entorno virtual
if exist "venv\" (
    echo [AVISO] Ya existe un entorno virtual en la carpeta 'venv'
    set /p recreate="¿Quieres recrearlo? (s/n): "
    if /i "%recreate%"=="s" (
        echo Eliminando entorno virtual anterior...
        rmdir /s /q venv
    ) else (
        echo Usando entorno virtual existente
        goto :activate
    )
)

REM Crear entorno virtual
echo.
echo [1/4] Creando entorno virtual...
python -m venv venv
if errorlevel 1 (
    echo [ERROR] No se pudo crear el entorno virtual
    pause
    exit /b 1
)
echo [OK] Entorno virtual creado
echo.

:activate
REM Activar entorno virtual
echo [2/4] Activando entorno virtual...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo [ERROR] No se pudo activar el entorno virtual
    pause
    exit /b 1
)
echo [OK] Entorno virtual activado
echo.

REM Actualizar pip
echo [3/4] Actualizando pip...
python -m pip install --upgrade pip
echo.

REM Instalar dependencias
echo [4/4] Instalando dependencias...
if exist "requirements.txt" (
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Error al instalar dependencias
        pause
        exit /b 1
    )
    echo [OK] Dependencias instaladas desde requirements.txt
) else (
    echo [AVISO] No se encontro requirements.txt
    echo Instalando paquetes basicos...
    pip install django psycopg2-binary python-dotenv requests beautifulsoup4
)
echo.

REM Instalar dependencias de produccion (opcional)
if exist "requirements-production.txt" (
    set /p install_prod="¿Instalar dependencias de produccion (gunicorn, etc.)? (s/n): "
    if /i "%install_prod%"=="s" (
        pip install gunicorn
        echo [OK] Dependencias de produccion instaladas
    )
)
echo.

echo =========================================
echo Configuracion Completada!
echo =========================================
echo.
echo El entorno virtual esta activo.
echo.
echo Comandos utiles:
echo   - Activar entorno: venv\Scripts\activate
echo   - Desactivar: deactivate
echo   - Ejecutar Django: python manage.py runserver
echo   - Migraciones: python manage.py migrate
echo   - Crear superusuario: python manage.py createsuperuser
echo.
echo Para desarrollo local:
echo   1. Asegurate de tener PostgreSQL corriendo (o usa Docker)
echo   2. Configura tu archivo .env
echo   3. Ejecuta: python manage.py migrate
echo   4. Ejecuta: python manage.py runserver
echo.
pause
