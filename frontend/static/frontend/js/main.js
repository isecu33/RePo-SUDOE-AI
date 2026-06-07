// File location: RePo-SUDOE-AI/frontend/static/frontend/js/main.js
// Main orchestrator class and application initialization

class RePoSUDOEAI {
    constructor() {
        console.log(icon('build') + ' RePoSUDOEAI constructor called');

        this.chatHistory = [];
        this.currentTheme = 'light';
        this.currentLanguage = 'es';
        this.experimentsList = [];
        this.currentExperiment = null;
        this.availableGenes = [];
        this.messageCount = 0;
        this.isManualMode = false;
        this.csrfToken = '';

        // Managers will be initialized in init()
        this.navigationManager = null;
        this.themeManager = null;
        this.chatManager = null;
        this.dockingManager = null;

        // External managers (already defined)
        this.fileManager = null;
        this.viewerManager = null;

        // Event bus - create new instance if not exists
        this.eventBus = window.EventBus || new EventBus();
        if (!window.EventBus) {
            window.EventBus = this.eventBus;
            console.log(icon('build') + ' EventBus created and assigned to window');
        }

        console.log(icon('success') + ' RePoSUDOEAI instance created');
    }

    async init() {
        console.log(icon('build') + ' RePoSUDOEAI.init() starting');
        
        try {
            // Set CSRF token
            this.setupCSRFToken();
            
            // Initialize managers
            this.initializeManagers();
            
            // Setup external managers
            this.initializeExternalManagers();
            
            // Setup module event handlers
            this.setupModuleEventHandlers();
            
            // Setup initial UI state
            this.setupInitialState();
            
            // Load experiments
            await this.loadAvailableExperiments();
            
            console.log(icon('success') + ' RePoSUDOEAI.init() complete');
        } catch (error) {
            console.error(icon('error') + ' Error during initialization:', error);
        }
    }

    setupCSRFToken() {
        const csrftoken = document.querySelector('meta[name="csrf-token"]')?.content ||
                         document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
                         '';
        this.csrfToken = csrftoken;
        window.csrfToken = csrftoken;
        if (csrftoken) {
            console.log(icon('success') + ' CSRF token configured');
        } else {
            console.warn(icon('warning') + ' CSRF token not found');
        }
    }

    initializeManagers() {
        console.log(icon('build') + ' Initializing manager instances');
        
        // Initialize navigation manager
        this.navigationManager = new NavigationManager(this);
        this.navigationManager.setupNavigation();
        
        // Initialize theme manager
        this.themeManager = new ThemeManager(this);
        this.themeManager.setupTheme();
        
        // Initialize chat manager (will be linked to ViewerManager later)
        this.chatManager = new ChatManager(this);
        this.chatManager.setupChat();

        // Initialize docking manager
        this.dockingManager = new DockingManager(this);
        this.dockingManager.setupDocking();
        this.dockingManager.setupBoxEnveloping();
        this.dockingManager.setupExecutionParameters();

        console.log(icon('success') + ' All managers initialized');
    }

    initializeExternalManagers() {
        console.log(icon('build') + ' Initializing external managers');
        console.log('🔍 EventBus status:', {
            exists: !!this.eventBus,
            isGlobal: this.eventBus === window.EventBus,
            eventCount: this.eventBus ? this.eventBus.getEvents().length : 0
        });

        // FileManager should already exist
        if (typeof FileManager !== 'undefined') {
            console.log('🔧 Creating FileManager with eventBus:', !!this.eventBus);
            this.fileManager = new FileManager(this.eventBus, this.csrfToken);
            this.fileManager.init();
            console.log(icon('success') + ' FileManager initialized');
        } else {
            console.error(icon('error') + ' FileManager class not found');
        }

        // ViewerManager should already exist
        if (typeof ViewerManager !== 'undefined') {
            console.log('🔧 Creating ViewerManager with eventBus:', !!this.eventBus);
            this.viewerManager = new ViewerManager(this.eventBus, this.csrfToken);
            this.viewerManager.init();
            console.log(icon('success') + ' ViewerManager initialized');
            console.log('📡 EventBus listeners after ViewerManager init:', this.eventBus.getEvents());

            // Link ViewerManager to ChatManager and DockingManager
            if (this.chatManager) {
                this.chatManager.viewerManager = this.viewerManager;
                console.log(icon('success') + ' ViewerManager linked to ChatManager');
            }
            if (this.dockingManager) {
                this.dockingManager.viewerManager = this.viewerManager;
                console.log(icon('success') + ' ViewerManager linked to DockingManager');
            }
        } else {
            console.error(icon('error') + ' ViewerManager class not found');
        }
    }

    setupModuleEventHandlers() {
        console.log(icon('build') + ' Setting up module event handlers');
        
        if (this.eventBus) {
            // Chat events
            this.eventBus.on('chatMessageReceived', (data) => {
                this.handleChatMessage(data);
            });
            
            // Docking events
            this.eventBus.on('dockingComplete', (data) => {
                this.handleDockingComplete(data);
            });
            
            this.eventBus.on('dockingError', (data) => {
                this.handleDockingError(data);
            });
            
            // File upload events
            this.eventBus.on('fileUploaded', (data) => {
                this.dockingManager.updateDockingButton();
            });
            
            console.log(icon('success') + ' Module event handlers configured');
        }
    }

    setupInitialState() {
        console.log(icon('build') + ' Setting up initial UI state');
        
        // Update docking button based on uploaded files
        this.dockingManager.updateDockingButton();
        
        // Show initial section (chat)
        if (this.navigationManager) {
            this.navigationManager.showSection('chat');
        }
        
        console.log(icon('success') + ' Initial UI state configured');
    }

    async loadAvailableExperiments() {
        try {
            console.log(icon('info') + ' Loading available experiments');

            const response = await fetch('/api/get-available-experiments/', {
                method: 'GET',
                headers: {
                    'X-CSRFToken': window.csrfToken || ''
                }
            });

            if (!response.ok) {
                console.warn(icon('warning') + ` API returned ${response.status}`);
                return;
            }

            const data = await response.json();

            if (data.status === 'success') {
                this.experimentsList = data.experiments || [];
                console.log(`${icon('success')} Loaded ${this.experimentsList.length} experiments`);
                this.populateExperimentSelector();
            } else {
                console.warn(icon('warning') + ' No experiments available');
            }

        } catch (error) {
            console.error(icon('error') + ' Error loading experiments:', error);
        }
    }

    populateExperimentSelector() {
        const selector = document.getElementById('experiment-selector');
        if (!selector) return;

        selector.innerHTML = `<option value="">-- ${t('selectExperiment')} --</option>`;

        this.experimentsList.forEach(exp => {
            const option = document.createElement('option');
            option.value = exp.id || exp.key;

            // Format date from timestamp
            let dateStr = '';
            if (exp.date) {
                const date = new Date(exp.date * 1000); // Convert from unix timestamp
                dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            }

            // Show user folder if available
            const userInfo = exp.user_folder ? ` (${exp.user_folder})` : '';

            option.textContent = `${exp.name || exp.key}${userInfo} - ${dateStr}`;
            selector.appendChild(option);
        });

        selector.addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadExperimentLog(e.target.value);
            }
        });

        console.log(icon('success') + ` Experiment selector populated with ${this.experimentsList.length} experiments`);
    }

    async loadExperimentLog(experimentId) {
        try {
            console.log(`${icon('info')} Loading experiment log for ID: ${experimentId}`);
            
            const response = await fetch(`/api/experiment-log/${experimentId}/`, {
                method: 'GET',
                headers: {
                    'X-CSRFToken': window.csrfToken || ''
                }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            this.currentExperiment = {
                id: experimentId,
                log: data.log || ''
            };
            
            this.syncExperimentDropdown();
            this.displayExperimentAnalysis(data.analysis || {});
            
            console.log(icon('success') + ' Experiment log loaded');
            
        } catch (error) {
            console.error(icon('error') + ' Error loading experiment log:', error);
        }
    }

    syncExperimentDropdown() {
        const selector = document.getElementById('experiment-selector');
        if (selector && this.currentExperiment) {
            selector.value = this.currentExperiment.id;
        }
    }

    displayExperimentAnalysis(analysis) {
        if (this.dockingManager) {
            this.dockingManager.displayExperimentAnalysis(analysis);
        }
    }

    async runDocking() {
        const outputContent = document.getElementById('results-fallback');
        const runDockingBtn = document.getElementById('run-docking-btn');
        if (!outputContent || !runDockingBtn) return;

        const uploadedFiles = this.fileManager ? this.fileManager.getUploadedFiles() : {};

        const originalButtonText = runDockingBtn.textContent;
        runDockingBtn.disabled = true;
        runDockingBtn.textContent = '⏳ Running Experiment...';
        runDockingBtn.style.opacity = '0.7';

        // Get manual box configuration from UI
        let vinaConfig = {};
        const manualBoxParams = this.dockingManager.getManualBoxParameters();
        if (manualBoxParams) {
            vinaConfig = { ...vinaConfig, ...manualBoxParams };
            console.log(icon('config') + ' Applied manual box configuration:', manualBoxParams);
        }

        // Get manual execution parameters from UI
        const manualExecParams = this.dockingManager.getManualExecutionParameters();
        if (manualExecParams) {
            vinaConfig = { ...vinaConfig, ...manualExecParams };
            console.log(icon('config') + ' Applied manual execution parameters:', manualExecParams);
        }

        try {
            if (!uploadedFiles.receptor || !uploadedFiles.drug) {
                throw new Error('Required files not uploaded');
            }

            const requestBody = {
                receptor_file: uploadedFiles.receptor.file_path,
                drug_file: uploadedFiles.drug.file_path,
                pose_file: uploadedFiles.pose?.file_path || null,
            };

            if (Object.keys(vinaConfig).length > 0) {
                requestBody.vina_config = vinaConfig;
            }

            console.log(icon('info') + ' VINA DOCKING REQUEST:');
            console.log('  Files:', { receptor: uploadedFiles.receptor.file_path, drug: uploadedFiles.drug.file_path });
            console.log('  Configuration:', vinaConfig);

            const response = await fetch('/api/docking/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': window.csrfToken || ''
                },
                body: JSON.stringify(requestBody)
            });

            const result = await response.json();

            console.log(icon('info') + ' VINA DOCKING RESPONSE:', result);

            if (result.success) {
                runDockingBtn.disabled = false;
                runDockingBtn.textContent = icon('success') + ' Experiment Complete';
                runDockingBtn.style.backgroundColor = 'var(--success-color)';

                this.currentResults = result;
                this.dockingManager.restoreInputTabAfterDocking();
                this.navigationManager.showSection('output');

                // Reload experiments to populate selector
                await this.loadAvailableExperiments();

                const pdbId = uploadedFiles.receptor.filename.replace(/\.[^/.]+$/, "");
                const drugName = uploadedFiles.drug.filename.replace(/\.[^/.]+$/, "");

                setTimeout(() => {
                    if (this.viewerManager) {
                        console.log(icon('info') + ' Loading experiment:', { pdbId, drugName });
                        this.viewerManager.loadVinaOutputFile(drugName, pdbId);

                        // Load experiment log if the method exists
                        if (typeof this.viewerManager.loadExperimentLogFromSelector === 'function') {
                            this.viewerManager.loadExperimentLogFromSelector(pdbId, drugName);
                        } else {
                            console.warn(icon('warning') + ' loadExperimentLogFromSelector method not found');
                        }

                        this.updateExperimentInfo(result.results);
                    } else {
                        console.error(icon('error') + ' ViewerManager not initialized');
                    }
                }, 100);

                setTimeout(() => {
                    runDockingBtn.textContent = originalButtonText;
                    runDockingBtn.style.backgroundColor = '';
                }, 3000);

            } else {
                runDockingBtn.disabled = false;
                runDockingBtn.textContent = icon('error') + ' Experiment Failed';
                runDockingBtn.style.backgroundColor = 'var(--error-color)';

                this.dockingManager.restoreInputTabAfterDocking();

                const errorDetails = result.error || 'Unknown error occurred';
                const stdout = result.details?.stdout || '';
                const stderr = result.details?.stderr || '';

                outputContent.innerHTML = `
                    <div class="error-container" style="max-width: 800px; margin: 2rem auto; padding: 2rem;">
                        <div class="error-message" style="background: var(--error-bg); border-left: 4px solid var(--error-color); padding: 1.5rem; border-radius: 8px;">
                            <h3 style="color: var(--error-color);">${icon('error')} Docking Failed</h3>
                            <p>${errorDetails}</p>
                        </div>
                        ${stdout || stderr ? `
                        <details style="margin-top: 1rem; background: var(--bg-secondary); padding: 1rem; border-radius: 8px;">
                            <summary style="cursor: pointer; font-weight: 600;">View Technical Details</summary>
                            <div style="margin-top: 1rem; font-family: monospace; font-size: 0.85rem;">
                                ${stdout ? `<pre>${stdout}</pre>` : ''}
                                ${stderr ? `<pre style="color: var(--error-color);">${stderr}</pre>` : ''}
                            </div>
                        </details>
                        ` : ''}
                    </div>
                `;

                this.navigationManager.showSection('output');
                setTimeout(() => {
                    runDockingBtn.textContent = originalButtonText;
                    runDockingBtn.style.backgroundColor = '';
                }, 3000);
            }
        } catch (error) {
            console.error(icon('error') + ' Docking error:', error);
            runDockingBtn.disabled = false;
            runDockingBtn.textContent = icon('error') + ' Connection Error';
            runDockingBtn.style.backgroundColor = 'var(--error-color)';

            this.dockingManager.restoreInputTabAfterDocking();

            outputContent.innerHTML = `
                <div class="error-message" style="background: var(--error-bg); border-left: 4px solid var(--error-color); padding: 1rem; border-radius: 8px;">
                    <h3 style="color: var(--error-color);">${icon('error')} Connection Error</h3>
                    <p>Failed to connect to server: ${error.message}</p>
                </div>
            `;

            setTimeout(() => {
                runDockingBtn.textContent = originalButtonText;
                runDockingBtn.style.backgroundColor = '';
            }, 3000);
        }
    }

    handleDockingComplete(result) {
        console.log(icon('success') + ' Docking completed:', result);
        
        this.renderDockingResults(result);
        this.updateExperimentInfo(result);
        
        if (this.dockingManager) {
            this.dockingManager.restoreInputTabAfterDocking();
        }
    }

    handleDockingError(result) {
        console.error(icon('error') + ' Docking error:', result);
        
        const errorMessage = result.error || 'Error desconocido durante el docking';
        UIUtils.addMessageToChat(
            `Error en docking: ${errorMessage}`,
            'system',
            true
        );
        
        if (this.dockingManager) {
            this.dockingManager.restoreInputTabAfterDocking();
        }
    }

    renderDockingResults(result) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'message assistant-message';

        let vinaConfig = '';
        if (result.vina_config) {
            const config = result.vina_config;
            vinaConfig = `
                <div style="margin-top: 1rem; padding: 0.75rem; background: var(--bg-tertiary); border-radius: 6px; font-size: 0.85rem;">
                    <strong>Configuración Vina:</strong>
                    <div>Exhaustiveness: ${config.exhaustiveness || 'N/A'}</div>
                    <div>Num modes: ${config.num_modes || 'N/A'}</div>
                    <div>Energy range: ${config.energy_range || 'N/A'}</div>
                </div>
            `;
        }

        resultsDiv.innerHTML = `
            <div class="message-content">
                <div style="
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 1.5rem;
                ">
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
                        ${getIcon('check', '', 24)}
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 600;">Docking completado</h3>
                    </div>
                    
                    <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: 6px; margin-bottom: 1rem;">
                        <div><strong>Resultado de afinidad:</strong> ${result.affinity || 'N/A'} kcal/mol</div>
                        <div><strong>RMSD:</strong> ${result.rmsd || 'N/A'} Å</div>
                        ${vinaConfig}
                    </div>
                    
                    ${result.visualization_data ? `
                        <div style="padding: 1rem; background: var(--bg-tertiary); border-radius: 6px;">
                            <strong>3D Visualization:</strong>
                            <p style="font-size: 0.9rem; margin: 0.5rem 0;">
                                Estructura con ${result.visualization_data.atoms || 0} átomos cargada.
                            </p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        messagesContainer.appendChild(resultsDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    updateExperimentInfo(result) {
        console.log(icon('info') + ' Updating experiment info');
        // This could update an info panel with experiment details
    }

    handleChatMessage(data) {
        console.log(icon('info') + ' Chat message event:', data);
    }
}

// Global initialization
console.log(icon('build') + ' main.js loaded');

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log(icon('build') + ' DOMContentLoaded event fired');
    
    try {
        window.repoSudoeAI = new RePoSUDOEAI();
        window.repoSudoeAI.init();
        console.log(icon('success') + ' RePoSUDOEAI application initialized successfully');
    } catch (error) {
        console.error(icon('error') + ' Failed to initialize RePoSUDOEAI:', error);
    }
});
