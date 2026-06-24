# Setup de Celery + Redis (infraestructura de tareas asíncronas)

## Contexto

`RePo-SUDOE-AI_v2` es una plataforma Django (5.1) para docking molecular asistido por IA. Actualmente, cuando un usuario lanza un experimento de docking desde el chat, la ejecución de AutoDock Vina (vía Docker, puede tardar varios minutos) ocurre **de forma síncrona** dentro de la petición HTTP (`QueryHandler.run_autodock_vina` → `DockerVinaService.run_vina_docking`), lo que bloquea el worker de Gunicorn durante todo el experimento.

`ROADMAP.md`, Fase 2 ("Celery + Redis para procesamiento asíncrono"), propone introducir Celery con Redis como broker para ejecutar el docking en segundo plano y permitir que el frontend haga *polling* del estado (Fases 2 posteriores).

Esta tarea es el **primer paso** de la Fase 2: dejar lista la infraestructura de Celery + Redis (configuración de Django, worker, docker-compose) SIN crear todavía ningún `Task` ni modificar el flujo de docking. Es una tarea de infraestructura pura, independiente del modelo `DockingJob` (tarea `06_modelo_dockingjob.md`), por lo que ambas pueden desarrollarse en paralelo.

`config/settings.py` usa `os.getenv()` (vía `python-dotenv`), NO `django-environ` (a diferencia de los ejemplos genéricos de `ROADMAP.md`, que usan `env()`). El archivo `.env.example` ya define `REDIS_URL=redis://redis:6379/0` (para Celery) y `REDIS_CHANNELS_URL=redis://redis:6379/1` (reservada para Django Channels, Fase 4 — NO se usa en esta tarea) y `CELERY_CONCURRENCY=2`.

`config/__init__.py` está actualmente vacío. `config/asgi.py` y `config/wsgi.py` ya existen y no deben modificarse en esta tarea.

## Objetivo

Al terminar, debe poder ejecutarse `celery -A config worker -l info` y conectar correctamente con Redis usando `REDIS_URL`, Django debe cargar `config.celery.app` automáticamente al arrancar, y `docker-compose.yml` debe incluir servicios `redis` y `celery_worker` listos para usarse (aunque todavía no haya ninguna tarea Celery definida).

## Pre-requisitos

Ninguna. Tarea base de infraestructura — puede ejecutarse en paralelo con `06_modelo_dockingjob.md` y con cualquier tarea de la Fase 1 (no comparten archivos).

## Archivos a crear/modificar

- `requirements.txt`: añadir `celery` y `redis`.
- `config/celery.py` (nuevo): instancia de la app Celery.
- `config/__init__.py`: importar la app Celery para que Django la registre al arrancar.
- `config/settings.py`: añadir ajustes `CELERY_*`.
- `docker-compose.yml`: añadir servicios `redis` y `celery_worker`, y hacer que `web` dependa de `redis`.

## Especificación detallada

### 1. `requirements.txt`

Añadir:

```
celery>=5.3.6
redis>=5.0.1
```

### 2. `config/celery.py` (nuevo)

```python
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
```

### 3. `config/__init__.py`

Sustituir el contenido (actualmente vacío/whitespace) por:

```python
from .celery import app as celery_app

__all__ = ('celery_app',)
```

### 4. `config/settings.py`

Añadir, después del bloque de `CORE_SETTINGS` (línea ~213) o en una sección nueva claramente identificada:

```python
# =============================================================================
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
```

`TIME_ZONE` ya está definido en `settings.py` (Django lo requiere); reutilízalo tal cual. Si por algún motivo no existe en este `settings.py` concreto, usa el literal `'Europe/Madrid'` (valor de `.env.example`).

### 5. `docker-compose.yml`

Añadir un nuevo servicio `redis` (antes del servicio `web`, después de `db`):

```yaml
  # Redis (broker de Celery; en Fase 4 también se usará para Django Channels)
  redis:
    image: redis:7-alpine
    container_name: repo-sudoe-redis
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - repo-sudoe-network
    restart: unless-stopped
```

Modificar el servicio `web` para que también dependa de `redis`:

```yaml
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
```

Añadir un nuevo servicio `celery_worker` (después de `web`, antes de `nginx`):

```yaml
  # Celery worker (ejecuta jobs de docking en segundo plano)
  celery_worker:
    build: .
    container_name: repo-sudoe-celery-worker
    command: celery -A config worker -l info --concurrency=${CELERY_CONCURRENCY:-2}
    volumes:
      - .:/app
      - media_volume:/app/media
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - repo-sudoe-network
    restart: unless-stopped
```

No es necesario montar `static_volume` en `celery_worker` (no sirve archivos estáticos).

## Dependencias nuevas

- `celery>=5.3.6` (pip)
- `redis>=5.0.1` (pip)
- Imagen Docker `redis:7-alpine` (docker-compose)

## Criterios de aceptación / cómo verificar

1. `pip install -r requirements.txt` instala `celery` y `redis` sin errores.
2. `python manage.py shell` no produce errores al importar Django (esto verifica que `config/__init__.py` y `config/celery.py` no rompen el arranque):
   ```python
   from config.celery import app as celery_app
   print(celery_app.conf.broker_url)  # debe imprimir el valor de REDIS_URL (o el default redis://localhost:6379/0)
   ```
3. Con Redis disponible (local: `docker run -p 6379:6379 redis:7-alpine`, o vía `docker-compose up redis`):
   ```
   celery -A config worker -l info
   ```
   debe arrancar sin errores y mostrar `[tasks]` (vacío o solo con `config.celery.debug_task`) y `connected to redis://...`.
4. `docker-compose config` valida la sintaxis del `docker-compose.yml` actualizado sin errores.
5. `docker-compose up redis celery_worker` (con `db` también arrancado, ya que `celery_worker` depende de `db`) arranca ambos contenedores correctamente; los logs de `celery_worker` muestran conexión exitosa a Redis.
6. `python manage.py check` sigue sin errores tras los cambios en `settings.py`.

## Fuera de alcance

- No crear `core/tasks.py` ni ninguna tarea Celery concreta (tarea `07_endpoint_docking_async_y_task.md`).
- No crear el modelo `DockingJob` (tarea `06_modelo_dockingjob.md`).
- No modificar `config/asgi.py` ni añadir `channels`/`CHANNEL_LAYERS` (eso es Fase 4, tareas `12_websockets_django_channels.md` y `13_notificaciones_progreso_websocket.md`) — `REDIS_CHANNELS_URL` no se usa en esta tarea.
- No modificar `frontend/views.py`, `core/views.py` ni ningún flujo de docking existente.
