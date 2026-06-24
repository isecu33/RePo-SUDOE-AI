# Notificaciones de progreso por WebSocket (Celery -> frontend)

## Contexto

`RePo-SUDOE-AI_v2` es una plataforma Django de docking molecular asistido por IA. La tarea `12_websockets_django_channels.md` (completada) añadió la infraestructura de Django Channels: `config/asgi.py` enruta `ws/docking-jobs/<job_id>/` a `core.consumers.DockingJobConsumer`, que autentica al usuario, verifica que el `DockingJob` le pertenece, une el canal al grupo `docking_job_<job_id>` y reenvía al cliente cualquier mensaje `{"type": "job_update", "data": {...}}` que reciba ese grupo (handler `job_update`, hace `self.send(text_data=json.dumps(event['data']))`).

`core/tasks.py` (tarea `07_endpoint_docking_async_y_task.md`, completada) define la tarea Celery `run_docking_job(job_id)`, que actualmente:
1. Marca el job como `running` (`job.mark_running()`).
2. Ejecuta `QueryHandler.run_autodock_vina(...)`.
3. Construye la respuesta vía `query_handler.build_docking_result_response(...)` (dict `docking_complete` o `docking_error`, MISMA forma que consumía el frontend en el flujo síncrono original).
4. Llama a `job.mark_completed(response)` o `job.mark_failed(error_message=..., result_data=response)`.

El frontend (`frontend/src/chat.ts`, tarea `09_frontend_polling_progreso.md`, completada) tiene el método `handleJobStarted(result, originalMessage)`, que al recibir `{"type": "job_started", "job_id": "..."}` muestra el mensaje `dockingJobStarted` y llama a `pollDockingJobUntilDone(jobId)` (de `frontend/src/services/jobPolling.ts`, polling cada 5s hasta 240 intentos) para obtener el resultado final (`status: "completed"|"failed"`, con `result` en la forma `docking_complete`/`docking_error`), que pasa de nuevo a `handleChatResponse`.

Esta tarea conecta ambos extremos: (1) hace que `run_docking_job` notifique los cambios de estado vía el channel layer (Redis) al grupo `docking_job_<job_id>`, y (2) hace que el frontend se suscriba por WebSocket a ese grupo y use el resultado en tiempo real, **manteniendo el polling como mecanismo de respaldo** (si el WebSocket falla, no se conecta, o el proxy/entorno no soporta WS — ver nota de `nginx` en la tarea `12`).

Consulta `ROADMAP.md`, Fase 4, para el contexto general.

## Objetivo

Al terminar: (1) cuando `run_docking_job` cambia el estado de un `DockingJob` (a `running`, `completed` o `failed`), se envía un mensaje al grupo WS `docking_job_<job_id>` con `{job_id, status, progress, result?, error?}` (misma forma que la respuesta del endpoint de polling de la tarea `08`); (2) el frontend, al recibir `{"type": "job_started", "job_id": "..."}`, intenta primero conectarse a `ws://<host>/ws/docking-jobs/<job_id>/` y usar las actualizaciones recibidas; si la conexión WS falla, se cierra antes de tiempo, o no llega un mensaje inicial en unos segundos, recurre automáticamente a `pollDockingJobUntilDone` (sin romper el comportamiento ya verificado en la tarea `09`).

## Pre-requisitos

- `12_websockets_django_channels.md` (infraestructura Channels, consumer, grupo `docking_job_<job_id>`, mensaje `job_update`).
- `07_endpoint_docking_async_y_task.md` (`core/tasks.run_docking_job`, `mark_running`/`mark_completed`/`mark_failed`).
- `09_frontend_polling_progreso.md` (`pollDockingJobUntilDone`, `handleJobStarted`, tipos `DockingJobStatusResponse`/`FullDockingResponse`).

## Archivos a crear/modificar

- `core/tasks.py`: añadir la función `_notify_job_progress` y llamarla en los puntos donde `run_docking_job` cambia el estado del job.
- `frontend/src/services/jobSocket.ts` (nuevo): cliente WebSocket, función `subscribeToDockingJob`.
- `frontend/src/chat.ts`: modificar `handleJobStarted` para usar `subscribeToDockingJob` con `pollDockingJobUntilDone` como respaldo.

## Especificación detallada

### 1. `core/tasks.py` — `_notify_job_progress`

`core/tasks.py` actual (de la tarea 07) empieza así:

```python
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True)
def run_docking_job(self, job_id):
    ...
```

Añade los imports `async_to_sync` y `get_channel_layer`, y la función `_notify_job_progress`, ANTES de `run_docking_job`:

```python
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
```

### 2. `core/tasks.py` — llamadas a `_notify_job_progress` en `run_docking_job`

Modifica `run_docking_job` para llamar a `_notify_job_progress` justo después de cada cambio de estado del job. El cuerpo actual (tarea 07) es:

```python
@shared_task(bind=True)
def run_docking_job(self, job_id):
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

Añade las llamadas a `_notify_job_progress` resaltadas con `# <-- NUEVO`:

```python
@shared_task(bind=True)
def run_docking_job(self, job_id):
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
    _notify_job_progress(job_id, job.status, job.progress)  # <-- NUEVO: status="running"

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
        )

        if response.get("type") == "docking_error":
            job.mark_failed(
                error_message=str(result.get('error', 'Error desconocido en docking')),
                result_data=response,
            )
            _notify_job_progress(  # <-- NUEVO: status="failed"
                job_id, job.status, job.progress,
                error=job.error_message, result=job.result_data,
            )
        else:
            job.mark_completed(response)
            _notify_job_progress(  # <-- NUEVO: status="completed"
                job_id, job.status, job.progress, result=job.result_data,
            )

    except Exception as exc:
        logger.exception("Error ejecutando DockingJob %s", job_id)
        job.mark_failed(error_message=str(exc))
        _notify_job_progress(  # <-- NUEVO: status="failed" (excepción)
            job_id, job.status, job.progress, error=job.error_message,
        )
        raise
```

Notas:
- `job.status`/`job.progress`/`job.result_data`/`job.error_message` reflejan el estado actualizado por `mark_running`/`mark_completed`/`mark_failed` (estos métodos mutan el objeto en memoria además de guardar en BD), por lo que pueden leerse directamente después de llamarlos.
- El payload `data` enviado (`{job_id, status, progress, result?, error?}`) es deliberadamente IDÉNTICO en forma al JSON que devuelve `GET /core/api/docking-job/<job_id>/status/` (tarea `08`), para que el frontend pueda reutilizar el mismo tipo `DockingJobStatusResponse` y la misma lógica de manejo (`handleChatResponse`) tanto si el dato llega por WS como por polling.
- No es necesario un mensaje de progreso intermedio (p.ej. 10%, 50%) — `job.progress` solo cambia de `0` a `100` en `mark_completed` (igual que antes de esta tarea); añadir progreso granular durante la ejecución de Vina queda fuera de alcance.

### 3. `frontend/src/services/jobSocket.ts` (nuevo)

```typescript
// jobSocket.ts — Notificaciones WebSocket de DockingJob (Fase 4: tiempo real)
//
// Complementa (no sustituye) jobPolling.ts: subscribeToDockingJob() intenta
// recibir el resultado final por WebSocket; si la conexión falla o no se
// establece a tiempo, el llamador (chat.ts) debe recurrir a
// pollDockingJobUntilDone() como respaldo.

import type { DockingJobStatusResponse } from './jobPolling';

export interface DockingJobUpdate extends DockingJobStatusResponse {
  type?: 'connection_established';
}

const WS_CONNECT_TIMEOUT_MS = 5000;

/**
 * Abre un WebSocket a `ws(s)://<host>/ws/docking-jobs/<jobId>/` y espera a
 * que el job termine (`status === "completed" | "failed"`).
 *
 * - Resuelve con el `DockingJobStatusResponse` final si llega un mensaje
 *   `job_update` con `status` terminal.
 * - Rechaza (`reject`) si: el servidor cierra la conexión antes de un
 *   mensaje `connection_established` (job ajeno, inexistente, o usuario no
 *   autenticado — códigos 4001/4003/4004 del consumer), si hay un error de
 *   WebSocket, o si no se recibe `connection_established` en
 *   `WS_CONNECT_TIMEOUT_MS` (p.ej. proxy sin soporte WS).
 *
 * El llamador debe capturar el `reject` y recurrir a
 * `pollDockingJobUntilDone` como respaldo.
 *
 * @param onUpdate callback opcional invocado con CADA mensaje recibido
 *                  (incluido `connection_established` y actualizaciones
 *                  intermedias `status: "running"`), útil para feedback
 *                  visual de progreso.
 */
export function subscribeToDockingJob(
  jobId: string,
  onUpdate?: (data: DockingJobUpdate) => void,
): Promise<DockingJobStatusResponse> {
  return new Promise((resolve, reject) => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws/docking-jobs/${jobId}/`);

    let connected = false;
    let settled = false;

    const timeoutId = window.setTimeout(() => {
      if (!connected) {
        socket.close();
        if (!settled) {
          settled = true;
          reject(new Error('Tiempo de espera agotado conectando al WebSocket de progreso'));
        }
      }
    }, WS_CONNECT_TIMEOUT_MS);

    socket.onmessage = (event) => {
      let data: DockingJobUpdate;
      try {
        data = JSON.parse(event.data) as DockingJobUpdate;
      } catch {
        return;
      }

      if (data.type === 'connection_established') {
        connected = true;
        window.clearTimeout(timeoutId);
      }

      onUpdate?.(data);

      if (!settled && (data.status === 'completed' || data.status === 'failed')) {
        settled = true;
        socket.close(1000);
        resolve(data);
      }
    };

    socket.onerror = () => {
      window.clearTimeout(timeoutId);
      if (!settled) {
        settled = true;
        reject(new Error('Error de WebSocket al conectar con el progreso del job'));
      }
    };

    socket.onclose = (event) => {
      window.clearTimeout(timeoutId);
      if (!settled) {
        settled = true;
        reject(new Error(`WebSocket cerrado antes de completar (código ${event.code})`));
      }
    };
  });
}
```

### 4. `frontend/src/chat.ts` — `handleJobStarted` con WS + respaldo de polling

Añade el import (junto al de `pollDockingJobUntilDone` de la tarea 09):

```typescript
import { subscribeToDockingJob } from './services/jobSocket';
```

Sustituye el cuerpo de `handleJobStarted` (tarea 09) por:

```typescript
  private async handleJobStarted(result: FullDockingResponse, originalMessage: string): Promise<void> {
    if (!result.job_id) {
      this.addMessageToChat(
        `${icon('error')} ${t('genericError')}`,
        'assistant',
        true,
      );
      return;
    }

    const jobId = result.job_id;

    this.addMessageToChat(
      `${icon('clock')} ${t('dockingJobStarted')}`,
      'assistant',
    );

    let finalStatus;
    try {
      // Intento 1: notificaciones en tiempo real vía WebSocket.
      finalStatus = await subscribeToDockingJob(jobId);
    } catch (wsError) {
      console.warn('WebSocket de progreso no disponible, usando polling:', wsError);
      try {
        // Intento 2 (respaldo): polling HTTP (tarea 09), igual que antes.
        finalStatus = await pollDockingJobUntilDone(jobId);
      } catch (pollError) {
        console.error('Error haciendo polling del DockingJob:', pollError);
        this.addMessageToChat(
          `${icon('error')} ${t('connectionError')}${t('defaultError')}`,
          'assistant',
          true,
        );
        return;
      }
    }

    if (finalStatus.status === 'completed' && finalStatus.result) {
      this.handleChatResponse(finalStatus.result as FullDockingResponse, originalMessage);
      return;
    }

    if (finalStatus.status === 'failed') {
      if (finalStatus.result) {
        this.handleChatResponse(finalStatus.result as FullDockingResponse, originalMessage);
      } else {
        this.handleDockingError({
          type: 'docking_error',
          error: finalStatus.error ?? t('genericError'),
        } as FullDockingResponse);
      }
      return;
    }

    this.addMessageToChat(`${icon('error')} ${t('genericError')}`, 'assistant', true);
  }
```

Notas:
- `DockingJobStatusResponse` (de `jobPolling.ts`, tarea 09) y `DockingJobUpdate` (de `jobSocket.ts`, esta tarea) son estructuralmente compatibles (`DockingJobUpdate` extiende `DockingJobStatusResponse` añadiendo `type?`), por lo que `finalStatus` puede tratarse igual venga de `subscribeToDockingJob` o de `pollDockingJobUntilDone`.
- Si el WebSocket se conecta correctamente (`connection_established`) pero el job tarda mucho, la promesa de `subscribeToDockingJob` permanece pendiente sin timeout adicional (no hay límite de ~20 minutos como en el polling) — esto es aceptable porque la conexión WS no consume peticiones HTTP repetidas; si se desea un timeout máximo también para WS, puede añadirse con `Promise.race` en un futuro, pero NO es un requisito de esta tarea.
- No es necesario mostrar visualmente las actualizaciones intermedias (`status: "running"`) recibidas por `onUpdate` — el callback es opcional y puede omitirse (`subscribeToDockingJob(jobId)` sin segundo argumento), igual que se hace arriba.

## Dependencias nuevas

Ninguna (`asgiref` ya es una dependencia de Django; `channels`/`channels-redis` ya se añadieron en la tarea `12`; el frontend usa `WebSocket`, nativo del navegador).

## Criterios de aceptación / cómo verificar

1. `python manage.py check` no produce errores.
2. `cd frontend && npm run build` compila sin errores de TypeScript.
3. Sin Redis disponible (channel layer caído): `run_docking_job.run(str(job.id))` (ejecución síncrona, como en el criterio 3 de la tarea 07) NO debe lanzar una excepción causada por `_notify_job_progress` — el job debe terminar en `completed`/`failed` igual que antes de esta tarea (verifica que `_notify_job_progress` captura la excepción de `get_channel_layer()`/`group_send` y solo registra un `warning`).
4. Con Redis, Celery worker y Daphne corriendo (tareas `05`, `12`):
   - Crea un `DockingJob` válido (receptor/ligando reales) y, ANTES de lanzar `run_docking_job`, conecta un cliente WS de prueba a `ws://localhost:8000/ws/docking-jobs/<job_id>/` (con cookie de sesión del usuario propietario) — debe recibir `{"type": "connection_established", "job_id", "status": "pending", "progress": 0}`.
   - Lanza `run_docking_job.delay(str(job.id))`. El cliente WS debe recibir, sin necesidad de hacer ninguna petición HTTP adicional:
     - Un mensaje `{"job_id", "status": "running", "progress": 0}`.
     - Un mensaje final `{"job_id", "status": "completed", "progress": 100, "result": {...}}` (o `"failed"` con `"error"`/`"result"`), con el mismo contenido que devolvería `GET /core/api/docking-job/<job_id>/status/` en ese momento.
5. Prueba end-to-end desde el chat (frontend completo): lanzar un docking en modo automático debe mostrar el mensaje `dockingJobStarted` y, al terminar, el resultado (`docking_complete`/`docking_error`) igual que en la tarea `09` — verifica en las DevTools (pestaña *Network* -> *WS*) que se abre una conexión a `/ws/docking-jobs/<job_id>/` y que NO se realizan peticiones repetidas a `/core/api/docking-job/<job_id>/status/` cada 5s (es decir, el polling NO se activa cuando el WS funciona).
6. Prueba de respaldo: simula un fallo del WebSocket (p.ej. detén temporalmente Daphne/Channels o bloquea la URL `/ws/docking-jobs/` en las DevTools) y repite el flujo — el chat debe recurrir automáticamente al polling de la tarea `09` (peticiones repetidas a `/core/api/docking-job/<job_id>/status/` cada ~5s) y mostrar el resultado igual que antes.
7. `npm run lint` (si está configurado) no reporta nuevos errores en los archivos modificados/creados.

## Fuera de alcance

- No modificar `core/consumers.py`, `core/routing.py`, `config/asgi.py` ni `config/settings.py` (tarea `12`, ya completada — esta tarea solo los USA).
- No modificar `core/services/query_handler.py`, `core/services/vina_service.py` ni `core/services/docker_runner.py`.
- No modificar `core/views.py`/`core/urls.py` ni el endpoint `docking_job_status` (tarea `08`) — sigue existiendo como respaldo.
- No eliminar `frontend/src/services/jobPolling.ts` ni `pollDockingJobUntilDone` (se mantiene como respaldo, tal como exige el criterio de aceptación 6).
- No añadir una barra de progreso visual basada en actualizaciones intermedias (`status: "running"`) — opcional, no exigido.
- No modificar `nginx.conf` (proxying WS a través de Nginx, ver nota de la tarea `12` — fuera de alcance).
