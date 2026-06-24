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

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

# get_asgi_application() llama internamente a django.setup(); debe ejecutarse
# ANTES de importar módulos que usen modelos/apps de Django (core.routing
# importa core.consumers, que importa core.models.DockingJob).
from django.core.asgi import get_asgi_application  # noqa: E402

django_asgi_app = get_asgi_application()

from channels.auth import AuthMiddlewareStack  # noqa: E402
from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402

import core.routing  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            AuthMiddlewareStack(URLRouter(core.routing.websocket_urlpatterns))
        ),
    }
)
