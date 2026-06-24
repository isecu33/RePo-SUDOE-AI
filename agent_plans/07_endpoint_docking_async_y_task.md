# Tarea Celery de docking asíncrono + refactor de handle_docking_flow

## Contexto

`RePo-SUDOE-AI_v2` es una plataforma Django de docking molecular asistido por IA. El núcleo del chat es `QueryHandler.handle_docking_flow` (`core/services/query_handler.py`, líneas ~228-378), que en su paso 7 decide entre dos modos:

- `manual_mode is None` → rama `mode_selection`: devuelve `{"files_ready": True, "pdb_path": ..., "sdf_path": ..., "experiment_analysis": ...}` para que el usuario elija configuración manual o automática. **Esta rama NO cambia en esta tarea.**
- `manual_mode is False` (modo automático) → rama `else` (líneas ~366-438): actualmente llama de forma **síncrona** a `result = self.run_autodock_vina(pdb_path, sdf_path, custom_config=vina_config, user_id=user_id)` (que ejecuta AutoDock Vina vía Docker y puede tardar varios minutos), y después procesa `result` para construir la respuesta final del chat: si `result.get('error')` es verdadero, un dict `{"type": "docking_error", ...}`; si no, un dict `{"type": "docking_complete", ...}` con la información del compuesto, visualización 3D, etc.

Las tareas `05_setup_celery_redis.md` (infraestructura Celery + Redis) y `06_modelo_dockingjob.md` (modelo `core.models.DockingJob`, con estados `pending/running/completed/failed`, campos `receptor_path`, `drug_path`, `vina_config`, `drug`, `gene`, `structure`, `experiment_analysis`, `result_data`, `error_message` y métodos `mark_running()`, `mark_completed(result_data)`, `mark_failed(error_message, result_data=None)`) ya están completadas.

Esta tarea es el **corazón de la Fase 2**: convierte la rama `else` de `handle_docking_flow` en un disparador asíncrono (crea un `DockingJob`, lanza una tarea Celery, devuelve `job_id` inmediatamente) y crea la tarea Celery `run_docking_job` que ejecuta el docking en segundo plano y guarda el resultado en `DockingJob.result_data`, reutilizando EXACTAMENTE la misma lógica de construcción de respuesta que existía en la rama síncrona (para no cambiar el formato que espera el frontend).

Consulta `ROADMAP.md`, Fase 2, para el contexto general.

## Objetivo

Al terminar:
1. Cuando `handle_docking_flow` entra en la rama `manual_mode is False`, en lugar de ejecutar Vina de forma síncrona, crea un registro `DockingJob` (estado `pending`), despacha `run_docking_job.delay(job_id)` y devuelve inmediatamente `{"type": "job_started", "job_id": "<uuid>"}`.
2. Existe `core/tasks.py` con la tarea Celery `run_docking_job(job_id)` que: marca el job como `running`, ejecuta `QueryHandler.run_autodock_vina(...)` con los datos guardados en el job, construye la respuesta final (mismo formato `docking_complete`/`docking_error` que antes) mediante un nuevo método reutilizable `build_docking_result_response`, y guarda el resultado con `mark_completed`/`mark_failed`.

## Pre-requisitos

- `05_setup_celery_redis.md` (Celery configurado, `shared_task` disponible).
- `06_modelo_dockingjob.md` (modelo `DockingJob`).

## Archivos a crear/modificar

- `core/services/query_handler.py`: refactorizar `handle_docking_flow` (rama `else` del paso 7) y extraer un nuevo método `build_docking_result_response`.
- `core/tasks.py` (nuevo): tarea Celery `run_docking_job`.

## Especificación detallada

### Paso 0 — Lee el código actual antes de tocar nada

Abre `core/services/query_handler.py` y localiza el método `handle_docking_flow` (línea ~228). Dentro del paso 7 (selección de modo), localiza el bloque `if manual_mode is None: ... else: ...` (la rama `else` corresponde a `manual_mode is False`, líneas aproximadas 366-438). Identifica:

- La línea exacta de la llamada `result = self.run_autodock_vina(pdb_path, sdf_path, custom_config=vina_config, user_id=user_id)` (o variante equivalente — los nombres de variables locales `pdb_path`, `sdf_path`, `vina_config`, `user_id`, `drug`, `gene`, `structure` deben existir en el scope de `handle_docking_flow`; confírmalo leyendo el método completo desde su inicio).
- TODO el código que va DESPUÉS de esa llamada hasta el final de la rama `else` (incluye: obtención de información del compuesto vía `get_compound_info` o similar, preparación de datos de visualización, y los dos `return` finales: uno para `{"type": "docking_error", ...}` cuando `result.get('error')` y otro para `{"type": "docking_complete", ...}`).
- Si existe una variable `experiment_analysis` calculada antes del `if manual_mode is None`/`else` (en un paso previo del método, p.ej. paso 5.5 "análisis predictivo"), anota su nombre exacto — se necesita para guardarla en `DockingJob.experiment_analysis`.
- Si `handle_docking_flow` recibe o calcula un identificador de `ChatSession` (p.ej. `chat_session_id`, `session_id`, o un objeto `chat_session`), anota su nombre — se usará para `DockingJob.chat_session`. Si no existe ninguna referencia a la sesión de chat en el scope, deja `chat_session=None` al crear el `DockingJob`.

### Paso 1 — Extraer `build_docking_result_response`

Crea un nuevo método de instancia en `QueryHandler`, justo después de `run_autodock_vina` (o en cualquier lugar razonable de la clase), con esta firma:

```python
def build_docking_result_response(self, result: dict, drug: str, gene: str, structure: str, pdb_path: str) -> dict:
    """
    Construye el dict de respuesta del chat ("docking_error" o "docking_complete")
    a partir del `result` devuelto por run_autodock_vina.

    Código EXTRAÍDO SIN CAMBIOS de la antigua rama síncrona de
    handle_docking_flow (manual_mode is False) — ver 07_endpoint_docking_async_y_task.md.
    """
    # <-- Pega aquí, literalmente y sin modificar la lógica, todo el código
    #     que en el original iba DESPUÉS de la llamada a run_autodock_vina
    #     y construía los dicts "docking_error" / "docking_complete",
    #     incluyendo sus respectivos `return`. -->
```

Reglas para este paso:
- NO cambies la lógica interna (las claves de los dicts de respuesta `docking_error`/`docking_complete` deben ser idénticas a las actuales — el frontend depende de ellas).
- Si el código original usa `self.xxx(...)` (p.ej. `self.get_compound_info(...)`, métodos del `visualizer_file_manager`), estas llamadas siguen funcionando igual porque `build_docking_result_response` sigue siendo un método de `QueryHandler`.
- Si el código original usa variables locales adicionales de `handle_docking_flow` que NO son `result`, `drug`, `gene`, `structure`, `pdb_path` (p.ej. `sdf_path`, `vina_config`), añádelas como parámetros adicionales de `build_docking_result_response` y pásalas también desde `core/tasks.py` (ver Paso 3). Sé conservador: añade solo los parámetros que el código extraído realmente necesite.

### Paso 2 — Reescribir la rama `else` de `handle_docking_flow`

Sustituye TODO el bloque `else:` original (la llamada a `run_autodock_vina` + el código ahora movido a `build_docking_result_response`) por:

```python
else:
    from core.models import DockingJob
    from core.tasks import run_docking_job

    job = DockingJob.objects.create(
        user_id=user_id,
        # Si handle_docking_flow tiene una referencia a la sesión de chat,
        # pásala aquí (p.ej. chat_session_id=chat_session.id si existe);
        # si no existe ninguna, omite este argumento (queda null).
        drug=drug,
        gene=gene,
        structure=structure,
        receptor_path=pdb_path,
        drug_path=sdf_path,
        vina_config=vina_config or {},
        experiment_analysis=experiment_analysis if 'experiment_analysis' in dir() else {},
    )

    run_docking_job.delay(str(job.id))

    return {
        "type": "job_started",
        "job_id": str(job.id),
    }
```

Notas:
- Sustituye `experiment_analysis if 'experiment_analysis' in dir() else {}` por una referencia directa a la variable que identificaste en el Paso 0 (p.ej. simplemente `experiment_analysis=experiment_analysis,`). El uso de `dir()` es solo un placeholder de seguridad; en el código final debe ser una referencia limpia y directa.
- `vina_config` puede ser `None` en el código original (configuración por defecto); `vina_config or {}` lo normaliza a `{}` para el `JSONField`.
- Los imports `from core.models import DockingJob` y `from core.tasks import run_docking_job` deben ir DENTRO del método (import local) para evitar problemas de import circular entre `core/tasks.py` (que importa `QueryHandler`) y `core/services/query_handler.py`.

### Paso 3 — `core/tasks.py` (nuevo)

```python
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
            result, job.drug, job.gene, job.structure, job.receptor_path
            # Si en el Paso 1 build_docking_result_response necesitó parámetros
            # adicionales (p.ej. sdf_path), pásalos aquí desde job.drug_path /
            # job.vina_config según corresponda.
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
```

`shared_task` (en lugar de `@app.task`) evita un import directo de `config.celery.app`, y es descubierto automáticamente por `app.autodiscover_tasks()` (configurado en la tarea 05) porque `core` es una app instalada y `tasks.py` sigue la convención de nombre que Celery autodescubre.

`QueryHandler(user=job.user)` usa el constructor ya actualizado por la tarea `04_integracion_ai_provider_query_handler.md` (acepta `user=` opcional). El `language` por defecto (`'es'`) es aceptable: el resultado de docking (`binding_affinity`, `poses`, etc.) no depende del idioma.

## Dependencias nuevas

Ninguna (usa `celery.shared_task`, ya disponible tras la tarea 05).

## Criterios de aceptación / cómo verificar

1. `python manage.py check` no produce errores.
2. Búsqueda de texto: `self.run_autodock_vina(` debe aparecer ahora SOLO dentro de `core/tasks.py` (y en la definición del propio método `run_autodock_vina`), no ya dentro de `handle_docking_flow`.
3. En `python manage.py shell`, sin necesidad de un worker Celery (ejecución síncrona con `.run()` — útil para probar el código de la tarea sin levantar Redis):
   ```python
   from core.models import DockingJob
   from accounts.models import CustomUser
   from core.tasks import run_docking_job

   u = CustomUser.objects.first()
   job = DockingJob.objects.create(
       user=u, drug="Aspirin", gene="BRCA1", structure="1JM7",
       receptor_path="/ruta/que/no/existe.pdb",
       drug_path="/ruta/que/no/existe.sdf",
   )
   run_docking_job.run(str(job.id))  # ejecución síncrona, sin .delay()

   job.refresh_from_db()
   assert job.status in ('failed',)  # rutas inválidas -> debe fallar de forma controlada
   assert job.error_message != ""
   ```
4. Con un caso de entrada válido (rutas PDB/SDF reales y Docker disponible — puede requerir entorno con Docker), `run_docking_job.run(str(job.id))` deja `job.status == 'completed'` y `job.result_data` con la misma estructura de claves que antes devolvía `handle_docking_flow` para `"type": "docking_complete"` (verifícalo comparando con el código que extrajiste en el Paso 1).
5. Con Redis y un worker Celery corriendo (`celery -A config worker -l info`, de la tarea 05) y el servidor Django arrancado: enviar desde el chat una consulta de docking en modo automático (`manual_mode=False` / sin selección manual) y comprobar que la respuesta HTTP es inmediata y tiene la forma `{"type": "job_started", "job_id": "<uuid>"}` (no espera varios minutos).
6. Tras unos segundos/minutos, `DockingJob.objects.get(id=job_id).status == 'completed'` (o `'failed'` si Vina/Docker no está disponible en el entorno de pruebas, pero en ese caso `error_message` debe estar poblado).

## Fuera de alcance

- No crear ningún endpoint HTTP de consulta de estado del job (tarea `08_polling_status_api.md`).
- No modificar el frontend (`frontend/src/*.ts`) para manejar `"type": "job_started"` (tarea `09_frontend_polling_progreso.md`).
- No modificar `DockerVinaService` ni `core/services/vina_service.py` (tareas `10_docker_job_runner_vina.md` / `11_integracion_docker_runner_tasks.md`).
- No tocar la rama `manual_mode is None` (`mode_selection`) de `handle_docking_flow`.
- No añadir notificaciones WebSocket ni actualizar `job.progress` durante la ejecución (Fase 4, tareas `12`/`13`) — `progress` se queda en `0` hasta `mark_completed` (que lo pone a `100`).
