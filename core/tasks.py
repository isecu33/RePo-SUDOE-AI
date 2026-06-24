import logging

from celery import shared_task

logger = logging.getLogger(__name__)


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
        else:
            job.mark_completed(response)

    except Exception as exc:
        logger.exception("Error ejecutando DockingJob %s", job_id)
        job.mark_failed(error_message=str(exc))
        raise
