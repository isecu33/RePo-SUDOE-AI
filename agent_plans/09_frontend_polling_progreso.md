# Frontend: polling de DockingJob y manejo de "job_started"

## Contexto

`RePo-SUDOE-AI_v2` es una plataforma Django de docking molecular asistido por IA, con un frontend Vite + TypeScript en `frontend/src/`. El chat se gestiona en `frontend/src/chat.ts` (clase `ChatManager`): `sendChatMessage(message, additionalData)` hace `POST /api/chat/` y pasa la respuesta JSON (tipado como `FullDockingResponse`, que extiende `ChatResponse` de `frontend/src/types/index.ts`) a `handleChatResponse(result, originalMessage)`, que es un `switch (result.type)` con casos para `confirmation`, `validation_error`, `api_error`/`processing_error`/..., `structure_selection`, `mode_selection`, `manual_download`, `docking_complete` (→ `handleDockingComplete`), `docking_error` (→ `handleDockingError`), `information`, y un `default`.

Las tareas `07_endpoint_docking_async_y_task.md` y `08_polling_status_api.md` (ya completadas) hacen que:
- Cuando el usuario lanza un docking en modo automático, `/api/chat/` responda inmediatamente con `{"type": "job_started", "job_id": "<uuid>"}` (en lugar de esperar minutos y devolver `docking_complete`/`docking_error` directamente).
- `GET /core/api/docking-job/<job_id>/status/` devuelve `{"job_id", "status": "pending"|"running"|"completed"|"failed", "progress": 0-100, "result"?: {...}, "error"?: "..."}`. Cuando `status == "completed"`, `result` tiene EXACTAMENTE la misma forma que el antiguo dict `docking_complete` (con `type: "docking_complete"`, `message`, `drug`, `gene`, `structure`, `docking_results`, `experiment_analysis`, etc., consumido hoy por `handleDockingComplete`). Cuando `status == "failed"`, si `result` está presente tiene la forma de `docking_error` (`type: "docking_error"`, `error`, ...).

Esta tarea añade el **polling** en el frontend: al recibir `"type": "job_started"`, el chat debe mostrar un mensaje de "experimento en curso", consultar periódicamente el endpoint de estado, y cuando termine, reutilizar `handleChatResponse` con el `result` final (que ya tiene `type: "docking_complete"` o `"docking_error"`), de modo que `handleDockingComplete`/`handleDockingError` se ejecuten exactamente igual que en el flujo síncrono anterior.

## Objetivo

Al terminar, cuando `/api/chat/` devuelva `{"type": "job_started", "job_id": "..."}`, el chat debe: (1) mostrar un mensaje informando de que el experimento se está ejecutando en segundo plano, (2) hacer polling de `GET /core/api/docking-job/<job_id>/status/` cada pocos segundos, y (3) al recibir `status: "completed"` o `"failed"`, llamar a `handleChatResponse` con el `result` embebido para mostrar el resultado final igual que en el flujo síncrono original.

## Pre-requisitos

- `07_endpoint_docking_async_y_task.md` (respuesta `job_started`).
- `08_polling_status_api.md` (endpoint `GET /core/api/docking-job/<job_id>/status/`).

## Archivos a crear/modificar

- `frontend/src/services/jobPolling.ts` (nuevo): función de polling reutilizable.
- `frontend/src/chat.ts`: nuevo caso `'job_started'` en `handleChatResponse` + método `handleJobStarted`; añadir `job_id?: string` a `FullDockingResponse`.
- `frontend/src/types/index.ts`: (opcional) añadir tipos `DockingJobStatusResponse` si se prefiere centralizar tipos — puede definirse también localmente en `jobPolling.ts`.

## Especificación detallada

### 1. `frontend/src/services/jobPolling.ts` (nuevo)

Crea el directorio `frontend/src/services/` si no existe.

```typescript
// jobPolling.ts — Polling de estado de DockingJob (Fase 2: procesamiento asíncrono)

export type DockingJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface DockingJobStatusResponse {
  job_id: string;
  status: DockingJobStatus;
  progress: number;
  result?: Record<string, unknown>;
  error?: string;
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLL_ATTEMPTS = 240; // ~20 minutos a intervalos de 5s

/**
 * Consulta una vez el endpoint de estado de un DockingJob.
 */
export async function fetchDockingJobStatus(jobId: string): Promise<DockingJobStatusResponse> {
  const response = await fetch(`/core/api/docking-job/${jobId}/status/`, {
    method: 'GET',
    headers: { 'X-Requested-With': 'XMLHttpRequest' },
  });

  if (!response.ok) {
    throw new Error(`Error consultando estado del job (HTTP ${response.status})`);
  }

  return (await response.json()) as DockingJobStatusResponse;
}

/**
 * Hace polling de un DockingJob hasta que su estado sea "completed" o "failed",
 * o hasta agotar MAX_POLL_ATTEMPTS (~20 minutos).
 *
 * @param jobId    UUID del DockingJob.
 * @param onUpdate callback opcional invocado en cada consulta (incluida la final),
 *                  útil para mostrar progreso ("running", `progress`, etc.).
 */
export async function pollDockingJobUntilDone(
  jobId: string,
  onUpdate?: (status: DockingJobStatusResponse) => void,
): Promise<DockingJobStatusResponse> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const data = await fetchDockingJobStatus(jobId);
    onUpdate?.(data);

    if (data.status === 'completed' || data.status === 'failed') {
      return data;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error('Tiempo de espera agotado esperando el resultado del docking');
}
```

### 2. `frontend/src/chat.ts` — tipos

Añade `job_id?: string` a la interfaz `FullDockingResponse` (línea ~21-37):

```typescript
interface FullDockingResponse extends ChatResponse {
  drug?: string;
  gene?: string;
  structure?: string;
  job_id?: string;  // <-- nuevo: presente cuando type === 'job_started'
  docking_results?: DockingResult & {
    stdout?: string;
    stderr?: string;
    cached?: boolean;
  };
  // ... resto sin cambios
}
```

Añade el import al inicio del archivo (junto a los demás imports):

```typescript
import { pollDockingJobUntilDone } from './services/jobPolling';
```

### 3. `frontend/src/chat.ts` — nuevo caso en `handleChatResponse`

En el `switch (result.type)` (línea ~198), añade un nuevo caso ANTES de `default`:

```typescript
      case 'job_started':
        void this.handleJobStarted(result, originalMessage);
        break;
```

### 4. `frontend/src/chat.ts` — nuevo método `handleJobStarted`

Añade un nuevo método privado, cerca de `handleDockingComplete`/`handleDockingError` (líneas ~570-622):

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

    this.addMessageToChat(
      `${icon('clock')} ${t('dockingJobStarted')}`,
      'assistant',
    );

    try {
      const finalStatus = await pollDockingJobUntilDone(result.job_id);

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

      // No debería ocurrir (pollDockingJobUntilDone solo devuelve al terminar
      // o lanza excepción por timeout), pero se cubre por completitud.
      this.addMessageToChat(`${icon('error')} ${t('genericError')}`, 'assistant', true);
    } catch (error: unknown) {
      console.error('Error haciendo polling del DockingJob:', error);
      this.addMessageToChat(
        `${icon('error')} ${t('connectionError')}${t('defaultError')}`,
        'assistant',
        true,
      );
    }
  }
```

Notas:
- `handleDockingError` es `private`; como `handleJobStarted` es un método de la misma clase `ChatManager`, puede llamarlo directamente — verifica que la firma (`result: FullDockingResponse`) acepta el objeto literal `{type: 'docking_error', error: ...}` (todos los campos de `FullDockingResponse` son opcionales excepto los heredados obligatorios de `ChatResponse`; revisa `ChatResponse` en `frontend/src/types/index.ts` y añade los campos mínimos que requiera, p.ej. `success: false` si `ChatResponse` lo exige).
- `this.handleChatResponse(finalStatus.result as FullDockingResponse, originalMessage)` reutiliza TODO el manejo existente (`handleDockingComplete` actualiza `currentResults`, carga el visor 3D, muestra el panel de resultados, etc.) sin duplicar lógica.

### 5. Traducciones — `frontend/src/config.ts`

Añade la clave `dockingJobStarted` al objeto `translations` (`es` y `en`), siguiendo el patrón existente de otras claves como `dockingFailed`, `preparingVisualization`:

```typescript
// dentro de translations.es
dockingJobStarted: 'Tu experimento de docking se está ejecutando en segundo plano. Esto puede tardar varios minutos...',

// dentro de translations.en
dockingJobStarted: 'Your docking experiment is running in the background. This may take several minutes...',
```

Verifica el nombre exacto de la función auxiliar de iconos `icon('clock')` en `frontend/src/utils.ts` (función `getIcon`/`icon`); si no existe un icono `'clock'`, usa uno equivalente ya soportado (p.ej. `'info'`) o añade el mapeo siguiendo el mismo patrón que los iconos existentes.

### 6. Indicador de carga (`loading-indicator`)

El `loading-indicator` ya se oculta en el bloque `finally` de `sendChatMessage` justo después de recibir la respuesta `job_started` (es la respuesta inmediata del `POST /api/chat/`), por lo que NO se queda bloqueado durante el polling — no se requiere ningún cambio adicional en `sendChatMessage`. El polling ocurre de forma asíncrona en segundo plano (`void this.handleJobStarted(...)`), mostrando los resultados cuando estén listos.

## Dependencias nuevas

Ninguna (usa `fetch`, ya usado en el resto de `chat.ts`).

## Criterios de aceptación / cómo verificar

1. `cd frontend && npm run build` (o el comando de build configurado en `package.json`) compila sin errores de TypeScript.
2. Con el backend completo funcionando (Celery worker + Redis arrancados, tareas 05/07/08 desplegadas):
   - Lanzar un docking en modo automático desde el chat.
   - El chat debe mostrar inmediatamente el mensaje de "experimento en segundo plano" (`dockingJobStarted`), sin que el indicador de carga se quede girando indefinidamente.
   - Tras el tiempo de ejecución de Vina, el chat debe mostrar el mismo resultado que mostraba antes de la Fase 2 (mensaje de `docking_results`, panel de experimento, carga del visor 3D vía `loadVinaOutputFile`).
3. Simular un fallo (p.ej. forzar `DockingJob.mark_failed(...)` manualmente desde `python manage.py shell` mientras el frontend está haciendo polling de ese `job_id`): el chat debe mostrar el mensaje de error (`handleDockingError`).
4. Verificar en las DevTools del navegador (pestaña Network) que las peticiones a `/core/api/docking-job/<job_id>/status/` se repiten aproximadamente cada 5 segundos y se detienen en cuanto `status` es `completed` o `failed`.
5. Revisar que `npm run lint` (si existe configurado en `package.json`) no reporta nuevos errores en los archivos modificados/creados.

## Fuera de alcance

- No modificar `core/services/query_handler.py`, `core/tasks.py` ni el endpoint de estado (tareas 07/08).
- No implementar WebSockets ni sustituir el polling por notificaciones push (Fase 4, tareas `12_websockets_django_channels.md` / `13_notificaciones_progreso_websocket.md` — esta última podría sustituir `jobPolling.ts` por `jobSocket.ts`, pero eso es una tarea futura independiente).
- No añadir una barra de progreso visual basada en `progress` (el campo existe en la respuesta del endpoint de estado, pero mostrarlo gráficamente es opcional y no se exige aquí; si se hace, debe ser un añadido menor sin romper los criterios anteriores).
- No modificar `frontend/src/docking.ts` ni `frontend/src/main.ts`.
