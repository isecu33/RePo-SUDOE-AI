@echo off
REM Script rapido para activar el entorno virtual

if not exist "venv\" (
    echo [ERROR] No existe entorno virtual
    echo Ejecuta primero: setup-venv.bat
    pause
    exit /b 1
)

call venv\Scripts\activate.bat
echo.
echo Entorno virtual activado para RePo-SUDOE-AI
echo Para desactivar, escribe: deactivate
echo.
cmd /k
