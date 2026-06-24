import os

from celery import Celery

# Asegura que Django esté configurado antes de inicializar Celery
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('repo_sudoe_ai')

# Lee la configuración de Celery desde settings.py, usando el prefijo CELERY_
# (p.ej. settings.CELERY_BROKER_URL -> app.conf.broker_url)
app.config_from_object('django.conf:settings', namespace='CELERY')

# Descubre automáticamente los módulos tasks.py de cada app instalada
# (core/tasks.py se creará en la tarea 07_endpoint_docking_async_y_task.md)
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')
