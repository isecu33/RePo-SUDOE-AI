# Infraestructura WebSocket: Django Channels + Daphne

## Contexto

`RePo-SUDOE-AI_v2` es una plataforma Django de docking molecular asistido por IA. Tras la Fase 2 (Celery + `DockingJob`, tareas `06`-`09`), el frontend conoce el estado de un experimento de docking mediante *polling* HTTP (`frontend/src/services/jobPolling.ts`, cada 5s, hasta 240 intentos).

`ROADMAP.md`, Fase 4 ("WebSockets para progreso en tiempo real"), propone sustituir ese polling por notificaciones push vía WebSocket usando Django Channels + Daphne, con Redis como *channel layer*.

Esta tarea construye **solo la infraestructura** de Channels: instalación, configuración de Django (`INSTALLED_APPS`, `CHANNEL_LAYERS`, `ASGI_APPLICATION`), reescritura de `config/asgi.py` con `ProtocolTypeRouter`, un consumer WebSocket (`core/consumers.py`) que autentica al usuario y verifica que el `DockingJob` solicitado le pertenece, las rutas WS (`core/routing.py`), y el cambio del servidor de aplicación en `docker-compose.yml` (de Gunicorn a Daphne). **NO** incluye enviar notificaciones reales desde Celery ni tocar el frontend — eso es la tarea `13_notificaciones_progreso_websocket.md`, que depende de esta.

`config/asgi.py` actualmente es el archivo mínimo generado por `django-admin startproject`:

```python
import os
from django.core.asgi import get_asgi_application
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
application = get_asgi_application()
```

`config/settings.py` (líneas 24-34) define `INSTALLED_APPS` así:

```python
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
```

y termina con `WSGI_APPLICATION = 'config.wsgi.application'` (línea 66). No existen actualmente `ASGI_APPLICATION` ni `CHANNEL_LAYERS`. Tampoco existen `core/consumers.py` ni `core/routing.py`.

`.env.example` ya define `REDIS_CHANNELS_URL` (reservada para esta fase, base de datos Redis 1, separada de `REDIS_URL` que usa Celery en la base de datos 0 — ver `agent_plans/05_setup_celery_redis.md`). El proyecto usa `os.getenv(...)` directamente (con `python-dotenv`), NO `django-environ`'s `env()` — los ejemplos de `ROADMAP.md` usan `env()`, pero esta tarea debe usar `os.getenv(...)` para ser consistente con el resto de `settings.py`.

El modelo `core.models.DockingJob` (tarea `06_modelo_dockingjob.md`) tiene `id` (UUID), `user` (FK a `settings.AUTH_USER_MODEL`), `status` (`pending|running|completed|failed`), `progress` (0-100). `core/urls.py` usa `app_name = 'core'` y se incluye en `config/urls.py` bajo el prefijo `core/` (las rutas WS NO usan ese prefijo — Channels enruta WS de forma independiente del `ROOT_URLCONF` HTTP, normalmente bajo `ws/...`).

Consulta `ROADMAP.md`, Fase 4 (línea ~733), para el ejemplo genérico en el que se basa esta tarea (adaptado aquí a los nombres reales del proyecto: `DockingJob`, `os.getenv`, `REDIS_CHANNELS_URL`).

## Objetivo

Al terminar, el proyecto debe arrancar con Daphne sirviendo tanto HTTP (vía `ProtocolTypeRouter`/`get_asgi_application`) como WebSocket; un cliente WS autenticado debe poder conectarse a `ws://<host>/ws/docking-jobs/<job_id>/` y recibir un mensaje JSON inicial con el estado del job, SOLO si el job pertenece al usuario autenticado (en caso contrario la conexión se cierra). El channel layer debe estar configurado sobre Redis (`REDIS_CHANNELS_URL`), listo para que la tarea `13` envíe actualizaciones reales mediante `channel_layer.group_send(f'docking_job_{job_id}', {...})`.

## Pre-requisitos

- `06_modelo_dockingjob.md` (modelo `DockingJob`, ya completada): el consumer consulta este modelo para verificar la propiedad del job.
- `05_setup_celery_redis.md` (ya completada como plan): añade el servicio `redis` a `docker-compose.yml`. Esta tarea reutiliza ESE MISMO servicio Redis (base de datos 1, vía `REDIS_CHANNELS_URL`) como channel layer — no crea un segundo contenedor Redis.

No depende de `07`-`11` (no comparte archivos con la lógica de `query_handler.py`, `tasks.py` ni `vina_service.py`/`docker_runner.py`).

## Archivos a crear/modificar

- `requirements.txt`: añadir `channels[daphne]` y `channels-redis`.
- `config/settings.py`: añadir `'daphne'` y `'channels'` a `INSTALLED_APPS`, y nuevas variables `ASGI_APPLICATION` y `CHANNEL_LAYERS`.
- `config/asgi.py`: reescribir con `ProtocolTypeRouter` + `AuthMiddlewareStack` + `AllowedHostsOriginValidator`.
- `core/consumers.py` (nuevo): `DockingJobConsumer`.
- `core/routing.py` (nuevo): `websocket_urlpatterns`.
- `docker-compose.yml`: cambiar el `command` del servicio `web` de Gunicorn a Daphne; añadir `depends_on: redis` si no está ya (ver tarea 05).

## Especificación detallada

### 1. `requirements.txt`

Añade:

```
channels[daphne]==4.1.0
channels-redis==4.2.0
```

### 2. `config/settings.py` — `INSTALLED_APPS`

`'daphne'` debe ir **el primero** de la lista (requisito de Channels para que `runserver` use el servidor de desarrollo de Daphne en lugar del de Django; no afecta a Daphne en producción, pero es la convención recomendada). `'channels'` puede ir en cualquier posición posterior:

```python
INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'channels',
    'frontend',
    'accounts',
    'core',  # Molecular intelligence app
]
```

### 3. `config/settings.py` — `ASGI_APPLICATION` y `CHANNEL_LAYERS`

Añade, cerca de `WSGI_APPLICATION = 'config.wsgi.application'` (línea 66) o en una nueva sección claramente identificada:

```python
ASGI_APPLICATION = 'config.asgi.application'

# =============================================================================
# Django Channels (Fase 4 - ROADMAP: WebSockets para progreso en tiempo real)
# =============================================================================
# REDIS_CHANNELS_URL usa una base de datos Redis distinta (db 1) de la usada
# por Celery (REDIS_URL, db 0) - ver agent_plans/05_setup_celery_redis.md.
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [os.getenv('REDIS_CHANNELS_URL', 'redis://redis:6379/1')],
        },
    },
}
```

`WSGI_APPLICATION` puede dejarse tal cual (no es necesario eliminarla; algunas herramientas todavía la referencian, y no interfiere con Daphne).

### 4. `config/asgi.py` (reescribir completo)

```python
"""
ASGI config for RePo-SUDOE-AI project.

Expone una aplicación ASGI que enruta:
- Peticiones HTTP normales -> aplicación Django habitual.
- Conexiones WebSocket (`ws://.../ws/...`) -> Channels (core/routing.py),
  con autenticación basada en sesión (AuthMiddlewareStack) y validación
  de origen (AllowedHostsOriginValidator, usa ALLOWED_HOSTS).

Fase 4 del ROADMAP ("WebSockets para progreso en tiempo real").
"""

import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# get_asgi_application() llama internamente a django.setup(); debe ejecutarse
# ANTES de importar módulos que usen modelos/apps de Django (core.routing
# importa core.consumers, que importa core.models.DockingJob).
from django.core.asgi import get_asgi_application  # noqa: E402

django_asgi_app = get_asgi_application()

from channels.auth import AuthMiddlewareStack  # noqa: E402
from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402

import core.routing  # noqa: E402

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        AuthMiddlewareStack(
            URLRouter(core.routing.websocket_urlpatterns)
        )
    ),
})
```

Notas:
- `AllowedHostsOriginValidator` reutiliza `settings.ALLOWED_HOSTS` (ya definido, línea ~20 de `settings.py`) para rechazar conexiones WS con cabecera `Origin` no permitida.
- `AuthMiddlewareStack` usa las sesiones de Django (cookie de sesión) para poblar `scope['user']` — el mismo mecanismo de autenticación que ya usa el resto de la aplicación (no requiere cambios en `accounts`). NOTA: `accounts.middleware.AccessControlMiddleware` es middleware HTTP (WSGI) y NO se ejecuta para conexiones WebSocket; el control de acceso para WS se hace explícitamente en `DockingJobConsumer.connect()` (paso 6).

### 5. `core/routing.py` (nuevo)

```python
"""
Rutas WebSocket de la app `core` (Fase 4 del ROADMAP).
"""

from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(
        r'^ws/docking-jobs/(?P<job_id>[0-9a-fA-F-]+)/$',
        consumers.DockingJobConsumer.as_asgi(),
    ),
]
```

`job_id` se captura como cadena (formato UUID con guiones); el consumer lo convierte/usa directamente en una consulta `DockingJob.objects.get(id=job_id, ...)` (Django acepta una cadena UUID válida en un `UUIDField`).

### 6. `core/consumers.py` (nuevo)

```python
"""
Consumers WebSocket de la app `core` (Fase 4 del ROADMAP).

DockingJobConsumer: permite a un cliente autenticado suscribirse a las
actualizaciones de un DockingJob propio. La tarea
13_notificaciones_progreso_websocket.md envía mensajes al grupo
`docking_job_<job_id>` (vía channel_layer.group_send) cuando el job de
Celery (core/tasks.run_docking_job) cambia de estado; este consumer los
reenvía al cliente como JSON.
"""

import json
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer

logger = logging.getLogger(__name__)


class DockingJobConsumer(AsyncWebsocketConsumer):
    """
    Ruta: ws/docking-jobs/<job_id>/

    - Solo acepta la conexión si el usuario está autenticado (sesión válida)
      Y el DockingJob `job_id` pertenece a ese usuario. En caso contrario,
      cierra la conexión sin aceptarla:
        - usuario no autenticado -> close(code=4001)
        - job inexistente -> close(code=4004)
        - job de otro usuario -> close(code=4003)
    - Al aceptar, une el canal al grupo `docking_job_<job_id>` y envía un
      mensaje inicial `{"type": "connection_established", "job_id", "status",
      "progress"}` con el estado actual del job.
    - `job_update`: handler invocado cuando algo hace
      `channel_layer.group_send(f'docking_job_{job_id}', {"type": "job_update",
      "data": {...}})` (tarea 13). Reenvía `data` tal cual al cliente como JSON.
    """

    async def connect(self):
        self.job_id = self.scope['url_route']['kwargs']['job_id']
        user = self.scope['user']

        if not user.is_authenticated:
            await self.close(code=4001)
            return

        job = await self._get_job(self.job_id)
        if job is None:
            await self.close(code=4004)
            return

        if job.user_id != user.id:
            await self.close(code=4003)
            return

        self.group_name = f'docking_job_{self.job_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'job_id': str(job.id),
            'status': job.status,
            'progress': job.progress,
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def job_update(self, event):
        """Maneja mensajes de tipo 'job_update' enviados al grupo y los
        reenvía al cliente WebSocket como JSON."""
        await self.send(text_data=json.dumps(event['data']))

    @database_sync_to_async
    def _get_job(self, job_id):
        from core.models import DockingJob
        try:
            return DockingJob.objects.get(id=job_id)
        except (DockingJob.DoesNotExist, ValueError, ValidationError):
            return None
```

`ValidationError` viene de `django.core.exceptions` — si `job_id` no es un UUID válido, `DockingJob.objects.get(id=job_id)` puede lanzar `ValueError` o `django.core.exceptions.ValidationError` según la versión de Django/el backend de BD; añade el import correspondiente al inicio del archivo:

```python
from django.core.exceptions import ValidationError
```

### 7. `docker-compose.yml`

Sustituye el `command` del servicio `web` (líneas 30-35) — actualmente Gunicorn — por Daphne, que sirve tanto HTTP como WebSocket a través de `config.asgi:application`:

```yaml
  web:
    build: .
    container_name: repo-sudoe-web
    command: >
      bash -c "
        python manage.py migrate &&
        python manage.py collectstatic --noinput &&
        daphne -b 0.0.0.0 -p 8000 config.asgi:application
      "
    volumes:
      - .:/app
      - static_volume:/app/staticfiles
      - media_volume:/app/media
    ports:
      - "${WEB_PORT:-8000}:8000"
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

Notas:
- `depends_on: redis` ya debería existir o haberse añadido por la tarea `05_setup_celery_redis.md` (que define el servicio `redis` con healthcheck); si `05` ya está aplicada en este `docker-compose.yml`, simplemente añade la entrada `redis: condition: service_healthy` al `depends_on` existente del servicio `web` (no dupliques la clave `depends_on`). Si por algún motivo el servicio `redis` NO existe todavía en `docker-compose.yml`, esta tarea debe añadirlo (copia la definición exacta de `05_setup_celery_redis.md`, sección "1. `docker-compose.yml`") — el channel layer de Channels necesita Redis para funcionar igual que Celery.
- `gunicorn.conf.py` deja de usarse para el servicio `web`, pero NO debe eliminarse del repositorio (puede seguir usándose en otros contextos o entornos; eliminarlo está fuera del alcance de esta tarea).
- El servicio `nginx` (perfil `production`) hace proxy a `web:8000` vía `nginx.conf`; para que el proxy soporte el *upgrade* de conexión a WebSocket (`Upgrade`/`Connection` headers) haría falta modificar `nginx.conf`. Esto queda **fuera de alcance** de esta tarea (ver sección "Fuera de alcance") — en desarrollo (`docker-compose up` sin perfil `production`), el puerto `${WEB_PORT:-8000}` de `web` ya sirve WS directamente.

## Dependencias nuevas

- `channels[daphne]==4.1.0` (pip) — Django Channels + servidor ASGI Daphne.
- `channels-redis==4.2.0` (pip) — channel layer sobre Redis.

## Criterios de aceptación / cómo verificar

1. `pip install -r requirements.txt` instala `channels`, `daphne` y `channels_redis` sin errores.
2. `python manage.py check` no produce errores tras los cambios en `INSTALLED_APPS`/`ASGI_APPLICATION`/`CHANNEL_LAYERS`.
3. En `python manage.py shell`:
   ```python
   from django.conf import settings
   assert settings.ASGI_APPLICATION == 'config.asgi.application'
   assert 'channels' in settings.INSTALLED_APPS
   assert settings.CHANNEL_LAYERS['default']['BACKEND'] == 'channels_redis.core.RedisChannelLayer'
   ```
4. `python -c "import config.asgi; print(config.asgi.application)"` no lanza excepciones (importa correctamente `core.routing`/`core.consumers` sin errores de `AppRegistryNotReady`).
5. Con Redis disponible (servicio `redis` de `docker-compose.yml`, tarea 05) y el servidor arrancado con Daphne (`daphne -b 0.0.0.0 -p 8000 config.asgi:application` o `docker-compose up web`):
   - Una petición HTTP normal (p.ej. `curl http://localhost:8000/accounts/login/`) debe responder igual que antes (Daphne sirve HTTP a través de `django_asgi_app`).
   - Un cliente WebSocket autenticado (sesión válida) que se conecte a `ws://localhost:8000/ws/docking-jobs/<job_id_propio>/` (con `<job_id_propio>` un `DockingJob` existente perteneciente a ese usuario, creado p.ej. desde `manage.py shell` como en la tarea `06`) recibe un mensaje JSON `{"type": "connection_established", "job_id": "...", "status": "pending", "progress": 0}` y la conexión permanece abierta.
   - Un cliente sin cookie de sesión (no autenticado) que se conecte a la misma URL recibe el cierre de conexión con código `4001`.
   - Un cliente autenticado que se conecte a `ws://localhost:8000/ws/docking-jobs/<job_id_de_otro_usuario>/` recibe el cierre con código `4003`.
   - Un cliente autenticado que se conecte a `ws://localhost:8000/ws/docking-jobs/<uuid-inexistente>/` recibe el cierre con código `4004`.
   - Puede probarse con cualquier cliente WS (p.ej. `websocat`, una pequeña página HTML con `new WebSocket(...)`, o `channels.testing.WebsocketCommunicator` en un test de Django si se prefiere — no es obligatorio añadir tests automatizados, pero es aceptable hacerlo).
6. `docker-compose config` valida sin errores de sintaxis tras los cambios en `docker-compose.yml`.

## Fuera de alcance

- No modificar `core/tasks.py` ni enviar ningún `channel_layer.group_send(...)` real desde la tarea Celery `run_docking_job` (tarea `13_notificaciones_progreso_websocket.md`).
- No crear `frontend/src/services/jobSocket.ts` ni modificar `frontend/src/chat.ts`/`jobPolling.ts` (tarea `13`).
- No modificar `core/views.py`, `core/urls.py` ni el endpoint `docking_job_status` (tarea `08`, sigue funcionando igual; el polling sigue siendo válido como mecanismo de respaldo tras la tarea `13`).
- No modificar `nginx.conf` para soportar el *upgrade* de WebSocket (proxying WS a través de Nginx queda como mejora futura independiente).
- No modificar `core/services/query_handler.py`, `core/services/vina_service.py` ni `core/services/docker_runner.py`.
- No añadir tests automatizados de Channels salvo que se considere trivial (no es un criterio de aceptación obligatorio).
