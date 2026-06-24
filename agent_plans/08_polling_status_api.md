# Endpoint de consulta de estado de un DockingJob (polling)

## Contexto

`RePo-SUDOE-AI_v2` es una plataforma Django de docking molecular asistido por IA. La tarea `06_modelo_dockingjob.md` crea el modelo `core.models.DockingJob` (estados `pending/running/completed/failed`, campos `progress`, `result_data`, `error_message`). La tarea `07_endpoint_docking_async_y_task.md` hace que el chat, al lanzar un docking en modo automático, devuelva inmediatamente `{"type": "job_started", "job_id": "<uuid>"}` y ejecute el docking real en segundo plano vía Celery.

Esta tarea añade el endpoint HTTP que el frontend usará para preguntar periódicamente ("polling") por el estado de un `DockingJob`, hasta que pase a `completed` o `failed` y se pueda mostrar el resultado.

`core/urls.py` ya existe con `app_name = 'core'` y rutas como `api/molecular-query/`, `api/protein-lookup/`, `api/structure-info/`, `api/validate-molecule/`, `api/query-stats/`, todas mapeadas a funciones de `core/views.py`. La vista `molecular_query_api` (línea ~32) usa el patrón de decoradores `@full_access_required` (de `accounts`) + `@require_http_methods([...])`. Sigue ese mismo patrón para mantener la consistencia y los controles de acceso del proyecto (verifica el import exacto de `full_access_required` al inicio de `core/views.py`).

Consulta `ROADMAP.md`, Fase 2, para el contexto general.

## Objetivo

Al terminar, un usuario autenticado debe poder hacer `GET /core/api/docking-job/<job_id>/status/` y recibir un JSON con el estado actual de su `DockingJob` (`pending`/`running`/`completed`/`failed`, `progress`, y — si ha terminado — el resultado completo o el mensaje de error), solo si el job le pertenece.

## Pre-requisitos

- `06_modelo_dockingjob.md` (modelo `DockingJob`).

No depende de la tarea `07_endpoint_docking_async_y_task.md` para poder escribirse (el endpoint solo lee el modelo `DockingJob`, que ya existe tras la tarea 06), pero sin la tarea 07 no habrá ningún job real que consultar más allá de los creados manualmente en pruebas. Puede desarrollarse en paralelo con la tarea 07.

## Archivos a crear/modificar

- `core/views.py`: añadir la vista `docking_job_status`.
- `core/urls.py`: añadir la ruta `api/docking-job/<uuid:job_id>/status/`.

## Especificación detallada

### 1. `core/views.py`

Añade el import de `DockingJob` al import existente de `.models` (junto a `ProteinDatabase, MolecularQuery`, etc.):

```python
from .models import ProteinDatabase, MolecularQuery, DockingJob  # ajusta según los imports ya existentes
```

Añade la siguiente vista (cerca de `molecular_query_api`, siguiendo el mismo estilo de decoradores):

```python
@full_access_required
@require_http_methods(["GET"])
def docking_job_status(request, job_id):
    """
    Devuelve el estado actual de un DockingJob para polling desde el frontend.

    Respuesta JSON:
      - siempre: {"job_id": ..., "status": ..., "progress": ...}
      - si status == "completed": además {"result": <dict idéntico al antiguo
        "docking_complete">}
      - si status == "failed": además {"error": <mensaje>, "result": <dict
        "docking_error" si está disponible>}
    """
    try:
        job = DockingJob.objects.get(id=job_id, user=request.user)
    except DockingJob.DoesNotExist:
        return JsonResponse({"error": "Job no encontrado"}, status=404)

    data = {
        "job_id": str(job.id),
        "status": job.status,
        "progress": job.progress,
    }

    if job.status == "completed":
        data["result"] = job.result_data
    elif job.status == "failed":
        data["error"] = job.error_message
        if job.result_data:
            data["result"] = job.result_data

    return JsonResponse(data)
```

Notas:
- `JsonResponse` ya debería estar importado en `core/views.py` (lo usan las demás vistas `*_api`); si no lo está, añade `from django.http import JsonResponse`.
- `DockingJob.objects.get(id=job_id, user=request.user)`: el filtro por `user=request.user` garantiza que un usuario no pueda consultar el job de otro usuario simplemente adivinando el UUID — devuelve 404 en ese caso (no 403, para no filtrar la existencia del recurso).
- `job_id` llega como `uuid.UUID` gracias al convertidor `<uuid:job_id>` de la URL (ver punto 2); `DockingJob.objects.get(id=job_id, ...)` funciona directamente con un objeto `UUID`.

### 2. `core/urls.py`

Añade, junto a las rutas `api/...` existentes:

```python
    path('api/docking-job/<uuid:job_id>/status/', views.docking_job_status, name='docking_job_status'),
```

## Dependencias nuevas

Ninguna.

## Criterios de aceptación / cómo verificar

1. `python manage.py check` no produce errores.
2. En `python manage.py shell`, crea un job de prueba y comprueba el JSON devuelto usando el test client de Django:
   ```python
   from django.test import Client
   from accounts.models import CustomUser
   from core.models import DockingJob

   u = CustomUser.objects.first()
   job = DockingJob.objects.create(
       user=u, drug="Aspirin", gene="BRCA1", structure="1JM7",
       receptor_path="/tmp/x.pdb", drug_path="/tmp/x.sdf",
   )

   c = Client()
   c.force_login(u)
   resp = c.get(f"/core/api/docking-job/{job.id}/status/")
   assert resp.status_code == 200
   data = resp.json()
   assert data["status"] == "pending"
   assert data["progress"] == 0
   assert "result" not in data
   ```
3. Marca el job como completado y repite la petición:
   ```python
   job.mark_completed({"binding_affinity": -7.5, "poses": []})
   resp = c.get(f"/core/api/docking-job/{job.id}/status/")
   data = resp.json()
   assert data["status"] == "completed"
   assert data["progress"] == 100
   assert data["result"]["binding_affinity"] == -7.5
   ```
4. Marca el job como fallido y repite:
   ```python
   job.status = 'failed'
   job.error_message = 'Docker no disponible'
   job.save()
   resp = c.get(f"/core/api/docking-job/{job.id}/status/")
   data = resp.json()
   assert data["status"] == "failed"
   assert data["error"] == "Docker no disponible"
   ```
5. Un segundo usuario (`CustomUser.objects.exclude(id=u.id).first()`, o crea uno nuevo de prueba) que consulte el mismo `job.id` recibe `404`:
   ```python
   u2 = CustomUser.objects.exclude(id=u.id).first()
   c2 = Client()
   c2.force_login(u2)
   resp = c2.get(f"/core/api/docking-job/{job.id}/status/")
   assert resp.status_code == 404
   ```
6. Una petición sin autenticar a la misma URL es rechazada según el comportamiento de `full_access_required` (redirección a login o 403, según cómo esté implementado el decorador — comprobar el comportamiento de los demás endpoints `api/*` existentes para confirmar la respuesta esperada).

## Fuera de alcance

- No modificar `core/services/query_handler.py`, `core/tasks.py` ni el flujo de creación de `DockingJob` (tarea `07_endpoint_docking_async_y_task.md`).
- No modificar el frontend (tarea `09_frontend_polling_progreso.md`).
- No implementar WebSockets ni notificaciones push (Fase 4, tareas `12`/`13`).
- No añadir endpoints de cancelación/reintento de jobs (no está en el alcance del roadmap actual).
