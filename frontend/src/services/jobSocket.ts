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
