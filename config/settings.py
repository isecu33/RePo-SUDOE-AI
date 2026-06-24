# File location: RePo-SUDOE-AI/config/settings.py
# Add these configurations to your existing settings.py file

import os
from pathlib import Path
from dotenv import load_dotenv

# Build paths inside the project.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file
load_dotenv(BASE_DIR / '.env')

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-here')  # Change this in production!

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = os.getenv('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
ALLOWED_HOSTS = [host.strip() for host in ALLOWED_HOSTS]

# Application definition for RePo-SUDOE-AI
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'frontend', 
    'accounts',
    'core',  # Molecular intelligence app
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # Add WhiteNoise for static files
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.locale.LocaleMiddleware',  # Language middleware
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'accounts.middleware.AccessControlMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],  # Global templates for RePo-SUDOE-AI
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Database configuration for RePo-SUDOE-AI
DATABASES = {
    'default': {
        'ENGINE': os.getenv('DB_ENGINE', 'django.db.backends.postgresql'),
        'NAME': os.getenv('DB_NAME', 'repo_sudoe_ai'),
        'USER': os.getenv('DB_USER', 'admin'),
        'PASSWORD': os.getenv('DB_PASSWORD', 'admin'),
        'HOST': os.getenv('DB_HOST', 'localhost'),
        'PORT': os.getenv('DB_PORT', '5432'),
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization for RePo-SUDOE-AI
LANGUAGE_CODE = 'en'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

LANGUAGES = [
    ('en', 'English'),
    ('es', 'Español'),
]

LOCALE_PATHS = [
    BASE_DIR / 'locale',
]

# Static files configuration for RePo-SUDOE-AI
STATIC_URL = '/static/'
STATICFILES_DIRS = [
    BASE_DIR / 'frontend' / 'static',
]
STATIC_ROOT = BASE_DIR / 'staticfiles'

# WhiteNoise configuration for serving static files with Gunicorn
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

# Media files configuration for RePo-SUDOE-AI
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CSRF configuration for Ajax requests in RePo-SUDOE-AI
CSRF_COOKIE_HTTPONLY = False
CSRF_TRUSTED_ORIGINS = ['http://localhost:8000', 'http://127.0.0.1:8000']

# File upload settings for RePo-SUDOE-AI
FILE_UPLOAD_MAX_MEMORY_SIZE = 5242880  # 5MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 5242880  # 5MB
FILE_UPLOAD_PERMISSIONS = 0o644

# Session configuration
SESSION_COOKIE_AGE = 86400  # 24 hours
SESSION_SAVE_EVERY_REQUEST = True

# Logging configuration for RePo-SUDOE-AI
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'ignore_favicon': {
            '()': 'django.utils.log.CallbackFilter',
            'callback': lambda record: 'favicon.ico' not in record.getMessage()
        }
    },
    'handlers': {
        'file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'repo_sudoe_ai.log',
        },
        'console': {
            'level': 'INFO',
            'class': 'logging.StreamHandler',
            'filters': ['ignore_favicon'],
        },
        'console_filtered': {
            'level': 'WARNING',
            'class': 'logging.StreamHandler',
            'filters': ['ignore_favicon'],
        },
    },
    'loggers': {
        'frontend': {
            'handlers': ['file', 'console'],
            'level': 'INFO',
            'propagate': True,
        },
        'django.request': {
            'handlers': ['console_filtered'],
            'level': 'WARNING',
            'propagate': False,
        },
    },
}

# Create logs directory if it doesn't exist
os.makedirs(BASE_DIR / 'logs', exist_ok=True)

# Custom settings for RePo-SUDOE-AI molecular docking
REPO_SUDOE_AI_SETTINGS = {
    'MAX_UPLOAD_SIZE': 50 * 1024 * 1024,  # 50MB max file size
    'ALLOWED_FORMATS': {
        'receptor': ['.pdbqt', '.pdb', '.ent', '.xyz', '.pqr', '.mcif', '.mmcif'],
        'drug': ['.pdbqt', '.can', '.mdl', '.mol', '.mol2', '.pdb', '.sd', '.sdf', '.smi', '.smiles', '.xyz'],
        'pose': ['.pdbqt', '.pdb']
    },
    'DOCKING_TIMEOUT': 3600,  # 1 hour timeout for docking simulations
    'CLEANUP_INTERVAL': 86400,  # Clean up old files every 24 hours
}

AUTH_USER_MODEL = 'accounts.CustomUser'

# OpenAI Configuration for molecular intelligence
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')

# Multi-provider AI configuration (Fase 1 - ROADMAP)
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')
ANTHROPIC_MODEL = os.getenv('ANTHROPIC_MODEL', 'claude-3-haiku-20240307')

GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
GOOGLE_MODEL = os.getenv('GOOGLE_MODEL', 'gemini-1.5-flash')

OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'llama3.1:8b')

# Clave de cifrado para las API keys de usuarios almacenadas en BD (Fase 1 - Multi-proveedor IA)
FIELD_ENCRYPTION_KEY = os.getenv('FIELD_ENCRYPTION_KEY')

# Core app settings for molecular intelligence
CORE_SETTINGS = {
    'OPENAI_MODEL': 'gpt-4o',
    'OPENAI_TEMPERATURE': 0.3,
    'MAX_STRUCTURE_CACHE_SIZE': 1000,  # Maximum cached PDB structures
    'STRUCTURE_CACHE_CLEANUP_DAYS': 30,  # Clean up unused structures after 30 days
    'MAX_CONVERSATION_CONTEXT': 10,  # Maximum messages to include in conversation context
}

# Email Configuration
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.smtp.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '587'))
EMAIL_USE_TLS = True
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')

DEFAULT_FROM_EMAIL = os.getenv('EMAIL_HOST_USER', 'noreply@repo-sudoe-ai.com')
SITE_URL = os.getenv('SITE_URL', 'http://127.0.0.1:8000')

# =============================================================================
# AutoDock Vina vía Docker (Fase 3 - ROADMAP: Docker-por-job)
# =============================================================================
VINA_DOCKER_IMAGE = os.getenv('VINA_DOCKER_IMAGE', 'cafernandezlo/dock-tools:v1.0')
VINA_MAX_PARALLEL_JOBS = int(os.getenv('VINA_MAX_PARALLEL_JOBS', '2'))
VINA_CPU_QUOTA = int(os.getenv('VINA_CPU_QUOTA', '100000'))
VINA_MEM_LIMIT = os.getenv('VINA_MEM_LIMIT', '512m')
VINA_TIMEOUT_SECONDS = int(os.getenv('VINA_TIMEOUT_SECONDS', '1200'))
# Celery (Fase 2 - ROADMAP: procesamiento asíncrono de jobs de docking)
# =============================================================================
REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_WORKER_CONCURRENCY = int(os.getenv('CELERY_CONCURRENCY', '2'))
