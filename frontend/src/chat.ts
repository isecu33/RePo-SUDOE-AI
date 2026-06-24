// chat.ts — Gestión del chat y mensajes
import { t } from './config';
import { icon, getIcon, UIUtils } from './utils';
import type { EventBus } from './event_bus';
import type { FileManager } from './file_handler';
import type {
  ChatResponse,
  DockingResult,
  VinaConfig,
  Language,
} from './types';
import { pollDockingJobUntilDone } from './services/jobPolling';

// Interfaz para el contexto de docking actual
interface DockingContext {
  originalMessage: string;
  drug: string;
  gene: string;
}

// Interfaz para resultado completo de docking (con info de experimento)
interface FullDockingResponse extends ChatResponse {
  drug?: string;
  gene?: string;
  structure?: string;
  docking_results?: DockingResult & {
    stdout?: string;
    stderr?: string;
    cached?: boolean;
  };
  compound_info?: { drug_info?: Record<string, string>; gene_info?: Record<string, string> };
  experiment_analysis?: ExperimentAnalysis;
  job_id?: string;  // presente cuando type === 'job_started'
  options?: Array<{ id: string; name?: string }>;
  files?: { receptor?: string; gene?: string; drug?: string };
  instructions?: string;
  suggestions?: string[];
  error?: string;
}

interface ExperimentAnalysis {
  drug_name?: string;
  gene_name?: string;
  pdb_structure?: string;
  timestamp?: string;
  drug_description?: string;
  drug_indications?: string;
  drug_status?: string;
  drug_molecular_formula?: string;
  drug_molecular_weight?: string;
  gene_full_name?: string;
  gene_function?: string;
  gene_diseases?: string;
  gene_pathways?: string;
}

// Interfaz mínima del ViewerManager para no crear dependencia circular
interface ViewerManagerLike {
  loadVinaOutputFile?: (drug: string, structure: string) => void;
  previewManualBox?: () => void;
  clearManualBoxPreview?: () => void;
  updateBoxPreviewIfVisible?: () => void;
  previewViewer?: unknown;
}

export class ChatManager {
  private app: unknown;
  private messages: unknown[] = [];
  private currentChatId: string | null = null;
  private currentDockingContext: DockingContext | null = null;
  private messageCount = 0;
  private csrfToken: string;
  private currentResults: FullDockingResponse | null = null;
  viewerManager: ViewerManagerLike | null = null;
  fileManager: FileManager | null = null;
  private boxPreviewTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(appInstance: unknown = null) {
    this.app = appInstance;
    this.csrfToken =
      document.querySelector<HTMLInputElement>('[name=csrfmiddlewaretoken]')?.value ?? '';
  }

  init(viewerManager: ViewerManagerLike | null = null, fileManager: FileManager | null = null): void {
    this.viewerManager = viewerManager;
    this.fileManager = fileManager;
    this.setupChat();
  }

  // ---- Configuración del chat ----

  setupChat(): void {
    const chatInput = document.getElementById('chat-input') as HTMLTextAreaElement | null;
    const sendButton = document.getElementById('send-button');
    const suggestionItems = document.querySelectorAll<HTMLElement>('.suggestion-item');

    suggestionItems.forEach((item) => {
      item.addEventListener('click', () => {
        if (chatInput) {
          chatInput.value = item.textContent ?? '';
          chatInput.focus();
        }
      });
    });

    const sendMessage = (): void => {
      if (!chatInput) return;
      const message = chatInput.value.trim();
      if (message) {
        void this.sendChatMessage(message);
        chatInput.value = '';
        chatInput.style.height = '50px';
      }
    };

    sendButton?.addEventListener('click', sendMessage);

    chatInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    chatInput?.addEventListener('input', () => {
      if (!chatInput) return;
      chatInput.style.height = 'auto';
      const newH = chatInput.value.trim() === '' ? 50 : Math.min(chatInput.scrollHeight, 200);
      chatInput.style.height = newH + 'px';
    });

    if (chatInput) chatInput.style.height = '50px';
  }

  // ---- Envío de mensajes ----

  async sendChatMessage(message: string, additionalData: Record<string, unknown> = {}): Promise<void> {
    const messagesContainer = document.getElementById('chat-messages');
    const welcomeArea = document.getElementById('welcome-area');
    const loadingIndicator = document.getElementById('loading-indicator');

    if (welcomeArea && welcomeArea.style.display !== 'none') {
      welcomeArea.style.display = 'none';
      if (messagesContainer) messagesContainer.style.display = 'flex';
    }

    if (!additionalData['isAutoResponse']) {
      this.addMessageToChat(message, 'user');
    }

    if (loadingIndicator) loadingIndicator.style.display = 'flex';

    try {
      const requestBody = {
        message,
        session_id: this.currentChatId,
        language: window.getCurrentLanguage?.() as Language | undefined ?? 'es',
        ...additionalData,
      };

      const response = await fetch('/api/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': this.csrfToken,
        },
        body: JSON.stringify(requestBody),
      });

      const result = (await response.json()) as FullDockingResponse;

      if (result.success !== false) {
        if (result.session_id) this.currentChatId = result.session_id;
        this.handleChatResponse(result, message);
      } else {
        if (result.type) {
          this.handleChatResponse(result, message);
        } else {
          this.addMessageToChat(icon('error') + ' ' + t('genericError'), 'assistant', true);
        }
      }
    } catch (error: unknown) {
      console.error('Error en chat:', error);
      let errorMessage = t('connectionError');
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('fetch')) errorMessage += t('internetError');
      else if (msg.includes('timeout')) errorMessage += t('timeoutError');
      else if (msg.includes('404')) errorMessage += t('notFoundError');
      else if (msg.includes('500')) errorMessage += t('serverError');
      else errorMessage += t('defaultError');
      this.addMessageToChat(icon('error') + ' ' + errorMessage, 'assistant', true);
    } finally {
      if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
  }

  // ---- Router de respuestas ----

  handleChatResponse(result: FullDockingResponse, originalMessage: string): void {
    switch (result.type) {
      case 'confirmation':
        this.handleConfirmationRequest(result, originalMessage);
        break;
      case 'validation_error':
        this.handleValidationError(result);
        break;
      case 'api_error':
      case 'processing_error':
      case 'sdf_generation_error':
      case 'file_preparation_error':
        this.handleApiError(result);
        break;
      case 'structure_selection':
        this.handleStructureSelection(result, originalMessage);
        break;
      case 'mode_selection':
        this.handleModeSelection(result, originalMessage);
        break;
      case 'manual_download':
        this.handleManualDownload(result);
        break;
      case 'docking_complete':
        void this.handleDockingComplete(result);
        break;
      case 'docking_error':
        this.handleDockingError(result);
        break;
      case 'information':
        this.addMessageToChat(result.message ?? '', 'assistant');
        break;
      case 'job_started':
        void this.handleJobStarted(result, originalMessage);
        break;
      default:
        this.addMessageToChat(result.message ?? 'Respuesta procesada', 'assistant');
    }
  }

  // ---- Manejadores de tipos de respuesta ----

  private handleValidationError(result: FullDockingResponse): void {
    let message = `${icon('error')} ${result.error ?? result.message ?? ''}`;
    if (result.suggestions?.length) {
      message += `\n\n${icon('lightbulb')} **Sugerencias:**`;
      result.suggestions.forEach((s) => (message += `\n• ${s}`));
    }
    message += `\n\n${icon('search')} **¿Qué puedes hacer?**`;
    message += '\n• Verifica la ortografía del medicamento y gen';
    message += '\n• Usa los nombres sugeridos arriba';
    message += '\n• Pregunta "¿qué proteínas hay disponibles?" para ver opciones';
    this.addMessageToChat(message, 'assistant');
  }

  private handleApiError(result: FullDockingResponse): void {
    const message = result.message ?? result.error ?? 'Ha ocurrido un error inesperado.';
    let displayMessage = `${icon('error')} **Error del sistema**\n\n${message}`;

    if (result.type === 'sdf_generation_error') {
      displayMessage += `\n\n${icon('info')} **Nota:** Algunos compuestos con metales de coordinación requieren preparación manual.`;
    } else if (result.type === 'file_preparation_error') {
      displayMessage += `\n\n${icon('info')} **Sugerencia:** Inténtalo de nuevo o contacta al administrador.`;
    }
    this.addMessageToChat(displayMessage, 'assistant');
  }

  private handleConfirmationRequest(result: FullDockingResponse, originalMessage: string): void {
    this.addMessageToChat(result.message ?? '', 'assistant');
    this.currentDockingContext = {
      originalMessage,
      drug: result.drug ?? '',
      gene: result.gene ?? '',
    };

    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const confirmationDiv = document.createElement('div');
    confirmationDiv.className = 'message assistant-message';
    confirmationDiv.innerHTML = `
      <div class="message-content">
        <div class="confirmation-controls">
          <div style="display:flex;gap:1rem;justify-content:space-evenly;">
            <button class="confirm-btn yes" style="background:var(--accent-color);color:white;border:none;padding:0.75rem 1.5rem;border-radius:8px;cursor:pointer;font-weight:500;">
              ${icon('check')} ${t('yesLaunchExperiment')}
            </button>
            <button class="confirm-btn no" style="background:var(--danger-color);color:white;border:none;padding:0.75rem 1.5rem;border-radius:8px;cursor:pointer;font-weight:500;">
              ${icon('error')} ${t('noCancel')}
            </button>
          </div>
        </div>
      </div>`;
    messagesContainer.appendChild(confirmationDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    confirmationDiv.querySelector('.yes')?.addEventListener('click', () => {
      confirmationDiv.remove();
      this.addMessageToChat(t('yesLaunchExperiment'), 'user');
      void this.sendChatMessage(originalMessage, { confirmacion: true, isAutoResponse: true });
    });
    confirmationDiv.querySelector('.no')?.addEventListener('click', () => {
      confirmationDiv.remove();
      this.addMessageToChat(t('noCancel'), 'user');
      this.addMessageToChat(t('operationCancelled'), 'assistant');
      this.currentDockingContext = null;
    });
  }

  private handleStructureSelection(result: FullDockingResponse, originalMessage: string): void {
    this.addMessageToChat(result.message ?? '', 'assistant');
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const selectionDiv = document.createElement('div');
    selectionDiv.className = 'message assistant-message';
    const optionsHTML = (result.options ?? [])
      .map(
        (opt, i) =>
          `<button class="structure-btn" data-structure="${opt.id}" data-index="${i}"
              style="background:var(--blue-color);color:white;border:none;padding:0.75rem 1rem;border-radius:8px;cursor:pointer;font-size:0.9rem;white-space:nowrap;">
            ${opt.id}
          </button>`
      )
      .join('');

    selectionDiv.innerHTML = `<div class="message-content"><div style="display:flex;flex-wrap:wrap;gap:0.5rem;">${optionsHTML}</div></div>`;
    messagesContainer.appendChild(selectionDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    selectionDiv.querySelectorAll<HTMLButtonElement>('.structure-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const structureId = btn.getAttribute('data-structure') ?? '';
        selectionDiv.remove();
        this.addMessageToChat(`${t('structureSelected')} ${structureId}`, 'user');
        void this.sendChatMessage(originalMessage, {
          confirmacion: true,
          estructura_seleccionada: structureId,
          isAutoResponse: true,
        });
      });
    });
  }

  private handleModeSelection(result: FullDockingResponse, originalMessage: string): void {
    this.addMessageToChat(result.message ?? '', 'assistant');
    if (result.experiment_analysis?.drug_name) {
      this.displayExperimentAnalysis(result.experiment_analysis);
    }

    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const modeDiv = document.createElement('div');
    modeDiv.className = 'message assistant-message';
    modeDiv.innerHTML = `
      <div class="message-content">
        <div style="display:flex;flex-direction:column;gap:1rem;">
          <button class="mode-btn advanced" data-mode="advanced"
              style="background:var(--blue-color);color:white;border:none;padding:1rem;border-radius:8px;cursor:pointer;text-align:left;width:100%;">
            ${icon('settings')} ${t('dockingConfiguration')}
            <div style="font-size:0.9rem;opacity:0.9;margin-top:0.5rem;">${t('customizeVinaParams')}</div>
          </button>
          <button class="mode-btn manual" data-mode="manual"
              style="background:var(--text-secondary);color:white;border:none;padding:1rem;border-radius:8px;cursor:pointer;text-align:left;width:100%;">
            ${icon('download')} ${t('downloadFiles')}
            <div style="font-size:0.9rem;opacity:0.9;margin-top:0.5rem;">${t('downloadForExternal')}</div>
          </button>
        </div>
      </div>`;
    messagesContainer.appendChild(modeDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    modeDiv.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        const modeText = mode === 'advanced' ? t('advancedConfiguration') : t('downloadMode');
        modeDiv.remove();
        this.addMessageToChat(`${t('selected')} ${modeText}`, 'user');

        if (mode === 'advanced') {
          this.handleAdvancedConfiguration(
            { message: t('configureVinaParams'), structure: result.structure },
            originalMessage,
          );
        } else {
          void this.sendChatMessage(originalMessage, {
            confirmacion: true,
            estructura_seleccionada: result.structure,
            manual_mode: true,
            isAutoResponse: true,
          });
        }
      });
    });
  }

  private handleAdvancedConfiguration(
    result: { message?: string; structure?: string },
    originalMessage: string,
  ): void {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const configDiv = document.createElement('div');
    configDiv.className = 'message assistant-message';
    configDiv.innerHTML = `
      <div class="message-content" style="max-width:800px;">
        <div class="vina-configuration">
          <h4>${icon('settings')} ${t('vinaConfigTitle')}</h4>
          <div class="config-section">
            <h5>${getIcon('settings','',18)} ${t('boxConfiguration')}</h5>
            <div class="config-row">
              <label><input type="radio" name="box-method" value="enveloping" checked> ${t('boxEnveloping')}</label>
              <label style="margin-left:1rem;"><input type="radio" name="box-method" value="manual"> ${t('boxCenterSize')}</label>
            </div>
            <div id="enveloping-config" class="config-subsection">
              <label>${t('padding')}: <input type="number" id="padding" value="2.0" min="0.5" max="10" step="0.5" style="width:80px;"> Å</label>
            </div>
            <div id="manual-config" class="config-subsection" style="display:none;">
              <label>${t('boxSize')}:
                <input type="number" id="box-size-x" placeholder="20" min="5" max="50" style="width:60px;">
                <input type="number" id="box-size-y" placeholder="20" min="5" max="50" style="width:60px;">
                <input type="number" id="box-size-z" placeholder="20" min="5" max="50" style="width:60px;">
              </label>
              <label>${t('boxCenter')}:
                <input type="number" id="box-center-x" placeholder="0" step="0.1" style="width:60px;">
                <input type="number" id="box-center-y" placeholder="0" step="0.1" style="width:60px;">
                <input type="number" id="box-center-z" placeholder="0" step="0.1" style="width:60px;">
              </label>
            </div>
          </div>
          <div class="config-section">
            <h5>${getIcon('play','',20)} ${t('executionParams')}</h5>
            <div style="display:flex;gap:1rem;flex-wrap:wrap;">
              <label>${t('cpus')}: <input type="number" id="cpu" value="4" min="1" max="32" style="width:60px;"></label>
              <label>${t('exhaustiveness')}: <input type="number" id="exhaustiveness" value="16" min="1" max="100" style="width:60px;"></label>
              <label>${t('verbosity')}: <input type="number" id="verbosity" value="2" min="0" max="5" style="width:60px;"></label>
              <label>${t('seed')}: <input type="number" id="seed" value="1367858384" style="width:120px;"></label>
            </div>
            <label>${t('scoringFunction')}:
              <select id="scoring">
                <option value="vina">${t('vinaDefault')}</option>
                <option value="ad4">${t('autoDock4')}</option>
              </select>
            </label>
            <label><input type="checkbox" id="no-preprocessing"> ${t('skipPreprocessing')}</label>
          </div>
          <div style="margin-top:1rem;">
            <button class="config-btn run" style="background:var(--accent-color);color:white;border:none;padding:1rem 2rem;border-radius:8px;cursor:pointer;font-weight:500;margin-right:1rem;">
              ${icon('play')} ${t('runWithConfig')}
            </button>
            <button class="config-btn cancel" style="background:var(--blue-color);color:white;border:none;padding:1rem 2rem;border-radius:8px;cursor:pointer;font-weight:500;">
              ${icon('cancel')} ${t('cancel')}
            </button>
          </div>
        </div>
      </div>`;
    messagesContainer.appendChild(configDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    this.setupVinaConfigListeners(configDiv, result, originalMessage);
  }

  private setupVinaConfigListeners(
    configDiv: HTMLElement,
    result: { structure?: string },
    originalMessage: string,
  ): void {
    const radios = configDiv.querySelectorAll<HTMLInputElement>('input[name="box-method"]');
    const envCfg = configDiv.querySelector<HTMLElement>('#enveloping-config');
    const manCfg = configDiv.querySelector<HTMLElement>('#manual-config');

    radios.forEach((radio) => {
      radio.addEventListener('change', () => {
        const isEnv = radio.value === 'enveloping';
        if (envCfg) envCfg.style.display = isEnv ? 'block' : 'none';
        if (manCfg) manCfg.style.display = isEnv ? 'none' : 'block';
      });
    });

    configDiv.querySelector('.config-btn.run')?.addEventListener('click', () => {
      const config = this.collectVinaConfiguration(configDiv);
      configDiv.remove();
      this.addMessageToChat(t('customConfigApplied'), 'user');

      let msg = `${icon('settings')} ${t('runningDockingAdvanced')}\n\n**${t('boxConfiguration')}**\n`;
      msg += `• ${t('boxMethod')}: ${config.use_box_enveloping ? t('automatic') : t('manual')}\n`;
      if (config.use_box_enveloping) msg += `• ${t('padding')}: ${config.padding} Å\n`;
      msg += `\n**${t('executionParams')}**\n• ${t('cpuLabel')}: ${config.cpu}\n• ${t('exhaustivenessLabel')}: ${config.exhaustiveness}\n• ${t('scoringLabel')}: ${config.scoring}`;
      this.addMessageToChat(msg, 'assistant');

      void this.sendChatMessage(originalMessage, {
        confirmacion: true,
        estructura_seleccionada: result.structure,
        manual_mode: false,
        vina_config: config,
        isAutoResponse: true,
      });
    });

    configDiv.querySelector('.config-btn.cancel')?.addEventListener('click', () => {
      configDiv.remove();
      this.addMessageToChat(t('configCancelled'), 'user');
      this.addMessageToChat(t('whatElse'), 'assistant');
      this.currentDockingContext = null;
    });
  }

  private collectVinaConfiguration(configDiv: HTMLElement): VinaConfig & Record<string, unknown> {
    const getVal = (id: string) =>
      (configDiv.querySelector<HTMLInputElement>(`#${id}`)?.value ?? '').trim();
    const getNum = (id: string, def: number) => parseFloat(getVal(id)) || def;
    const getInt = (id: string, def: number) => parseInt(getVal(id), 10) || def;

    const boxMethod =
      configDiv.querySelector<HTMLInputElement>('input[name="box-method"]:checked')?.value ?? 'enveloping';
    const useEnveloping = boxMethod === 'enveloping';

    const config: VinaConfig & Record<string, unknown> = {
      use_box_enveloping: useEnveloping,
      padding: useEnveloping ? getNum('padding', 2.0) : undefined,
      cpu: getInt('cpu', 4),
      exhaustiveness: getInt('exhaustiveness', 16),
      verbosity: getInt('verbosity', 2),
      seed: getInt('seed', 1367858384),
      scoring: (getVal('scoring') as 'vina' | 'ad4') || 'vina',
      skip_preprocessing:
        configDiv.querySelector<HTMLInputElement>('#no-preprocessing')?.checked ?? false,
    };

    if (!useEnveloping) {
      const sx = parseFloat(getVal('box-size-x'));
      const sy = parseFloat(getVal('box-size-y'));
      const sz = parseFloat(getVal('box-size-z'));
      if (!isNaN(sx) && !isNaN(sy) && !isNaN(sz)) config['box_size'] = [sx, sy, sz];
      const cx = parseFloat(getVal('box-center-x'));
      const cy = parseFloat(getVal('box-center-y'));
      const cz = parseFloat(getVal('box-center-z'));
      if (!isNaN(cx) && !isNaN(cy) && !isNaN(cz)) config['box_center'] = [cx, cy, cz];
    }
    return config;
  }

  private handleManualDownload(result: FullDockingResponse): void {
    const receptorFile = result.files?.receptor ?? result.files?.gene;
    const drugFile = result.files?.drug;
    if (!receptorFile || !drugFile) {
      this.addMessageToChat('Error: Missing file information for download.', 'assistant', true);
      return;
    }

    const getFilename = (p: string) => p.split(/[/\\]/).pop() ?? 'unknown_file';
    const recName = getFilename(receptorFile);
    const drugName = getFilename(drugFile);

    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const div = document.createElement('div');
    div.className = 'message assistant-message';
    div.innerHTML = `
      <div class="message-content">
        <div style="display:flex;flex-direction:column;gap:1rem;margin-bottom:1rem;">
          <a href="/api/download/receptor/${recName}" class="download-btn receptor" download
             style="background:var(--blue-color);color:white;text-decoration:none;padding:0.75rem 1rem;border-radius:8px;text-align:center;font-weight:500;">${recName}</a>
          <a href="/api/download/drug/${drugName}" class="download-btn drug" download
             style="background:var(--accent-color);color:white;text-decoration:none;padding:0.75rem 1rem;border-radius:8px;text-align:center;font-weight:500;">${drugName}</a>
        </div>
        <p style="font-size:0.9rem;color:var(--text-secondary);font-style:italic;padding:0.75rem;background:var(--bg-secondary);border-radius:8px;">
          ${result.instructions ?? t('canUseManualMode')}
        </p>
      </div>`;
    messagesContainer.appendChild(div);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  private async handleDockingComplete(result: FullDockingResponse): Promise<void> {
    if (result.experiment_analysis?.drug_name) {
      this.displayExperimentAnalysis(result.experiment_analysis);
    }

    const dr = result.docking_results;
    const hasResults = dr?.binding_affinity !== null && dr?.binding_affinity !== undefined;

    if (!hasResults) {
      const errorMsg = await this.checkExperimentError(result.structure ?? '', result.drug ?? '');
      this.addMessageToChat(
        `${icon('error')} **${t('dockingFailed')}**\n\n${errorMsg}`,
        'assistant',
      );
      return;
    }

    const isCached = dr?.cached === true;
    const affinity = dr?.binding_affinity;
    const classification = this.classifyBindingAffinity(
      typeof affinity === 'number' ? affinity : parseFloat(String(affinity)),
    );

    const message = `
      ${isCached ? icon('save') : icon('check')} ${isCached ? t('cachedResults') : (result.message ?? '')}

      **${t('dockingResults')}**
      • ${t('drug')}: ${result.drug ?? ''}
      • ${t('gene')}: ${result.gene ?? ''}
      • ${t('structure')}: ${result.structure ?? ''}
      • ${t('bindingAffinity')}: ${affinity ?? 'N/A'} kcal/mol
      • **${t('classification')}**: ${classification}

      ${t('preparingVisualization')}
    `;
    this.addMessageToChat(message, 'assistant');
    this.currentResults = result;
    void this.updateExperimentInformation(result);

    setTimeout(() => {
      this.viewerManager?.loadVinaOutputFile?.(result.drug ?? '', result.structure ?? '');
    }, 3000);

    setTimeout(() => this.showSection('output'), 1000);
  }

  private handleDockingError(result: FullDockingResponse): void {
    const errorDetails = result.error ?? 'Unknown error';
    this.addMessageToChat(
      `${icon('error')} **${t('dockingFailed')}**\n\n${errorDetails}\n\n${t('checkConfiguration')}`,
      'assistant',
    );
  }

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
      `${icon('info')} ${t('dockingJobStarted')}`,
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

  // ---- Helpers ----

  private async checkExperimentError(structureId: string, drugName: string): Promise<string> {
    try {
      const response = await fetch(`/api/output/${structureId}_${drugName}_vina.log`);
      if (!response.ok) return t('logFileNotFound');
      const log = await response.text();
      const errorLine = log.split('\n').find((l) => l.includes('Error:'));
      return errorLine ?? t('dockingCompletedNoResults');
    } catch {
      return t('couldNotRetrieveError');
    }
  }

  private displayExperimentAnalysis(analysis: ExperimentAnalysis): void {
    if (!analysis.drug_name) return;
    const container = document.getElementById('chat-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'message assistant-message';
    div.innerHTML = `
      <div class="message-content">
        <div style="border-bottom:2px solid var(--border-color);padding-bottom:1rem;margin-bottom:1.5rem;display:flex;align-items:center;gap:0.75rem;">
          ${getIcon('info','',24)}<h3 style="margin:0;font-weight:600;">${t('experimentInfo')}</h3>
        </div>
        <div style="margin-bottom:1.5rem;">
          <strong>${t('drugLabel')} ${analysis.drug_name}</strong>
          ${UIUtils.formatInfoField(t('description'), analysis.drug_description ?? null)}
          ${UIUtils.formatInfoField(t('indications'), analysis.drug_indications ?? null)}
          ${UIUtils.formatInfoField(t('molecularFormula'), analysis.drug_molecular_formula ?? null)}
          ${UIUtils.formatInfoField(t('molecularWeight'), analysis.drug_molecular_weight ?? null)}
        </div>
        <div>
          <strong>${t('geneProteinLabel')} ${analysis.gene_name ?? ''}</strong>
          ${UIUtils.formatInfoField(t('fullName'), analysis.gene_full_name ?? null)}
          ${UIUtils.formatInfoField(t('function'), analysis.gene_function ?? null)}
          ${UIUtils.formatInfoField(t('associatedDiseases'), analysis.gene_diseases ?? null)}
          ${UIUtils.formatInfoField(t('molecularPathways'), analysis.gene_pathways ?? null)}
        </div>
      </div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  formatInfoField(label: string, value: string | null | undefined): string {
    return UIUtils.formatInfoField(label, value);
  }

  classifyBindingAffinity(affinity: number | null | undefined): string {
    if (affinity == null) return t('unknownAffinity');
    if (affinity <= -12.0) return t('veryStrong');
    if (affinity <= -10.0) return t('veryInteresting');
    if (affinity <= -9.0) return t('veryGood');
    if (affinity <= -8.0) return t('interesting');
    if (affinity <= -7.0) return t('goodAffinity');
    if (affinity <= -6.0) return t('moderate');
    return t('weakIrrelevant');
  }

  private async updateExperimentInformation(result: FullDockingResponse): Promise<void> {
    const moleculeInfo = document.getElementById('molecule-info');
    if (!moleculeInfo) return;
    moleculeInfo.innerHTML = `<div class="experiment-details"><p>Cargando log del experimento...</p></div>`;

    try {
      const logPath = `/api/output/${result.structure}_${result.drug}_vina.log`;
      const response = await fetch(logPath);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const logContent = await response.text();
      const filtered = UIUtils.parseVinaLog(logContent);
      moleculeInfo.innerHTML = `<div class="experiment-details"><div class="vina-log">
        <pre style="background:#f5f5f5;padding:15px;border-radius:8px;overflow-x:auto;font-family:'Courier New',monospace;font-size:12px;line-height:1.4;white-space:pre-wrap;">${filtered}</pre>
      </div></div>`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      moleculeInfo.innerHTML = `<div class="experiment-details"><div style="color:#d73027;padding:10px;background:#ffeaea;border-radius:8px;">No se pudo cargar el log: ${msg}</div></div>`;
    }
  }

  addMessageToChat(message: string, sender: string, isError = false): void {
    UIUtils.addMessageToChat(message, sender, isError);
  }

  // Stubs que implementa main.ts / app
  isCustomBoxEnabled(): boolean { return (document.getElementById('enable-custom-box') as HTMLInputElement | null)?.checked ?? false; }
  showSection(section: string): void { window.location.hash = section; }
  async runDocking(): Promise<void> { console.log('runDocking() debe implementarse en main.ts'); }
  renderDockingResults(_dr: DockingResult | undefined, _info?: unknown): void {}

  // Configuración de docking en Modo Manual (delegada desde DockingManager)
  setupDocking(): void {
    const btn = document.getElementById('run-docking-btn');
    btn?.addEventListener('click', () => void this.runDocking());
  }

  setupBoxEnveloping(): void {}
  setupExecutionParameters(): void {}
}

console.log(icon('success') + ' chat.ts cargado.');
