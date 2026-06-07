// main.ts — Orquestador principal y punto de entrada de la aplicación
// Importa todos los módulos y los inicializa en orden correcto

import eventBus from './event_bus';
import { translations, getCurrentLanguage, t } from './config';
import { icon, getIcon, UIUtils } from './utils';
import { ThemeManager } from './theme';
import { NavigationManager } from './navigation';
import { FileManager } from './file_handler';
import { DockingManager } from './docking';
import { ChatManager } from './chat';
import { ViewerManager } from './embedded_viewer';

// CSS de entrada (Tailwind + estilos residuales)
import './styles/main.css';

import type { Experiment } from './types';

// ---- Interfaces locales ----

interface DockingApiResult {
  success: boolean;
  error?: string;
  results?: {
    binding_affinity?: number | string;
    rmsd?: number;
    vina_config?: Record<string, unknown>;
    visualization_data?: { atoms?: number };
  };
  details?: { stdout?: string; stderr?: string };
}

interface ExperimentLogData {
  log?: string;
  analysis?: Record<string, unknown>;
}

// ---- Clase principal ----

export class RePoSUDOEAI {
  chatHistory: unknown[] = [];
  currentTheme = 'light';
  currentLanguage = 'es';
  experimentsList: Experiment[] = [];
  currentExperiment: { id: string; log: string } | null = null;
  availableGenes: string[] = [];
  messageCount = 0;
  isManualMode = false;
  csrfToken = '';

  navigationManager: NavigationManager | null = null;
  themeManager: ThemeManager | null = null;
  chatManager: ChatManager | null = null;
  dockingManager: DockingManager | null = null;
  fileManager: FileManager | null = null;
  viewerManager: ViewerManager | null = null;

  readonly eventBus = eventBus;

  constructor() {
    console.log(icon('build') + ' RePoSUDOEAI constructor');
  }

  async init(): Promise<void> {
    console.log(icon('build') + ' RePoSUDOEAI.init()');
    try {
      this.setupCSRFToken();
      this.initializeManagers();
      this.initializeExternalManagers();
      this.setupModuleEventHandlers();
      this.setupInitialState();
      await this.loadAvailableExperiments();
      console.log(icon('success') + ' RePoSUDOEAI inicializado correctamente.');
    } catch (error) {
      console.error(icon('error') + ' Error durante la inicialización:', error);
    }
  }

  // ---- CSRF ----

  setupCSRFToken(): void {
    const token =
      document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ??
      document.querySelector<HTMLInputElement>('[name=csrfmiddlewaretoken]')?.value ??
      '';
    this.csrfToken = token;
    window.csrfToken = token;
    console.log(token ? icon('success') + ' CSRF configurado' : icon('warning') + ' CSRF no encontrado');
  }

  // ---- Managers ----

  initializeManagers(): void {
    this.navigationManager = new NavigationManager(this);
    this.navigationManager.setupNavigation();

    this.themeManager = new ThemeManager(this);
    this.themeManager.setupTheme();

    this.chatManager = new ChatManager(this);
    this.chatManager.setupChat();

    this.dockingManager = new DockingManager(this);
    this.dockingManager.setupDocking();
    this.dockingManager.setupBoxEnveloping();
    this.dockingManager.setupExecutionParameters();

    console.log(icon('success') + ' Managers principales inicializados.');
  }

  initializeExternalManagers(): void {
    this.fileManager = new FileManager(this.eventBus, this.csrfToken);
    this.fileManager.init();

    this.viewerManager = new ViewerManager(this.eventBus, this.csrfToken);
    this.viewerManager.init();

    if (this.chatManager) this.chatManager.viewerManager = this.viewerManager;

    console.log(icon('success') + ' FileManager y ViewerManager inicializados.');
  }

  setupModuleEventHandlers(): void {
    this.eventBus.on('fileUploaded', () => {
      // Actualizar estado del botón de docking
    });
    console.log(icon('success') + ' Event handlers configurados.');
  }

  setupInitialState(): void {
    this.navigationManager?.showSection('chat');
    console.log(icon('success') + ' Estado inicial configurado.');
  }

  // ---- Experimentos disponibles ----

  async loadAvailableExperiments(): Promise<void> {
    try {
      const response = await fetch('/api/get-available-experiments/', {
        headers: { 'X-CSRFToken': window.csrfToken },
      });
      if (!response.ok) return;
      const data = (await response.json()) as { status: string; experiments?: Experiment[] };
      if (data.status === 'success') {
        this.experimentsList = data.experiments ?? [];
        this.populateExperimentSelector();
      }
    } catch (err) {
      console.error(icon('error') + ' Error cargando experimentos:', err);
    }
  }

  populateExperimentSelector(): void {
    const selector = document.getElementById('experiment-selector') as HTMLSelectElement | null;
    if (!selector) return;

    selector.innerHTML = `<option value="">-- ${t('selectExperiment')} --</option>`;
    this.experimentsList.forEach((exp) => {
      const opt = document.createElement('option');
      opt.value = exp.id;
      const dateStr = exp.created_at
        ? new Date(Number(exp.created_at) * 1000).toLocaleDateString()
        : '';
      opt.textContent = `${exp.name ?? exp.id} — ${dateStr}`;
      selector.appendChild(opt);
    });

    selector.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value;
      if (val) void this.loadExperimentLog(val);
    });
  }

  async loadExperimentLog(experimentId: string): Promise<void> {
    try {
      const resp = await fetch(`/api/experiment-log/${experimentId}/`, {
        headers: { 'X-CSRFToken': window.csrfToken },
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = (await resp.json()) as ExperimentLogData;
      this.currentExperiment = { id: experimentId, log: data.log ?? '' };
    } catch (err) {
      console.error(icon('error') + ' Error cargando log:', err);
    }
  }

  // ---- Docking en modo manual ----

  async runDocking(): Promise<void> {
    const runBtn = document.getElementById('run-docking-btn') as HTMLButtonElement | null;
    if (!this.fileManager || !runBtn) return;

    const uploadedFiles = this.fileManager.getUploadedFiles();
    const originalText = runBtn.textContent ?? '';
    runBtn.disabled = true;
    runBtn.textContent = '⏳ Running Experiment...';
    runBtn.style.opacity = '0.7';

    // Configuración de caja y ejecución
    let vinaConfig: Record<string, unknown> = {};
    const boxParams = this.dockingManager?.isCustomBoxEnabled?.()
      ? this.viewerManager?.getManualBoxParameters?.()
      : null;
    if (boxParams) vinaConfig = { ...vinaConfig, ...boxParams };

    const restoreBtn = (): void => {
      runBtn.disabled = false;
      runBtn.textContent = originalText;
      runBtn.style.opacity = '1';
      runBtn.style.backgroundColor = '';
    };

    try {
      if (!uploadedFiles.receptor?.file_path || !uploadedFiles.drug?.file_path) {
        throw new Error('Archivos de receptor y droga son obligatorios.');
      }

      const body: Record<string, unknown> = {
        receptor_file: uploadedFiles.receptor.file_path,
        drug_file: uploadedFiles.drug.file_path,
        pose_file: uploadedFiles.pose?.file_path ?? null,
      };
      if (Object.keys(vinaConfig).length > 0) body['vina_config'] = vinaConfig;

      const response = await fetch('/api/docking/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': window.csrfToken },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as DockingApiResult;

      if (result.success) {
        runBtn.textContent = icon('success') + ' Experimento completado';
        runBtn.style.backgroundColor = 'var(--success-color)';

        await this.loadAvailableExperiments();
        this.navigationManager?.showSection('output');

        const recName = uploadedFiles.receptor.filename.replace(/\.[^/.]+$/, '');
        const drugName = uploadedFiles.drug.filename.replace(/\.[^/.]+$/, '');

        setTimeout(() => {
          void this.viewerManager?.loadVinaOutputFile(drugName, recName);
          void this.viewerManager?.loadExperimentLogFromSelector(recName, drugName);
        }, 100);
      } else {
        runBtn.textContent = icon('error') + ' Experimento fallido';
        runBtn.style.backgroundColor = 'var(--danger-color)';
        this.renderDockingError(result.error ?? 'Error desconocido', result.details);
        this.navigationManager?.showSection('output');
      }

      setTimeout(restoreBtn, 3000);
    } catch (error) {
      console.error(icon('error') + ' Error en docking:', error);
      runBtn.textContent = icon('error') + ' Error de conexión';
      runBtn.style.backgroundColor = 'var(--danger-color)';
      this.renderDockingError(error instanceof Error ? error.message : String(error));
      setTimeout(restoreBtn, 3000);
    }
  }

  private renderDockingError(errorMsg: string, details?: { stdout?: string; stderr?: string }): void {
    const el = document.getElementById('results-fallback');
    if (!el) return;
    el.innerHTML = `
      <div style="max-width:800px;margin:2rem auto;padding:2rem;">
        <div style="background:var(--warning-bg);border-left:4px solid var(--danger-color);padding:1.5rem;border-radius:8px;">
          <h3 style="color:var(--danger-color);">${icon('error')} Docking fallido</h3>
          <p>${errorMsg}</p>
        </div>
        ${details?.stdout || details?.stderr ? `
        <details style="margin-top:1rem;background:var(--bg-secondary);padding:1rem;border-radius:8px;">
          <summary style="cursor:pointer;font-weight:600;">Ver detalles técnicos</summary>
          <div style="margin-top:1rem;font-family:monospace;font-size:0.85rem;">
            ${details.stdout ? `<pre>${details.stdout}</pre>` : ''}
            ${details.stderr ? `<pre style="color:var(--danger-color);">${details.stderr}</pre>` : ''}
          </div>
        </details>` : ''}
      </div>`;
  }

  // Stub para compatibilidad con DockingManager
  renderDockingResults(result: unknown): void {
    console.log(icon('info') + ' renderDockingResults:', result);
  }
}

// ---- Inicialización global ----

console.log(icon('build') + ' main.ts cargado');

document.addEventListener('DOMContentLoaded', () => {
  const app = new RePoSUDOEAI();
  window.app = app;
  void app.init();
  console.log(icon('success') + ' RePoSUDOEAI inicializado.');
});
