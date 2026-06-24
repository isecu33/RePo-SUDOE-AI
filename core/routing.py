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
