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
