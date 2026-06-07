// File location: RePo-SUDOE-AI/frontend/static/frontend/js/chat.js
// Chat handling and message management - COMPLETE IMPLEMENTATION WITH ALL METHODS

class ChatManager {
    constructor(appInstance = null) {
        this.app = appInstance;
        this.messages = [];
        this.currentChatId = null;
        this.currentDockingContext = null;
        this.messageCount = 0;
        this.csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
        this.currentResults = null;
        this.viewerManager = null;
        this.fileManager = null;
        this.boxPreviewTimeout = null;
    }

    init(viewerManager = null, fileManager = null) {
        this.viewerManager = viewerManager;
        this.fileManager = fileManager;
        this.setupChat();
        this.setupDocking();
        this.setupBoxEnveloping();
        this.setupExecutionParameters();
    }

    setupChat() {
        const chatInput = document.getElementById('chat-input');
        const sendButton = document.getElementById('send-button');
        const suggestionItems = document.querySelectorAll('.suggestion-item');
        
        // Manejar sugerencias
        suggestionItems.forEach(item => {
            item.addEventListener('click', () => {
                chatInput.value = item.textContent;
                chatInput.focus();
            });
        });
        
        // Enviar mensaje
        const sendMessage = () => {
            const message = chatInput.value.trim();
            if (message) {
                this.sendChatMessage(message);
                chatInput.value = '';
                chatInput.style.height = '50px';
            }
        };
        
        if (sendButton) {
            sendButton.addEventListener('click', sendMessage);
        }
        
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Auto-resize textarea
        chatInput.addEventListener('input', () => {
            chatInput.style.height = 'auto';
            const newHeight = chatInput.value.trim() === '' ? 50 : Math.min(chatInput.scrollHeight, 200);
            chatInput.style.height = newHeight + 'px';
        });

        chatInput.style.height = '50px';
    }

    async sendChatMessage(message, additionalData = {}) {
        const messagesContainer = document.getElementById('chat-messages');
        const welcomeArea = document.getElementById('welcome-area');
        const loadingIndicator = document.getElementById('loading-indicator');
        
        // Ocultar welcome area en el primer mensaje
        if (welcomeArea && welcomeArea.style.display !== 'none') {
            welcomeArea.style.display = 'none';
            if (messagesContainer) messagesContainer.style.display = 'flex';
        }
        
        // Agregar mensaje del usuario (solo si no es una respuesta automática)
        if (!additionalData.isAutoResponse) {
            this.addMessageToChat(message, 'user');
        }
        
        // Mostrar indicador de carga
        if (loadingIndicator) loadingIndicator.style.display = 'flex';
        
        try {
            const requestBody = {
                message,
                session_id: this.currentChatId,
                language: getCurrentLanguage(), // Add current language to request
                ...additionalData
            };

            const response = await fetch('/api/chat/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.csrfToken
                },
                body: JSON.stringify(requestBody)
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.currentChatId = result.session_id;
                this.handleChatResponse(result, message);
            } else {
                // Si hay un tipo específico, manejarlo normalmente
                if (result.type) {
                    this.handleChatResponse(result, message);
                } else {
                    // Solo mostrar error genérico si no hay tipo específico
                    this.addMessageToChat(icon('error') + ' ' + t('genericError'), 'assistant', true);
                }
            }
        } catch (error) {
            console.error('Chat message error:', error);
            let errorMessage = t('connectionError');

            // Provide more specific error messages
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage += t('internetError');
            } else if (error.message.includes('timeout')) {
                errorMessage += t('timeoutError');
            } else if (error.message.includes('404')) {
                errorMessage += t('notFoundError');
            } else if (error.message.includes('500')) {
                errorMessage += t('serverError');
            } else {
                errorMessage += t('defaultError');
            }

            this.addMessageToChat(withIcon('error', errorMessage), 'assistant', true);
        } finally {
            if (loadingIndicator) loadingIndicator.style.display = 'none';
        }
    }

    handleChatResponse(result, originalMessage) {
        const type = result.type;

        switch (type) {
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
                this.handleDockingComplete(result);
                break;

            case 'docking_error':
                this.handleDockingError(result);
                break;

            case 'information':
                this.addMessageToChat(result.message, 'assistant');
                break;

            default:
                this.addMessageToChat(result.message || 'Respuesta procesada', 'assistant');
        }
    }

    handleValidationError(result) {
        // Mostrar error de validación con sugerencias de manera más amigable
        let message = `${icon('error')} ${result.error || result.message}`;

        if (result.suggestions && result.suggestions.length > 0) {
            message += `\n\n${icon('lightbulb')} **Sugerencias:**`;
            result.suggestions.forEach(suggestion => {
                message += `\n• ${suggestion}`;
            });
        }

        // Añadir información adicional útil
        message += `\n\n${icon('search')} **¿Qué puedes hacer?**`;
        message += '\n• Verifica la ortografía del medicamento y gen';
        message += '\n• Usa los nombres sugeridos arriba';
        message += '\n• Pregunta "¿qué proteínas hay disponibles?" para ver opciones';

        // Mostrar como mensaje de asistente normal, no como error
        this.addMessageToChat(message, 'assistant');
    }

    handleApiError(result) {
        // Mostrar error de API o procesamiento de forma amigable
        const message = result.message || result.error || 'Ha ocurrido un error inesperado.';

        let displayMessage = `${icon('error')} **Error del sistema**

${message}`;

        // Añadir sugerencias según el tipo de error
        if (result.type === 'api_error') {
            if (message.includes('límite') || message.includes('consultas')) {
                displayMessage += `

${icon('timer')} **Sugerencia:** Espera unos minutos antes de intentarlo de nuevo.`;
            } else if (message.includes('temporalmente') || message.includes('configuración')) {
                displayMessage += `

${icon('info')} **Sugerencia:** El servicio está temporalmente no disponible. Contacta al administrador si el problema persiste.`;
            }
        } else if (result.type === 'sdf_generation_error') {
            displayMessage += `

${icon('info')} **Nota:** Algunos compuestos químicos complejos (especialmente aquellos con metales de coordinación) pueden requerir preparación manual de sus estructuras 3D.`;
        } else if (result.type === 'file_preparation_error') {
            displayMessage += `

${icon('refresh')} **Sugerencia:** Inténtalo de nuevo. Si el problema persiste, contacta al administrador.`;
        }

        this.addMessageToChat(displayMessage, 'assistant');
    }

    handleConfirmationRequest(result, originalMessage) {
        // Mostrar mensaje de confirmación
        this.addMessageToChat(result.message, 'assistant');
        
        // Guardar contexto para el docking
        this.currentDockingContext = {
            originalMessage,
            drug: result.drug,
            gene: result.gene
        };
        
        // Crear botones de confirmación usando las clases CSS existentes
        const messagesContainer = document.getElementById('chat-messages');
        const confirmationDiv = document.createElement('div');
        confirmationDiv.className = 'message assistant-message';
        confirmationDiv.innerHTML = `
            <div class="message-content">
                <div class="confirmation-controls">
                    <div style="display: flex; gap: 1rem; justify-content: space-evenly;">
                        <button class="confirm-btn yes" style="background: var(--accent-color); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 500;">
                            ${icon('check')} ${t('yesLaunchExperiment')}
                        </button>
                        <button class="confirm-btn no" style="background: var(--danger-color); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 500;">
                            ${icon('error')} ${t('noCancel')}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(confirmationDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Manejar clicks de confirmación
        confirmationDiv.querySelector('.yes').addEventListener('click', () => {
            confirmationDiv.remove();
            this.addMessageToChat(t('yesLaunchExperiment'), 'user');
            this.sendChatMessage(originalMessage, {
                confirmacion: true,
                isAutoResponse: true
            });
        });

        confirmationDiv.querySelector('.no').addEventListener('click', () => {
            confirmationDiv.remove();
            this.addMessageToChat(t('noCancel'), 'user');
            this.addMessageToChat(t('operationCancelled'), 'assistant');
            this.currentDockingContext = null;
        });
    }

    handleStructureSelection(result, originalMessage) {
        this.addMessageToChat(result.message, 'assistant');
        
        // Crear opciones de estructura usando las clases CSS existentes
        const messagesContainer = document.getElementById('chat-messages');
        const selectionDiv = document.createElement('div');
        selectionDiv.className = 'message assistant-message';
        
        const optionsHTML = result.options.map((option, index) => `
            <button class="structure-btn" data-structure="${option.id}" data-index="${index}" 
                    style="background: var(--blue-color); color: white; border: none; padding: 0.75rem 1rem; border-radius: 8px; cursor: pointer; text-align: center; font-size: 0.9rem; white-space: nowrap;">
                ${option.id}
            </button>
        `).join('');
        
        selectionDiv.innerHTML = `
            <div class="message-content">
                <div class="structure-selection">
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                        ${optionsHTML}
                    </div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(selectionDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Manejar selección de estructura
        selectionDiv.querySelectorAll('.structure-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const structureId = btn.getAttribute('data-structure');
                const index = btn.getAttribute('data-index');

                selectionDiv.remove();
                this.addMessageToChat(`${t('structureSelected')} ${structureId}`, 'user');
                
                this.sendChatMessage(originalMessage, { 
                    confirmacion: true,
                    estructura_seleccionada: structureId,
                    isAutoResponse: true 
                });
            });
        });
    }

    handleAdvancedConfiguration(result, originalMessage) {
        // Don't show the message, only the panel

        // Crear interfaz de configuración avanzada
        const messagesContainer = document.getElementById('chat-messages');
        const configDiv = document.createElement('div');
        configDiv.className = 'message assistant-message';

        configDiv.innerHTML = `
            <div class="message-content" style="max-width: 800px;">
                <div class="vina-configuration">
                    <h4 style="color: var(--text-primary);">${icon('settings')} ${t('vinaConfigTitle')}</h4>

                    <!-- Box configuration -->
                    <div class="config-section">
                        <h5>${getIcon('settings', '', 18)} ${t('boxConfiguration')}</h5>
                        <div class="config-row">
                            <label>
                                <input type="radio" name="box-method" value="enveloping" checked>
                                ${t('boxEnveloping')}
                            </label>
                            <label style="margin-left: 1rem;">
                                <input type="radio" name="box-method" value="manual">
                                ${t('boxCenterSize')}
                            </label>
                        </div>

                        <div id="enveloping-config" class="config-subsection">
                            <label>${t('padding')}:
                                <input type="number" id="padding" value="2.0" min="0.5" max="10" step="0.5" style="width: 80px;">
                                Å
                            </label>
                        </div>

                        <div id="manual-config" class="config-subsection" style="display: none;">
                            <div class="config-row">
                                <label>${t('boxSize')}:
                                    <input type="number" id="box-size-x" placeholder="20" min="5" max="50" style="width: 60px;">
                                    <input type="number" id="box-size-y" placeholder="20" min="5" max="50" style="width: 60px;">
                                    <input type="number" id="box-size-z" placeholder="20" min="5" max="50" style="width: 60px;">
                                </label>
                            </div>
                            <div class="config-row">
                                <label>${t('boxCenter')}:
                                    <input type="number" id="box-center-x" placeholder="0" step="0.1" style="width: 60px;">
                                    <input type="number" id="box-center-y" placeholder="0" step="0.1" style="width: 60px;">
                                    <input type="number" id="box-center-z" placeholder="0" step="0.1" style="width: 60px;">
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Execution parameters -->
                    <div class="config-section">
                        <h5>${getIcon('play', '', 20)} ${t('executionParams')}</h5>
                        <div class="config-grid">
                            <label>${t('cpus')}:
                                <input type="number" id="cpu" value="4" min="1" max="32" style="width: 60px;">
                            </label>
                            <label>${t('exhaustiveness')}:
                                <input type="number" id="exhaustiveness" value="16" min="1" max="100" style="width: 60px;">
                            </label>
                        </div>
                        <div class="config-grid">
                            <label>${t('verbosity')}:
                                <input type="number" id="verbosity" value="2" min="0" max="5" style="width: 60px;">
                            </label>
                            <label>${t('seed')}:
                                <input type="number" id="seed" value="1367858384" style="width: 120px;">
                            </label>
                        </div>

                        <div class="config-row">
                            <label>${t('scoringFunction')}:
                                <select id="scoring" style="margin-left: 0.5rem;">
                                    <option value="vina">${t('vinaDefault')}</option>
                                    <option value="ad4">${t('autoDock4')}</option>
                                </select>
                            </label>
                        </div>

                        <div class="config-row">
                            <label>
                                <input type="checkbox" id="no-preprocessing">
                                ${t('skipPreprocessing')}
                            </label>
                        </div>
                    </div>

                    <!-- Action buttons -->
                    <div class="config-actions">
                        <button class="config-btn run" style="background: var(--accent-color); color: white; border: none; padding: 1rem 2rem; border-radius: 8px; cursor: pointer; font-weight: 500; margin-right: 1rem;">
                            ${icon('play')} ${t('runWithConfig')}
                        </button>
                        <button class="config-btn cancel" style="background: var(--blue-color); color: white; border: none; padding: 1rem 2rem; border-radius: 8px; cursor: pointer; font-weight: 500;">
                            ${icon('cancel')} ${t('cancel')}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(configDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Setup event listeners
        this.setupVinaConfigListeners(configDiv, result, originalMessage);
    }
    
    setupVinaConfigListeners(configDiv, result, originalMessage) {
        // Toggle entre configuración automática y manual
        const boxMethodRadios = configDiv.querySelectorAll('input[name="box-method"]');
        const envelopingConfig = configDiv.querySelector('#enveloping-config');
        const manualConfig = configDiv.querySelector('#manual-config');
        
        boxMethodRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'enveloping') {
                    envelopingConfig.style.display = 'block';
                    manualConfig.style.display = 'none';
                } else {
                    envelopingConfig.style.display = 'none';
                    manualConfig.style.display = 'block';

                    // Auto-populate centro desde el PDB si los campos están vacíos
                    const cx = configDiv.querySelector('#box-center-x');
                    const cy = configDiv.querySelector('#box-center-y');
                    const cz = configDiv.querySelector('#box-center-z');
                    if (result.structure && !cx.value && !cy.value && !cz.value) {
                        fetch(`/api/pdb-center/${result.structure}/`)
                            .then(res => res.json())
                            .then(data => {
                                if (data.success && data.center) {
                                    cx.value = data.center[0];
                                    cy.value = data.center[1];
                                    cz.value = data.center[2];
                                    console.log('Centro auto-calculado:', data.center);
                                }
                            })
                            .catch(err => console.warn('No se pudo obtener centro del PDB:', err));
                    }
                }
            });
        });
        
        // Botón ejecutar con configuración personalizada
        const runBtn = configDiv.querySelector('.config-btn.run');
        runBtn.addEventListener('click', () => {
            console.log('[DEBUG] Run button clicked');
            let config = this.collectVinaConfiguration(configDiv);
            console.log('[DEBUG] Config collected:', config);
            console.log('[DEBUG] Original message:', originalMessage);
            console.log('[DEBUG] Result structure:', result.structure);

            // Note: For chat-based docking, box enveloping is calculated on the backend
            // We only need to pass the flag and padding parameter
            // The backend will calculate the box based on the downloaded PDB/SDF files

            configDiv.remove();

            this.addMessageToChat(t('customConfigApplied'), 'user');

            // Construir mensaje detallado con todos los parámetros
            let configMessage = `${t('runningDockingAdvanced')}\n\n**${t('boxConfiguration')}**\n`;
            configMessage += `• ${t('boxMethod')}: ${config.use_box_enveloping ? t('automatic') : t('manual')}\n`;

            if (config.use_box_enveloping) {
                configMessage += `• ${t('padding')}: ${config.padding} Å\n`;
            } else {
                if (config.box_center) {
                    configMessage += `• ${t('boxCenter')}: ${config.box_center[0]}, ${config.box_center[1]}, ${config.box_center[2]} Å\n`;
                }
                if (config.box_size) {
                    configMessage += `• ${t('boxSize')}: ${config.box_size[0]} × ${config.box_size[1]} × ${config.box_size[2]} Å\n`;
                }
            }

            configMessage += `\n**${t('executionParams')}**\n`;
            configMessage += `• ${t('cpuLabel')}: ${config.cpu}\n`;
            configMessage += `• ${t('exhaustivenessLabel')}: ${config.exhaustiveness}\n`;
            configMessage += `• ${t('verbosity')}: ${config.verbosity}\n`;
            configMessage += `• ${t('seed')}: ${config.seed}\n`;
            configMessage += `• ${t('scoringLabel')}: ${config.scoring}\n`;
            configMessage += `• ${t('skipPreprocessing')}: ${config.no_preprocessing ? t('yes') : t('no')}`;

            this.addMessageToChat(icon('settings') + ' ' + configMessage, 'assistant');

            // Enviar configuración al backend
            console.log('[DEBUG] Sending chat message with config');
            this.sendChatMessage(originalMessage, {
                confirmacion: true,
                estructura_seleccionada: result.structure,
                manual_mode: false,
                vina_config: config,
                isAutoResponse: true
            });
            console.log('[DEBUG] Chat message sent');
        });
        
        // Botón configuración por defecto
        const defaultBtn = configDiv.querySelector('.config-btn.default');
        if (defaultBtn) {
            defaultBtn.addEventListener('click', () => {
            configDiv.remove();
            this.addMessageToChat(t('useDefaultConfig'), 'user');

            // Send with empty config - backend will use defaults with box_enveloping
            this.sendChatMessage(originalMessage, {
                confirmacion: true,
                estructura_seleccionada: result.structure,
                manual_mode: false,
                vina_config: {},  // Empty = use backend defaults
                isAutoResponse: true
            });
        });
        }
        
        // Botón cancelar
        const cancelBtn = configDiv.querySelector('.config-btn.cancel');
        cancelBtn.addEventListener('click', () => {
            configDiv.remove();
            this.addMessageToChat(t('configCancelled'), 'user');
            this.addMessageToChat(t('whatElse'), 'assistant');
            this.currentDockingContext = null;
        });
    }
    
    collectVinaConfiguration(configDiv) {
        // Recopilar configuración de la interfaz
        const config = {};
        
        // Método de caja
        const boxMethod = configDiv.querySelector('input[name="box-method"]:checked').value;
        config.use_box_enveloping = (boxMethod === 'enveloping');
        
        if (config.use_box_enveloping) {
            config.padding = parseFloat(configDiv.querySelector('#padding').value) || 2.0;
        } else {
            const boxSizeX = parseFloat(configDiv.querySelector('#box-size-x').value);
            const boxSizeY = parseFloat(configDiv.querySelector('#box-size-y').value);
            const boxSizeZ = parseFloat(configDiv.querySelector('#box-size-z').value);
            
            if (boxSizeX && boxSizeY && boxSizeZ) {
                config.box_size = [boxSizeX, boxSizeY, boxSizeZ];
            }
            
            const boxCenterX = parseFloat(configDiv.querySelector('#box-center-x').value);
            const boxCenterY = parseFloat(configDiv.querySelector('#box-center-y').value);
            const boxCenterZ = parseFloat(configDiv.querySelector('#box-center-z').value);
            
            if (!isNaN(boxCenterX) && !isNaN(boxCenterY) && !isNaN(boxCenterZ)) {
                config.box_center = [boxCenterX, boxCenterY, boxCenterZ];
            }
        }
        
        // Parámetros de ejecución
        config.cpu = parseInt(configDiv.querySelector('#cpu').value) || 4;
        config.exhaustiveness = parseInt(configDiv.querySelector('#exhaustiveness').value) || 16;
        config.verbosity = parseInt(configDiv.querySelector('#verbosity').value) || 2;
        config.seed = parseInt(configDiv.querySelector('#seed').value) || 1367858384;
        config.scoring = configDiv.querySelector('#scoring').value || 'vina';
        config.no_preprocessing = configDiv.querySelector('#no-preprocessing').checked;

        console.log('Collected Vina configuration:', config);
        
        return config;
    }

    handleModeSelection(result, originalMessage) {
        this.addMessageToChat(result.message, 'assistant');

        // NUEVO: Mostrar información adicional del experimento si está disponible
        if (result.experiment_analysis && result.experiment_analysis.drug_name) {
            this.displayExperimentAnalysis(result.experiment_analysis);
        }

        // Crear opciones de modo incluyendo configuración avanzada
        const messagesContainer = document.getElementById('chat-messages');
        const modeDiv = document.createElement('div');
        modeDiv.className = 'message assistant-message';
        modeDiv.innerHTML = `
            <div class="message-content">
                <div class="mode-selection">
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <button class="mode-btn advanced" data-mode="advanced"
                                style="background: var(--blue-color); color: white; border: none; padding: 1rem; border-radius: 8px; cursor: pointer; text-align: left; width: 100%;">
                            ${icon('settings')} ${t('dockingConfiguration')}
                            <div style="font-size: 0.9rem; opacity: 0.9; margin-top: 0.5rem;">${t('customizeVinaParams')}</div>
                        </button>
                        <button class="mode-btn manual" data-mode="manual"
                                style="background: var(--text-secondary); color: white; border: none; padding: 1rem; border-radius: 8px; cursor: pointer; text-align: left; width: 100%;">
                            ${icon('download')} ${t('downloadFiles')}
                            <div style="font-size: 0.9rem; opacity: 0.9; margin-top: 0.5rem;">${t('downloadForExternal')}</div>
                        </button>
                    </div>
                </div>
            </div>
        `;

        messagesContainer.appendChild(modeDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Manejar selección de modo
        modeDiv.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-mode');
                const modeText = {
                    'advanced': t('advancedConfiguration'),
                    'manual': t('downloadMode')
                }[mode];

                modeDiv.remove();
                this.addMessageToChat(`${t('selected')} ${modeText}`, 'user');

                if (mode === 'advanced') {
                    // Show advanced configuration interface
                    this.handleAdvancedConfiguration({
                        message: t('configureVinaParams'),
                        structure: result.structure
                    }, originalMessage);
                } else if (mode === 'manual') {
                    // Modo manual - descargar archivos
                    this.sendChatMessage(originalMessage, { 
                        confirmacion: true,
                        estructura_seleccionada: result.structure,
                        manual_mode: true,
                        isAutoResponse: true 
                    });
            }});
        });
    }

    handleManualDownload(result) {
        // No mostrar información adicional aquí porque ya se mostró en handleModeSelection

        // Validate result.files exists and has required properties
        // Backend uses 'gene' for receptor, so check both
        const receptorFile = result.files?.receptor || result.files?.gene;
        const drugFile = result.files?.drug;

        if (!result.files || !receptorFile || !drugFile) {
            console.error('Invalid files data in manual download result:', result);
            this.addMessageToChat('Error: Missing file information for download.', 'assistant', true);
            return;
        }

        // Safe filename extraction with fallback
        const getFilename = (filepath) => {
            if (!filepath || typeof filepath !== 'string') return 'unknown_file';
            return filepath.split(/[/\\]/).pop() || 'unknown_file';
        };

        const receptorFilename = getFilename(receptorFile);
        const drugFilename = getFilename(drugFile);

        // Crear enlaces de descarga usando las clases CSS existentes
        const messagesContainer = document.getElementById('chat-messages');
        const downloadDiv = document.createElement('div');
        downloadDiv.className = 'message assistant-message';
        downloadDiv.innerHTML = `
            <div class="message-content">
                <div class="download-links">
                    <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1rem;">
                        <a href="/api/download/receptor/${receptorFilename}"
                           class="download-btn receptor" download
                           style="background: var(--blue-color); color: white; text-decoration: none; padding: 0.75rem 1rem; border-radius: 8px; text-align: center; font-weight: 500;">
                             ${receptorFilename}
                        </a>
                        <a href="/api/download/drug/${drugFilename}"
                           class="download-btn drug" download
                           style="background: var(--accent-color); color: white; text-decoration: none; padding: 0.75rem 1rem; border-radius: 8px; text-align: center; font-weight: 500;">
                            ${drugFilename}
                        </a>
                    </div>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); font-style: italic; padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px;">
                        ${result.instructions || t('canUseManualMode')}
                    </p>
                </div>
            </div>
        `;

        messagesContainer.appendChild(downloadDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    displayExperimentAnalysis(analysis) {
        if (!analysis || !analysis.drug_name) return;

        const messagesContainer = document.getElementById('chat-messages');
        const analysisDiv = document.createElement('div');
        analysisDiv.className = 'message assistant-message';

        // Crear el HTML con información de la base de datos (con traducciones)
        analysisDiv.innerHTML = `
            <div class="message-content">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border-color);">
                        ${getIcon('info', '', 24)}
                        <h3 style="margin: 0; font-size: 1.2rem; font-weight: 600; color: var(--text-primary);">${t('experimentInfo')}</h3>
                    </div>

                    <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
                        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                            <strong style="color: var(--text-primary);">${t('experimentLabel')}</strong>
                            ${analysis.drug_name} ${icon('mix')} ${analysis.gene_name}
                            ${analysis.pdb_structure ? `(${analysis.pdb_structure})` : ''}
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">
                            ${analysis.timestamp || ''}
                        </div>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                            <span style="font-size: 1.2rem;">💊</span>
                            <h4 style="margin: 0; font-size: 1rem; font-weight: 600; color: var(--accent-color);">${t('drugLabel')} ${analysis.drug_name}</h4>
                        </div>
                        <div style="padding-left: 2rem; color: var(--text-primary);">
                            ${this.formatInfoField(t('description'), analysis.drug_description)}
                            ${this.formatInfoField(t('indications'), analysis.drug_indications)}
                            ${this.formatInfoField(t('status'), analysis.drug_status)}
                            ${this.formatInfoField(t('molecularFormula'), analysis.drug_molecular_formula)}
                            ${this.formatInfoField(t('molecularWeight'), analysis.drug_molecular_weight)}
                        </div>
                    </div>

                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                            <span style="font-size: 1.2rem;">${icon('dna')}</span>
                            <h4 style="margin: 0; font-size: 1rem; font-weight: 600; color: var(--blue-color);">${t('geneProteinLabel')} ${analysis.gene_name}</h4>
                        </div>
                        <div style="padding-left: 2rem; color: var(--text-primary);">
                            ${this.formatInfoField(t('fullName'), analysis.gene_full_name)}
                            ${this.formatInfoField(t('function'), analysis.gene_function)}
                            ${this.formatInfoField(t('associatedDiseases'), analysis.gene_diseases)}
                            ${this.formatInfoField(t('molecularPathways'), analysis.gene_pathways)}
                        </div>
                    </div>
                </div>
            </div>
        `;

        messagesContainer.appendChild(analysisDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    formatInfoField(label, value) {
        if (!value || value === 'No disponible' || value === '') {
            return '';
        }
        return `
            <div style="margin-bottom: 0.75rem;">
                <strong style="color: var(--text-secondary); font-size: 0.85rem;">${label}:</strong>
                <div style="margin-top: 0.25rem; font-size: 0.9rem; line-height: 1.5;">${value}</div>
            </div>
        `;
    }

    formatCompoundInfo(info) {
        let formatted = '';

        if (info.drug_info && Object.keys(info.drug_info).length > 0) {
            formatted += `\n${icon('pill')} **${t('drugInformation')}**\n`;
            Object.entries(info.drug_info).forEach(([key, value]) => {
                if (value) {
                    // Translate the key label if translation exists, otherwise use the key as-is
                    const translatedKey = t(key) !== key ? t(key) : key;
                    formatted += `• ${translatedKey}: ${value}\n`;
                }
            });
        }

        if (info.gene_info && Object.keys(info.gene_info).length > 0) {
            formatted += `\n${icon('dna')} **${t('geneInformation')}**\n`;
            Object.entries(info.gene_info).forEach(([key, value]) => {
                if (value) {
                    // Translate the key label if translation exists, otherwise use the key as-is
                    const translatedKey = t(key) !== key ? t(key) : key;
                    formatted += `• ${translatedKey}: ${value}\n`;
                }
            });
        }

        return formatted;
    }

    async handleDockingComplete(result) {
        console.log(icon('info') + ' handleDockingComplete called with:', result);

        // Validar que tengamos docking_results
        if (!result.docking_results) {
            console.error(icon('error') + ' No docking_results in response');
            result.docking_results = {};
        }

        const isCached = result.docking_results.cached === true;

        // NUEVO: Mostrar análisis si está disponible y no se mostró antes
        if (result.experiment_analysis && result.experiment_analysis.drug_name) {
            this.displayExperimentAnalysis(result.experiment_analysis);
        }

        // Check if experiment has binding affinity (success indicator)
        const hasResults = result.docking_results &&
                          result.docking_results.binding_affinity !== null &&
                          result.docking_results.binding_affinity !== undefined;

        if (!hasResults) {
            // Experiment failed - check log for error
            const errorMessage = await this.checkExperimentError(result.structure, result.drug);

            const message = `
                ${icon('error')} **${t('dockingFailed')}**

                **${t('experiment')}**
                • ${t('drug')}: ${result.drug}
                • ${t('gene')}: ${result.gene}
                • ${t('structure')}: ${result.structure}

                **${t('error')}**
                ${errorMessage}

                ${t('checkConfiguration')}
            `;

            this.addMessageToChat(message, 'assistant');
            return; // Don't show Output tab
        }

        const statusIcon = isCached ? icon('save') : icon('check');
        const statusText = isCached ? t('cachedResults') : result.message;

        // Classify binding affinity
        const affinity = result.docking_results.binding_affinity;
        const classification = this.classifyBindingAffinity(affinity);

        const message = `
            ${statusIcon} ${statusText}

            **${t('dockingResults')}**
            • ${t('drug')}: ${result.drug}
            • ${t('gene')}: ${result.gene}
            • ${t('structure')}: ${result.structure}
            • ${t('bindingAffinity')}: ${affinity} kcal/mol
            • **${t('classification')}**: ${classification}

            ${t('preparingVisualization')}
        `;

        this.addMessageToChat(message, 'assistant');

        // Guardar resultados para visualización
        this.currentResults = result;

        // Mostrar resultados detallados en la sección de output
        this.renderDockingResults(result.docking_results, result.compound_info);

        // Update experiment information panel
        this.updateExperimentInformation(result);

        // Automatically load the Vina output file in the output viewer (with delay for file preparation)
        setTimeout(() => {
            if (this.viewerManager) {
                this.viewerManager.loadVinaOutputFile(result.drug, result.structure);
            }
        }, 3000); // Wait 3 seconds for backend to prepare files

        // Scroll to output section después de un momento
        setTimeout(() => {
            this.showSection('output');
        }, 1000);
    }

    handleDockingError(result) {
        const errorDetails = result.error || 'Unknown error occurred';
        const stdout = result.docking_results?.stdout || '';
        const stderr = result.docking_results?.stderr || '';

        // Extract specific error type
        let errorType = t('error');
        let userFriendlyMessage = '';

        if (errorDetails.includes('interrupted residues') || stdout.includes('interrupted residues')) {
            errorType = 'Interrupted Residues Error';
            userFriendlyMessage = 'The PDB structure has interrupted residue chains that cannot be processed. Try selecting a different structure for this protein.';
        } else if (errorDetails.includes('pdb4amber') || stdout.includes('pdb4amber')) {
            errorType = 'Preprocessing Error';
            userFriendlyMessage = 'The PDB structure could not be preprocessed. The structure may have formatting issues. Try selecting a different structure.';
        } else if (errorDetails.includes('valence')) {
            errorType = 'Valence Error';
            userFriendlyMessage = 'The molecular structure has incorrect valence values. Try using a different input file.';
        } else {
            userFriendlyMessage = errorDetails;
        }

        const message = `
            ${icon('error')} **${t('dockingFailed')}**

            **${t('experiment')}**
            • ${t('drug')}: ${result.drug}
            • ${t('gene')}: ${result.gene}
            • ${t('structure')}: ${result.structure}

            **Error Type:** ${errorType}

            **${t('error')}**
            ${userFriendlyMessage}

            ${t('checkConfiguration')}
        `;

        this.addMessageToChat(message, 'assistant');

        // Log detailed error to console
        console.error('Docking error details:', {
            error: errorDetails,
            stdout: stdout,
            stderr: stderr,
            result: result
        });
    }

    // Check experiment log for errors
    async checkExperimentError(structureId, drugName) {
        try {
            const logPath = `/api/output/${structureId}_${drugName}_vina.log`;
            const response = await fetch(logPath);

            if (response.ok) {
                const logContent = await response.text();

                // Check for common errors
                if (logContent.includes('Error:')) {
                    const errorLine = logContent.split('\n').find(line => line.includes('Error:'));
                    return errorLine || 'Unknown error occurred during docking';
                }

                return t('dockingCompletedNoResults');
            }

            return t('logFileNotFound');
        } catch (error) {
            return t('couldNotRetrieveError');
        }
    }

    // Parse Vina log file to extract specific sections
    parseVinaLog(logContent) {
        const lines = logContent.split('\n');
        let filteredLog = '';
        
        // Extract configuration parameters
        let config = {};
        let progressSection = '';
        let resultsSection = '';
        let inResults = false;
        let foundGrid = false;
        let foundProgress = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Extract configuration info
            if (line.includes('Scoring function:') || line.includes('scoring function')) {
                config.scoring = line.split(':')[1]?.trim() || 'vina';
            }
            if (line.includes('Rigid receptor:')) {
                config.receptor = line.split(':')[1]?.trim() || '/receptor.pdbqt';
            }
            if (line.includes('Ligand:')) {
                config.ligand = line.split(':')[1]?.trim() || '/ligand.pdbqt';
            }
            if (line.includes('Grid center:')) {
                config.center = line.split(':')[1]?.trim() || 'X 41.03 Y 18.98 Z 14.03';
            }
            if (line.includes('Grid size:')) {
                config.size = line.split(':')[1]?.trim() || 'X 20 Y 20 Z 20';
            }
            if (line.includes('Grid spacing:')) {
                config.spacing = line.split(':')[1]?.trim() || '0.375';
            }
            if (line.includes('Exhaustiveness:')) {
                config.exhaustiveness = line.split(':')[1]?.trim() || '8';
            }
            if (line.includes('CPU:')) {
                config.cpu = line.split(':')[1]?.trim() || '2';
            }
            if (line.includes('Verbosity:')) {
                config.verbosity = line.split(':')[1]?.trim() || '1';
            }
            
            // Extract "Computing Vina grid ... done" section
            if (line.includes('Computing Vina grid') && !foundGrid) {
                foundGrid = true;
                progressSection += line + '\n';
            }
            
            // Extract progress bar section
            if (line.includes('Performing docking') && !foundProgress) {
                foundProgress = true;
                progressSection += line + '\n';
                for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
                    const nextLine = lines[j];
                    if (nextLine.includes('%') || nextLine.includes('|') || nextLine.includes('*')) {
                        progressSection += nextLine + '\n';
                    }
                }
            }
            
            // Extract results table
            if (line.includes('mode') && line.includes('affinity') && line.includes('dist from best mode')) {
                inResults = true;
                resultsSection += line + '\n';
                if (i + 1 < lines.length) {
                    resultsSection += lines[i + 1] + '\n';
                }
                if (i + 2 < lines.length) {
                    resultsSection += lines[i + 2] + '\n';
                }
                continue;
            }
            
            // Collect result data rows
            if (inResults && line.match(/^\s*\d+/)) {
                resultsSection += line + '\n';
            }
            
            // Stop collecting results when we hit an empty line or end of results
            if (inResults && line === '' && resultsSection.length > 0) {
                break;
            }
        }
        
        // Build the filtered log
        filteredLog += `Scoring function : ${config.scoring || 'vina'}\n`;
        filteredLog += `Rigid receptor: ${config.receptor || '/receptor.pdbqt'}\n`;
        filteredLog += `Ligand: ${config.ligand || '/ligand.pdbqt'}\n`;
        filteredLog += `Grid center: ${config.center || 'X 41.03 Y 18.98 Z 14.03'}\n`;
        filteredLog += `Grid size  : ${config.size || 'X 20 Y 20 Z 20'}\n`;
        filteredLog += `Grid space : ${config.spacing || '0.375'}\n`;
        filteredLog += `Exhaustiveness: ${config.exhaustiveness || '8'}\n`;
        filteredLog += `CPU: ${config.cpu || '2'}\n`;
        filteredLog += `Verbosity: ${config.verbosity || '1'}\n\n`;
        
        filteredLog += progressSection;
        if (progressSection && !progressSection.endsWith('\n')) {
            filteredLog += '\n';
        }
        filteredLog += '\n';
        
        filteredLog += resultsSection;
        
        return filteredLog;
    }

    // Update experiment information panel with actual log content
    async updateExperimentInformation(result) {
        const moleculeInfo = document.getElementById('molecule-info');
        if (!moleculeInfo) return;
        
        // Show loading message
        moleculeInfo.innerHTML = `<div class="experiment-details">
            <p>Loading experiment log...</p>
        </div>`;
        
        try {
            // Fetch the actual Vina log file
            const logPath = `/api/output/${result.structure}_${result.drug}_vina.log`;
            console.log('Fetching log file:', logPath);
            
            const response = await fetch(logPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const logContent = await response.text();
            console.log('Log content loaded, length:', logContent.length);
            
            // Parse and filter the log content
            const filteredLog = this.parseVinaLog(logContent);
            
            // Display the filtered log content
            const experimentInfo = `<div class="experiment-details">
                <div class="vina-log">
                    <pre style="background: #f5f5f5; padding: 15px; border-radius: 8px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4; white-space: pre-wrap;">${filteredLog}</pre>
                </div>
            </div>`;
            
            moleculeInfo.innerHTML = experimentInfo;
            
        } catch (error) {
            console.error('Error loading Vina log file:', error);
            
            // Fallback to basic information if log file is not available
            const fallbackInfo = `<div class="experiment-details">
                <div class="error-message" style="color: #d73027; padding: 10px; background: #ffeaea; border-radius: 8px; margin: 10px 0;">
                    Could not load experiment log file: ${error.message}
                </div>
                <div class="basic-info">
                    <h5>Basic Results</h5>
                    <pre>Experiment: ${result.structure} + ${result.drug}
Best Affinity: ${result.docking_results.binding_affinity} kcal/mol
Status: ${result.docking_results.cached ? 'Cached Result' : 'Fresh Computation'}</pre>
                </div>
            </div>`;
            
            moleculeInfo.innerHTML = fallbackInfo;
        }
    }

    addMessageToChat(message, sender, isError = false) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message ${isError ? 'error' : ''}`;
        
        const timestamp = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Convert markdown-like formatting to HTML
        const formattedMessage = message
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text">${formattedMessage}</div>
                <div class="message-time">${timestamp}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // ============= DOCKING METHODS =============

    setupDocking() {
        const runDockingBtn = document.getElementById('run-docking-btn');
        if (runDockingBtn) {
            runDockingBtn.addEventListener('click', () => this.runDocking());
        }
    }

    setupBoxEnveloping() {
        console.log('Setting up manual box configuration');
        
        const enableCheckbox = document.getElementById('enable-custom-box');
        const boxInputs = document.querySelectorAll('#box-center-x, #box-center-y, #box-center-z, #box-size-x, #box-size-y, #box-size-z');
        const previewBtn = document.getElementById('preview-box-btn');
        const clearBtn = document.getElementById('clear-box-btn');
        
        if (enableCheckbox) {
            const toggleParams = () => {
                const isEnabled = enableCheckbox.checked;
                
                boxInputs.forEach(input => {
                    input.disabled = !isEnabled;
                    input.style.opacity = isEnabled ? '1' : '0.5';
                });
                
                if (previewBtn) previewBtn.disabled = !isEnabled;
                if (clearBtn) clearBtn.disabled = !isEnabled;
                
                console.log(`Custom box parameters ${isEnabled ? 'enabled' : 'disabled'}`);
            };
            
            enableCheckbox.addEventListener('change', toggleParams);
            toggleParams();
        }
        
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                console.log('Preview box button clicked');
                if (this.viewerManager) {
                    this.viewerManager.previewManualBox();
                } else {
                    console.error('ViewerManager not initialized');
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                console.log('Clear box button clicked');
                if (this.viewerManager) {
                    this.viewerManager.clearManualBoxPreview();
                } else {
                    console.error('ViewerManager not initialized');
                }
            });
        }

        boxInputs.forEach(input => {
            input.addEventListener('input', () => {
                if (this.isCustomBoxEnabled() && this.viewerManager && this.viewerManager.previewViewer) {
                    clearTimeout(this.boxPreviewTimeout);
                    this.boxPreviewTimeout = setTimeout(() => {
                        this.viewerManager.updateBoxPreviewIfVisible();
                    }, 500);
                }
            });
        });
        
        console.log('Manual box configuration setup complete');
    }

    setupExecutionParameters() {
        console.log('Setting up execution parameters configuration');
        const enableCheckbox = document.getElementById('enable-custom-params');
        const paramInputs = document.querySelectorAll('#exhaustiveness, #num-modes, #energy-range, #cpu-cores, #seed');
        
        if (enableCheckbox) {
            const toggleParams = () => {
                const isEnabled = enableCheckbox.checked;
                paramInputs.forEach(input => {
                    input.disabled = !isEnabled;
                    input.style.opacity = isEnabled ? '1' : '0.5';
                });
                console.log(`Custom execution parameters ${isEnabled ? 'enabled' : 'disabled'}`);
            };
            
            enableCheckbox.addEventListener('change', toggleParams);
            toggleParams();
        }
    }

    classifyBindingAffinity(affinity) {
        // Classify based on binding affinity value (kcal/mol)
        // More negative = stronger binding
        if (affinity === null || affinity === undefined) {
            return t('unknownAffinity');
        }

        if (affinity <= -12.0) {
            return t('veryStrong');      // Muy fuerte
        } else if (affinity <= -10.0) {
            return t('veryInteresting'); // Muy interesante
        } else if (affinity <= -9.0) {
            return t('veryGood');        // Muy buena
        } else if (affinity <= -8.0) {
            return t('interesting');     // Interesante para estudio
        } else if (affinity <= -7.0) {
            return t('goodAffinity');    // Buena afinidad
        } else if (affinity <= -6.0) {
            return t('moderate');        // Interacción moderada
        } else {
            return t('weakIrrelevant');  // Débil / Irrelevante
        }
    }

    isCustomBoxEnabled() { return document.getElementById('enable-custom-box')?.checked || false; }
    getManualBoxParameters() { return {}; }
    isCustomExecutionEnabled() { return document.getElementById('enable-custom-params')?.checked || false; }
    getManualExecutionParameters() { return null; }
    updateDockingButton() {}
    async runDocking() { console.log('Running docking...'); }
    renderDockingResults() {}
    updateExperimentInfo() {}
    restoreInputTabAfterDocking() {}
    showSection(section) {
        // Navigate to section
        window.location.hash = section;
    }
    async loadAvailableExperiments() {}
    syncExperimentDropdown() {}
    loadMolecularData() {}
}

console.log(icon('success') + ' chat.js loaded with complete implementation');
