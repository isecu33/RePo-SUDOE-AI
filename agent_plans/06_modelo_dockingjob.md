# Modelo DockingJob (jobs de docking asíncronos)

## Contexto

`RePo-SUDOE-AI_v2` es una plataforma Django para docking molecular asistido por IA. `ROADMAP.md`, Fase 2 ("Celery + Redis"), propone que la ejecución de AutoDock Vina se convierta en un job asíncrono: el chat crea un registro de "trabajo" (job), dispara una tarea Celery, y el frontend hace *polling* (o recibe WebSockets en la Fase 4) para conocer su estado y resultado final.

Esta tarea crea **solo el modelo de datos** `DockingJob` en `core/models.py`, con su migración. Es independiente de la infraestructura de Celery (tarea `05_setup_celery_redis.md`) — ambas tareas pueden desarrollarse en paralelo, ya que no comparten archivos. El modelo se usará en la tarea `07_endpoint_docking_async_y_task.md` (que lo crea/actualiza desde `handle_docking_flow` y desde la tarea Celery) y en la `08_polling_status_api.md` (que lo expone vía un endpoint de estado).

`core/models.py` ya contiene los modelos `ProteinDatabase`, `MolecularQuery` y `StructureCache`, todos con `id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)` y FK a `settings.AUTH_USER_MODEL` y/o `frontend.models.ChatSession` (ya importado al inicio del archivo: `from frontend.models import ChatSession`).

**Importante — no confundir con `frontend.models.DockingSimulation`**: `frontend/models.py` ya contiene un modelo `DockingSimulation` (con `status`, `results_data`, `output_files`, relación con `UploadedFile`, etc.) que parece ser de una implementación anterior/alternativa y actualmente NO se usa en el flujo principal de `QueryHandler.run_autodock_vina`. `DockingJob` es un modelo **nuevo y distinto**, en `core/models.py`, pensado específicamente para representar un job de Celery del flujo actual (`handle_docking_flow`). NO modifiques `frontend/models.py` ni `DockingSimulation` en esta tarea.

## Objetivo

Al terminar, debe existir un modelo `core.models.DockingJob` (UUID como clave primaria, FK a usuario y a `ChatSession`, campo `status` con los estados `pending/running/completed/failed`, `progress` 0-100, `celery_task_id`, los datos necesarios para reanudar el docking (`receptor_path`, `drug_path`, `vina_config`, `drug`, `gene`, `structure`, `experiment_analysis`) y el resultado (`result_data`, `error_message`)), con su migración aplicada y registrado en el admin.

## Pre-requisitos

Ninguna. Puede desarrollarse en paralelo con `05_setup_celery_redis.md` (no comparten archivos).

## Archivos a crear/modificar

- `core/models.py`: añadir la clase `DockingJob`.
- `core/admin.py`: registrar `DockingJob`.
- `core/migrations/000X_dockingjob.py` (autogenerada con `makemigrations`).

## Especificación detallada

### 1. `core/models.py`

Añadir al final del archivo (después de `StructureCache`, línea ~254):

```python
class DockingJob(models.Model):
    """
    Representa un experimento de docking ejecutado de forma ASÍNCRONA vía
    Celery (Fase 2 del ROADMAP). Distinto de frontend.models.DockingSimulation
    (modelo legado no usado por el flujo actual de QueryHandler).

    Ciclo de vida:
      pending  -> creado por handle_docking_flow, antes de despachar la tarea Celery
      running  -> la tarea Celery ha empezado a ejecutarse
      completed/failed -> la tarea Celery ha terminado
    """

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='docking_jobs'
    )
    chat_session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name='docking_jobs',
        null=True,
        blank=True
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    progress = models.PositiveSmallIntegerField(default=0, help_text="Progreso estimado, 0-100")

    celery_task_id = models.CharField(max_length=255, blank=True, db_index=True)

    # --- Datos de entrada necesarios para ejecutar el docking ---
    drug = models.CharField(max_length=255)
    gene = models.CharField(max_length=255)
    structure = models.CharField(max_length=20, help_text="Código PDB de la estructura seleccionada")
    receptor_path = models.CharField(max_length=1024, help_text="Ruta absoluta al archivo PDB del receptor")
    drug_path = models.CharField(max_length=1024, help_text="Ruta absoluta al archivo SDF del fármaco")
    vina_config = models.JSONField(default=dict, blank=True, help_text="Configuración personalizada de AutoDock Vina")
    experiment_analysis = models.JSONField(default=dict, blank=True, help_text="Análisis predictivo generado antes de lanzar el job")

    # --- Resultado ---
    result_data = models.JSONField(default=dict, blank=True, help_text="Resultado completo (formato igual al de run_autodock_vina / response de docking_complete)")
    error_message = models.TextField(blank=True)

    # --- Timestamps ---
    created_at = models.DateTimeField(default=timezone.now)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Docking Job"
        verbose_name_plural = "Docking Jobs"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['user', 'status']),
        ]

    def __str__(self):
        return f"DockingJob {self.id} ({self.drug} vs {self.gene}) - {self.status}"

    def mark_running(self):
        self.status = 'running'
        self.started_at = timezone.now()
        self.save(update_fields=['status', 'started_at'])

    def mark_completed(self, result_data: dict):
        self.status = 'completed'
        self.progress = 100
        self.result_data = result_data
        self.finished_at = timezone.now()
        self.save(update_fields=['status', 'progress', 'result_data', 'finished_at'])

    def mark_failed(self, error_message: str, result_data: dict = None):
        self.status = 'failed'
        self.error_message = error_message
        if result_data is not None:
            self.result_data = result_data
        self.finished_at = timezone.now()
        self.save(update_fields=['status', 'error_message', 'result_data', 'finished_at'])
```

Todos los nombres usados (`models`, `settings`, `timezone`, `uuid`, `ChatSession`) ya están importados al inicio de `core/models.py` — no se necesitan imports adicionales.

### 2. `core/admin.py`

Registrar el modelo (sigue el patrón de los modelos ya registrados en este archivo, p.ej. `ProteinDatabase`/`MolecularQuery`):

```python
from .models import DockingJob  # añadir al import existente de .models


@admin.register(DockingJob)
class DockingJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'drug', 'gene', 'structure', 'status', 'progress', 'created_at')
    list_filter = ('status',)
    search_fields = ('id', 'user__email', 'drug', 'gene', 'celery_task_id')
    readonly_fields = ('id', 'created_at', 'started_at', 'finished_at')
```

### 3. Migración

```
python manage.py makemigrations core
```

Comprueba el último número de migración existente en `core/migrations/` (actualmente `0001_initial.py`) y verifica que se genera `0002_dockingjob.py` (o el siguiente número libre) sin conflictos.

## Dependencias nuevas

Ninguna.

## Criterios de aceptación / cómo verificar

1. `python manage.py makemigrations core` genera la migración sin errores ni warnings de campos faltantes.
2. `python manage.py migrate` la aplica correctamente.
3. En `python manage.py shell`:
   ```python
   from accounts.models import CustomUser
   from core.models import DockingJob

   u = CustomUser.objects.first()
   job = DockingJob.objects.create(
       user=u,
       drug="Aspirin",
       gene="BRCA1",
       structure="1JM7",
       receptor_path="/app/input/1JM7.pdb",
       drug_path="/app/input/Aspirin.sdf",
       vina_config={"cpu": 2},
   )
   assert job.status == 'pending'
   assert job.progress == 0

   job.mark_running()
   assert job.status == 'running' and job.started_at is not None

   job.mark_completed({"binding_affinity": -7.5})
   assert job.status == 'completed' and job.progress == 100
   ```
4. `/admin/` muestra "Docking Jobs" con las columnas `id, user, drug, gene, structure, status, progress, created_at` y permite filtrar por `status`.
5. `python manage.py check` no produce errores.

## Fuera de alcance

- No crear `core/tasks.py` ni ninguna tarea Celery (tarea `07_endpoint_docking_async_y_task.md`).
- No modificar `core/services/query_handler.py`, `frontend/views.py` ni el flujo de `handle_docking_flow` (tarea `07_endpoint_docking_async_y_task.md`).
- No crear ningún endpoint de consulta de estado (tarea `08_polling_status_api.md`).
- No modificar `frontend/models.py` ni `DockingSimulation`.
- No añadir `CHANNEL_LAYERS`, consumers ni notificaciones por WebSocket (Fase 4).
