#!/bin/bash
# WSL Deployment script for RePo-SUDOE-AI with Gunicorn

set -e  # Exit on error

echo "========================================="
echo "RePo-SUDOE-AI WSL Deployment"
echo "========================================="
echo

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
VENV_DIR="venv-wsl"
WORKERS=${GUNICORN_WORKERS:-4}
THREADS=${GUNICORN_THREADS:-2}
PORT=${PORT:-8000}
TIMEOUT=${GUNICORN_TIMEOUT:-60}

echo "1. Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Error: Python3 is not installed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Python3 found: $(python3 --version)${NC}"
echo

echo "2. Setting up virtual environment..."
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating new virtual environment in $VENV_DIR..."
    python3 -m venv "$VENV_DIR"
    echo -e "${GREEN}✓ Virtual environment created${NC}"
else
    echo -e "${YELLOW}Virtual environment already exists${NC}"
fi
echo

echo "3. Activating virtual environment..."
source "$VENV_DIR/bin/activate"
echo -e "${GREEN}✓ Virtual environment activated${NC}"
echo

echo "4. Upgrading pip..."
pip install --upgrade pip
echo

echo "5. Installing dependencies from requirements.txt..."
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
    echo -e "${GREEN}✓ Dependencies installed${NC}"
else
    echo -e "${RED}Error: requirements.txt not found${NC}"
    exit 1
fi
echo

echo "6. Checking .env file..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo -e "${YELLOW}Warning: .env not found. Copying from .env.example...${NC}"
        cp .env.example .env
        echo -e "${YELLOW}Please edit .env file with your settings before running the server${NC}"
    else
        echo -e "${YELLOW}Warning: .env file not found${NC}"
    fi
else
    echo -e "${GREEN}✓ .env file found${NC}"
fi
echo

echo "7. Running database migrations..."
python manage.py migrate
echo -e "${GREEN}✓ Migrations completed${NC}"
echo

echo "8. Collecting static files..."
python manage.py collectstatic --noinput
echo -e "${GREEN}✓ Static files collected${NC}"
echo

echo "========================================="
echo "Deployment completed successfully!"
echo "========================================="
echo
echo -e "${GREEN}Starting Gunicorn server...${NC}"
echo
echo "Configuration:"
echo "  - Workers: $WORKERS"
echo "  - Threads per worker: $THREADS"
echo "  - Port: $PORT"
echo "  - Timeout: ${TIMEOUT}s"
echo
echo "Server will be available at: http://localhost:$PORT"
echo "Admin panel: http://localhost:$PORT/admin"
echo
echo "Press Ctrl+C to stop the server"
echo "========================================="
echo

# Start Gunicorn
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:$PORT \
    --workers $WORKERS \
    --threads $THREADS \
    --timeout $TIMEOUT \
    --access-logfile - \
    --error-logfile - \
    --log-level info \
    --reload
