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
from django.core.exceptions import ValidationError

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
      mensaje inicial con el estado actual del job.
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
