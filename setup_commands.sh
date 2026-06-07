# File location: RePo-SUDOE-AI/setup_commands.sh
# Commands to set up the RePo-SUDOE-AI Django project with "config" folder

echo "Setting up RePo-SUDOE-AI Django Project with config folder..."

# 1. Create the Django project with config folder (if not already created)
echo "Creating Django project with config folder..."
# django-admin startproject config .
# This creates a 'config' folder instead of 'RePo_SUDOE_AI'

# 2. Create the frontend app (if not already created)
echo "Creating frontend app for RePo-SUDOE-AI..."
python manage.py startapp frontend

# 3. Create necessary directories for RePo-SUDOE-AI
echo "Creating directory structure for RePo-SUDOE-AI..."
mkdir -p frontend/static/frontend/css
mkdir -p frontend/static/frontend/js
mkdir -p frontend/static/frontend/img
mkdir -p frontend/templates/frontend
mkdir -p media/uploads/receptors
mkdir -p media/uploads/drugs
mkdir -p media/uploads/poses
mkdir -p logs

# 4. Update settings.py to include RePo-SUDOE-AI frontend app
echo "Don't forget to add 'frontend' to INSTALLED_APPS in config/settings.py"
echo "Also update ROOT_URLCONF = 'config.urls' in config/settings.py"
echo "And WSGI_APPLICATION = 'config.wsgi.application' in config/settings.py"

# 5. Create and apply migrations for RePo-SUDOE-AI
echo "Creating migrations for RePo-SUDOE-AI..."
python manage.py makemigrations frontend
python manage.py migrate

# 6. Create superuser for RePo-SUDOE-AI admin (optional)
echo "Creating superuser for RePo-SUDOE-AI admin..."
python manage.py createsuperuser

# 7. Collect static files for RePo-SUDOE-AI (for production)
echo "Collecting static files for RePo-SUDOE-AI..."
python manage.py collectstatic --noinput

# 8. Run the RePo-SUDOE-AI development server
echo "Starting RePo-SUDOE-AI development server..."
python manage.py runserver

# File structure should look like this:
echo "Your project structure should be:"
echo "RePo-SUDOE-AI/"
echo "├── manage.py"
echo "├── db.sqlite3"
echo "├── logs/"
echo "├── media/"
echo "├── staticfiles/"
echo "├── config/              # <-- Django configuration folder"
echo "│   ├── __init__.py"
echo "│   ├── settings.py"
echo "│   ├── urls.py"
echo "│   ├── wsgi.py"
echo "│   └── asgi.py"
echo "└── frontend/"
echo "    ├── models.py"
echo "    ├── views.py"
echo "    ├── urls.py"
echo "    ├── admin.py"
echo "    ├── static/"
echo "    └── templates/"

# Additional dependencies you might need for RePo-SUDOE-AI:
echo "Additional packages that might be useful for RePo-SUDOE-AI:"
echo "pip install pillow  # For image handling"
echo "pip install django-cors-headers  # If you need CORS"
echo "pip install celery  # For async tasks (docking simulations)"
echo "pip install redis  # For Celery broker"
echo "pip install gunicorn  # For production WSGI server"
echo "pip install whitenoise  # For serving static files in production"

# For molecular docking libraries (install as needed):
echo "Molecular docking libraries for RePo-SUDOE-AI:"
echo "pip install biopython  # For biological data structures"
echo "pip install rdkit  # For cheminformatics"
echo "pip install openeye-toolkits  # If you have OpenEye license"
echo "pip install pymol  # For molecular visualization"