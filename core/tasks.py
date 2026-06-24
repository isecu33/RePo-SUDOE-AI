import logging

from asgiref.sync import async_to_sync
from celery import shared_task
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def _notify_job_progress(job_id: str, status: str, progress: int, **extra):
    """
    Envía una actualización de estado de un DockingJob al grupo WebSocket
    `docking_job_<job_id>` (consumer: core.consumers.DockingJobConsumer,
    tarea 12_websockets_django_channels.md).

    `extra` puede incluir `result` (dict, forma "docking_complete"/"docking_error")
    y/o `error` (str), igual que el endpoint de polling de la tarea
    08_polling_status_api.md (`docking_job_status`).

    Si el channel layer no está configurado o Redis no está disponible, esta
    función NO debe interrumpir la ejecución de run_docking_job (el polling
    sigue funcionando como respaldo) — captura cualquier excepción y la
    registra como warning.
    """
    try:
        channel_layer = get_channel_layer()
        if channel_layer is None:
            return
        async_to_sync(channel_layer.group_send)(
            f'docking_job_{job_id}',
            {
                'type': 'job_update',
                'data': {
                    'job_id': str(job_id),
                    'status': status,
                    'progress': progress,
                    **extra,
                },
            },
        )
    except Exception:
        logger.warning(
            "No se pudo enviar notificación WS para DockingJob %s (status=%s)",
            job_id, status, exc_info=True,
        )


@shared_task(bind=True)
def run_docking_job(self, job_id):
    """
    Ejecuta un experimento de AutoDock Vina en segundo plano para el
    DockingJob `job_id` y guarda el resultado.

    Reutiliza QueryHandler.run_autodock_vina (ejecución de Vina vía Docker)
    y QueryHandler.build_docking_result_response (construcción del dict de
    respuesta, idéntico al de la antigua ejecución síncrona).
    """
    from core.models import DockingJob
    from core.services.query_handler import QueryHandler

    try:
        job = DockingJob.objects.select_related('user').get(id=job_id)
    except DockingJob.DoesNotExist:
        logger.error("DockingJob %s no encontrado", job_id)
        return

    job.celery_task_id = self.request.id or ""
    job.save(update_fields=['celery_task_id'])
    job.mark_running()
    _notify_job_progress(job_id, job.status, job.progress)  # status="running"

    try:
        query_handler = QueryHandler(user=job.user)

        result = query_handler.run_autodock_vina(
            job.receptor_path,
            job.drug_path,
            custom_config=job.vina_config,
            user_id=job.user_id,
        )

        response = query_handler.build_docking_result_response(
            result,
            job.drug,
            job.gene,
            job.structure,
            job.receptor_path,
            vina_config=job.vina_config or None,
            predictive_analysis=job.experiment_analysis or {},
        )

        if response.get("type") == "docking_error":
            job.mark_failed(
                error_message=str(result.get('error', 'Error desconocido en docking')),
                result_data=response,
            )
            _notify_job_progress(  # status="failed"
                job_id, job.status, job.progress,
                error=job.error_message, result=job.result_data,
            )
        else:
            job.mark_completed(response)
            _notify_job_progress(  # status="completed"
                job_id, job.status, job.progress, result=job.result_data,
            )

    except Exception as exc:
        logger.exception("Error ejecutando DockingJob %s", job_id)
        job.mark_failed(error_message=str(exc))
        _notify_job_progress(  # status="failed" (excepción)
            job_id, job.status, job.progress, error=job.error_message,
        )
        raise
