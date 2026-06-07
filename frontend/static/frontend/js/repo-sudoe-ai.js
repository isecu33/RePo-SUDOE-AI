// File location: RePo-SUDOE-AI/frontend/static/frontend/js/repo-sudoe-ai.js

// Translations object
const translations = {
    es: {
        // Error messages
        genericError: 'Lo siento, hubo un error procesando tu mensaje.',
        connectionError: 'Error de conexión. ',
        internetError: 'Verifica tu conexión a internet y que el servidor esté disponible.',
        timeoutError: 'El servidor tardó demasiado en responder. Intenta de nuevo.',
        notFoundError: 'Endpoint no encontrado. Contacta con el administrador.',
        serverError: 'Error interno del servidor. Intenta de nuevo más tarde.',
        defaultError: 'Por favor intenta de nuevo. Si el problema persiste, verifica la consola del navegador.',

        // User actions
        yesLaunchExperiment: 'Sí, lanzar experimento',
        noCancel: 'No, cancelar',
        operationCancelled: 'Operación cancelada. ¿En qué más puedo ayudarte?',
        structureSelected: 'Estructura seleccionada:',
        customConfigApplied: 'Configuración personalizada aplicada',
        useDefaultConfig: 'Usar configuración por defecto',
        configCancelled: 'Configuración cancelada',
        whatElse: '¿En qué más puedo ayudarte?',
        selected: 'Seleccionado:',

        // Docking messages
        runningDockingAdvanced: '⚙️ Ejecutando docking con configuración avanzada:',
        autoBoxEnveloping: '🔧 Box enveloping automático aplicado:',
        processingExperiment: 'Procesando tu experimento con AutoDock Vina...',
        dockingFailed: '⚠ Docking Fallido',
        connectionErrorDocking: '⚠ Error de Conexión',
        failedToConnect: 'Error al conectar con el servidor. Por favor verifica tu conexión a internet e intenta de nuevo.',
        dockingResults: 'Resultados del Docking:',
        drug: 'Fármaco',
        gene: 'Gen',
        structure: 'Estructura',
        bindingAffinity: 'Afinidad de Unión',
        information: 'Información:',
        preparingVisualization: '🔄 Preparando visualización 3D... Ve a la pestaña "Output" para ver el resultado.',
        experiment: 'Experimento:',
        error: 'Error:',
        checkConfiguration: 'Por favor verifica la configuración del experimento e intenta de nuevo.',
        dockingCompletedNoResults: 'Docking completado pero no se generaron resultados',
        logFileNotFound: 'Archivo de log no encontrado. El experimento puede estar aún procesándose.',
        couldNotRetrieveError: 'No se pudieron obtener los detalles del error',
        cachedResults: 'Resultados cargados desde experimento previo',
        drugInformation: 'Información del Medicamento:',
        geneInformation: 'Información del Gen:',

        // Experiment analysis labels
        experimentInfo: 'Información Adicional del Experimento',
        experimentLabel: 'Experimento:',
        drugLabel: 'Fármaco:',
        geneProteinLabel: 'Gen/Proteína:',
        description: 'Descripción',
        indications: 'Indicaciones',
        status: 'Estado',
        molecularFormula: 'Fórmula Molecular',
        molecularWeight: 'Peso Molecular',
        fullName: 'Nombre Completo',
        function: 'Función',
        associatedDiseases: 'Enfermedades Asociadas',
        molecularPathways: 'Vías Moleculares',

        // Tips and suggestions
        tip: 'Consejo',
        canUseManualMode: 'Puedes subir estos archivos en la pestaña de Modo Manual para ejecutar el experimento aquí.',

        // Mode selection
        dockingConfiguration: 'Configuración de Docking',
        customizeVinaParams: 'Personalizar parámetros de AutoDock Vina',
        downloadFiles: 'Descargar archivos',
        downloadForExternal: 'Descargar archivos para uso externo',
        advancedConfiguration: 'Configuración Avanzada',
        downloadMode: 'Modo Descarga',

        // Vina configuration
        vinaConfigTitle: 'Configuración de AutoDock Vina',
        configureVinaParams: 'Configura los parámetros de AutoDock Vina:',
        boxConfiguration: 'Configuración de la Caja',
        boxEnveloping: 'Box Enveloping',
        boxCenterSize: 'Centro y tamaño de caja',
        padding: 'Padding',
        boxSize: 'Tamaño de Caja (X, Y, Z)',
        boxCenter: 'Centro de Caja (X, Y, Z)',
        executionParams: 'Parámetros de Ejecución',
        cpus: 'CPUs',
        exhaustiveness: 'Exhaustividad',
        verbosity: 'Verbosidad',
        seed: 'Seed',
        scoringFunction: 'Función de Scoring',
        vinaDefault: 'Vina (por defecto)',
        autoDock4: 'AutoDock 4',
        skipPreprocessing: 'Omitir preprocesamiento del receptor',
        runWithConfig: 'Ejecutar con esta configuración',
        cancel: 'Cancelar',

        // Configuration details
        boxMethod: 'Método de caja',
        automatic: 'Automático (Box Enveloping)',
        manual: 'Manual',
        cpuLabel: 'CPUs',
        exhaustivenessLabel: 'Exhaustividad',
        scoringLabel: 'Scoring'
    },
    en: {
        // Error messages
        genericError: 'Sorry, there was an error processing your message.',
        connectionError: 'Connection error. ',
        internetError: 'Check your internet connection and that the server is available.',
        timeoutError: 'The server took too long to respond. Please try again.',
        notFoundError: 'Endpoint not found. Contact the administrator.',
        serverError: 'Internal server error. Please try again later.',
        defaultError: 'Please try again. If the problem persists, check the browser console.',

        // User actions
        yesLaunchExperiment: 'Yes, launch experiment',
        noCancel: 'No, cancel',
        operationCancelled: 'Operation cancelled. How else can I help you?',
        structureSelected: 'Structure selected:',
        customConfigApplied: 'Custom configuration applied',
        useDefaultConfig: 'Use default configuration',
        configCancelled: 'Configuration cancelled',
        whatElse: 'How else can I help you?',
        selected: 'Selected:',

        // Docking messages
        runningDockingAdvanced: '⚙️ Running docking with advanced configuration:',
        autoBoxEnveloping: '🔧 Automatic box enveloping applied:',
        processingExperiment: 'Processing your experiment with AutoDock Vina...',
        dockingFailed: '⚠ Docking Failed',
        connectionErrorDocking: '⚠ Connection Error',
        failedToConnect: 'Failed to connect to the server. Please check your internet connection and try again.',
        dockingResults: 'Docking Results:',
        drug: 'Drug',
        gene: 'Gene',
        structure: 'Structure',
        bindingAffinity: 'Binding Affinity',
        information: 'Information:',
        preparingVisualization: '🔄 Preparing 3D visualization... Go to the "Output" tab to view the result.',
        experiment: 'Experiment:',
        error: 'Error:',
        checkConfiguration: 'Please check the experiment configuration and try again.',
        dockingCompletedNoResults: 'Docking completed but no results were generated',
        logFileNotFound: 'Log file not found. The experiment may still be processing.',
        couldNotRetrieveError: 'Could not retrieve error details',
        cachedResults: 'Results loaded from previous experiment',
        drugInformation: 'Drug Information:',
        geneInformation: 'Gene Information:',

        // Experiment analysis labels
        experimentInfo: 'Additional Experiment Information',
        experimentLabel: 'Experiment:',
        drugLabel: 'Drug:',
        geneProteinLabel: 'Gene/Protein:',
        description: 'Description',
        indications: 'Indications',
        status: 'Status',
        molecularFormula: 'Molecular Formula',
        molecularWeight: 'Molecular Weight',
        fullName: 'Full Name',
        function: 'Function',
        associatedDiseases: 'Associated Diseases',
        molecularPathways: 'Molecular Pathways',

        // Tips and suggestions
        tip: 'Tip',
        canUseManualMode: 'You can upload these files in the Manual Mode tab to run the experiment here.',

        // Mode selection
        dockingConfiguration: 'Docking Configuration',
        customizeVinaParams: 'Customize AutoDock Vina parameters',
        downloadFiles: 'Download files',
        downloadForExternal: 'Download files for external use',
        advancedConfiguration: 'Advanced Configuration',
        downloadMode: 'Download Mode',

        // Vina configuration
        vinaConfigTitle: 'AutoDock Vina Configuration',
        configureVinaParams: 'Configure AutoDock Vina parameters:',
        boxConfiguration: 'Box Configuration',
        boxEnveloping: 'Box Enveloping',
        boxCenterSize: 'Box center and size',
        padding: 'Padding',
        boxSize: 'Box Size (X, Y, Z)',
        boxCenter: 'Box Center (X, Y, Z)',
        executionParams: 'Execution Parameters',
        cpus: 'CPUs',
        exhaustiveness: 'Exhaustiveness',
        verbosity: 'Verbosity',
        seed: 'Seed',
        scoringFunction: 'Scoring Function',
        vinaDefault: 'Vina (default)',
        autoDock4: 'AutoDock 4',
        skipPreprocessing: 'Skip receptor preprocessing',
        runWithConfig: 'Run with this configuration',
        cancel: 'Cancel',

        // Configuration details
        boxMethod: 'Box method',
        automatic: 'Automatic (Box Enveloping)',
        manual: 'Manual',
        cpuLabel: 'CPUs',
        exhaustivenessLabel: 'Exhaustiveness',
        scoringLabel: 'Scoring'
    }
};

// Get current language from cookie or meta tag
function getCurrentLanguage() {
    // First try to get from cookie
    const name = 'django_language=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const cookies = decodedCookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i].trim();
        if (cookie.indexOf(name) === 0) {
            return cookie.substring(name.length, cookie.length);
        }
    }

    // If no cookie, try to get from meta tag
    const langMeta = document.querySelector('meta[name="language"]');
    if (langMeta) {
        return langMeta.getAttribute('content');
    }

    // Default to 'es'
    return 'es';
}

// Get translated message
function t(key) {
    const lang = getCurrentLanguage();
    return translations[lang][key] || translations['en'][key] || key;
}

console.log('✅ repo-sudoe-ai.js file loaded successfully');

class RePoSUDOEAI {
    constructor() {
        // Core application state
        this.chatHistory = [];
        this.currentChatId = null;
        this.currentTheme = localStorage.getItem('repo-sudoe-ai-theme') || 'light';
        this.currentDockingContext = null;
        this.currentResults = null;
        this.selectedPose = 0;
        this.pollingInterval = null; // For auto-polling new experiments

        // Initialize event bus and modules
        this.eventBus = new EventBus();
        this.fileManager = null;
        this.viewerManager = null;

        this.init();
    }

    init() {
        this.setupCSRF();
        this.setupTheme();
        this.setupNavigation();
        this.initializeModules();
        this.setupChat();
        this.setupDocking();
        this.setupBoxEnveloping();
        this.setupExecutionParameters();
        this.setupExperimentSelector();
        this.loadAvailableExperiments();
        console.log('RePo-SUDOE-AI initialized successfully with modular architecture');
    }

    // Initialize modules with dependency injection
    initializeModules() {
        // Initialize FileManager
        this.fileManager = new FileManager(this.eventBus, this.csrfToken);
        this.fileManager.init();

        // Initialize ViewerManager
        this.viewerManager = new ViewerManager(this.eventBus, this.csrfToken);
        this.viewerManager.init();

        // Setup inter-module communication
        this.setupModuleEventHandlers();

        console.log('Modules initialized successfully');
    }

    // Setup event handlers for inter-module communication
    setupModuleEventHandlers() {
        // Handle file upload events for docking button updates
        this.eventBus.on('fileUploaded', (data) => {
            this.updateDockingButton();
        });

        this.eventBus.on('fileUploadError', (data) => {
            alert(`Failed to upload ${data.type} file: ${data.error}`);
        });

        this.eventBus.on('dockingFilesChanged', (uploadedFiles) => {
            this.updateDockingButton();
        });

        // Handle viewer events
        this.eventBus.on('viewerInitialized', (data) => {
            console.log('Viewer initialized:', data);
        });
    }

    // Load available experiments from the server
    async loadAvailableExperiments() {
        console.log('🔍 Loading available experiments...');
        try {
            const response = await fetch('/api/list-experiments/', {
                method: 'GET',
                headers: {
                    'X-CSRFToken': this.csrfToken
                }
            });
            console.log('📡 Response status:', response.status, response.statusText);

            if (response.ok) {
                const data = await response.json();
                console.log('📦 Response data:', data);

                if (data.success && data.experiments) {
                    console.log('✅ Available experiments loaded:', data.experiments);
                    // Populate experiment selector dropdown
                    this.populateExperimentSelector(data.experiments);
                    return data.experiments;
                } else {
                    console.warn('⚠️ No experiments available or success=false');
                    this.populateExperimentSelector([]);
                    return [];
                }
            } else {
                const text = await response.text();
                console.error('❌ Failed to load available experiments, status:', response.status, 'body:', text);
                this.populateExperimentSelector([]);
                return [];
            }
        } catch (error) {
            console.error('❌ Error loading available experiments:', error);
            this.populateExperimentSelector([]);
            return [];
        }
    }

    // Populate the experiment selector dropdown
    populateExperimentSelector(experiments) {
        console.log('📝 populateExperimentSelector called with', experiments.length, 'experiments');
        const selector = document.getElementById('experiment-selector');
        console.log('🎯 Selector element:', selector);
        if (!selector) {
            console.error('❌ experiment-selector element not found in DOM!');
            return;
        }

        // Clear existing options
        selector.innerHTML = '';

        if (experiments.length === 0) {
            // No experiments available
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No experiments available';
            selector.appendChild(option);
            console.log('No experiments available for this user');
        } else {
            // Add default option
            const defaultOption = document.createElement('option');
            defaultOption.value = '';
            defaultOption.textContent = 'Select experiment...';
            selector.appendChild(defaultOption);

            // Add experiment options
            experiments.forEach(exp => {
                const option = document.createElement('option');
                option.value = exp.name;
                option.textContent = `${exp.name} (${exp.date})`;
                option.dataset.files = JSON.stringify(exp.files);
                selector.appendChild(option);
            });

            console.log(`Populated experiment selector with ${experiments.length} experiments`);
        }
    }

    // Sync experiment dropdown with currently loaded experiment
    syncExperimentDropdown(outputFilePath) {
        const selector = document.getElementById('experiment-selector');
        if (!selector) return;

        // Extract experiment name from output file path
        // outputFilePath might be like "/api/output/GENE_DRUG_out.pdbqt" or "GENE_DRUG_output.pdbqt"
        const fileName = outputFilePath.split('/').pop(); // Get filename
        // Remove suffix (either _out.pdbqt or _output.pdbqt)
        const experimentName = fileName.replace('_output.pdbqt', '').replace('_out.pdbqt', '');

        console.log('Syncing dropdown with experiment:', experimentName);

        // Find and select the matching option
        for (let i = 0; i < selector.options.length; i++) {
            const option = selector.options[i];
            if (option.value === experimentName) {
                selector.selectedIndex = i;
                console.log('Dropdown synced to:', experimentName);
                return;
            }
        }

        console.warn('Could not find experiment in dropdown:', experimentName);
    }

    // Setup experiment selector event listeners
    setupExperimentSelector() {
        const loadBtn = document.getElementById('load-selected-experiment');
        if (!loadBtn) return;

        loadBtn.addEventListener('click', async () => {
            const selector = document.getElementById('experiment-selector');
            const selectedOption = selector.options[selector.selectedIndex];

            if (!selectedOption || !selectedOption.value) {
                alert('Please select an experiment first');
                return;
            }

            const experimentName = selectedOption.value;
            const files = JSON.parse(selectedOption.dataset.files);

            console.log('Loading experiment:', experimentName, files);

            try {
                // Load receptor and output files for the selected experiment
                if (files.receptor && files.output) {
                    // Fetch file contents
                    const receptorResponse = await fetch(`/api/output/${files.receptor}`, {
                        headers: { 'X-CSRFToken': this.csrfToken }
                    });
                    const outputResponse = await fetch(`/api/output/${files.output}`, {
                        headers: { 'X-CSRFToken': this.csrfToken }
                    });

                    if (receptorResponse.ok && outputResponse.ok) {
                        const receptorData = await receptorResponse.json();
                        const outputData = await outputResponse.json();

                        // Load files into the enhanced viewer
                        if (this.viewerManager && this.viewerManager.enhancedViewer) {
                            const fileData = {
                                receptorFile: receptorData.content,
                                ligandFile: outputData.content
                            };
                            await this.viewerManager.enhancedViewer.loadExperimentFiles(fileData);
                        }

                        // Also load the log if available
                        if (files.log) {
                            this.loadExperimentLog(files.log);
                        }
                    } else {
                        alert('Failed to fetch experiment files');
                    }
                } else {
                    alert('Experiment files not complete');
                }
            } catch (error) {
                console.error('Error loading experiment:', error);
                alert('Failed to load experiment: ' + error.message);
            }
        });
    }

    // Load experiment log into the log panel
    async loadExperimentLog(logFilename) {
        try {
            const response = await fetch(`/api/output/${logFilename}`, {
                headers: {
                    'X-CSRFToken': this.csrfToken
                }
            });

            if (response.ok) {
                const data = await response.json();
                const logPanel = document.getElementById('log-panel');
                if (logPanel && data.content) {
                    logPanel.textContent = data.content;
                }
            }
        } catch (error) {
            console.error('Error loading experiment log:', error);
        }
    }


    // Configurar CSRF token para Django
    setupCSRF() {
        const csrfToken = document.querySelector('meta[name="csrf-token"]');
        this.csrfToken = csrfToken ? csrfToken.getAttribute('content') : '';
    }

    // Configurar tema y dark mode
    setupTheme() {
        this.setTheme(this.currentTheme);

        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            this.updateThemeToggleIcon(this.currentTheme);
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // Setup language toggle
        this.setupLanguageToggle();
    }

    setupLanguageToggle() {
        const languageToggle = document.getElementById('language-toggle');
        if (languageToggle) {
            // Get current language using the global function
            this.currentLanguage = getCurrentLanguage();
            languageToggle.textContent = this.currentLanguage.toUpperCase();

            languageToggle.addEventListener('click', () => {
                const newLang = this.currentLanguage === 'en' ? 'es' : 'en';
                this.setLanguage(newLang);
            });
        }
    }

    getLanguageCookie() {
        // Use the global getCurrentLanguage function for consistency
        return getCurrentLanguage();
    }

    setLanguage(lang) {
        console.log(`Switching language to: ${lang}`);

        // Create and submit form to Django's set_language view
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/i18n/setlang/';

        const languageInput = document.createElement('input');
        languageInput.type = 'hidden';
        languageInput.name = 'language';
        languageInput.value = lang;
        form.appendChild(languageInput);

        const csrfInput = document.createElement('input');
        csrfInput.type = 'hidden';
        csrfInput.name = 'csrfmiddlewaretoken';
        csrfInput.value = this.csrfToken;
        form.appendChild(csrfInput);

        const nextInput = document.createElement('input');
        nextInput.type = 'hidden';
        nextInput.name = 'next';
        nextInput.value = window.location.pathname;
        form.appendChild(nextInput);

        document.body.appendChild(form);
        form.submit();
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('repo-sudoe-ai-theme', theme);
        this.currentTheme = theme;
        this.updateViewerBackgrounds(theme);
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        this.updateThemeToggleIcon(newTheme);
        console.log(`RePo-SUDOE-AI theme switched to: ${newTheme}`);
    }

    updateThemeToggleIcon(theme) {
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            themeToggle.title = theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';
        }
    }

    updateViewerBackgrounds(theme) {
        const viewers = document.querySelectorAll('.viewer_3Dmoljs');
        const backgroundColor = theme === 'dark' ? '0x1a1f2e' : '0xffffff';

        console.log(`Updating viewer backgrounds to ${backgroundColor} for theme: ${theme}`);

        viewers.forEach(viewer => {
            viewer.setAttribute('data-backgroundcolor', backgroundColor);
        });

        // Update the global viewer instances if they exist
        if (window.$3Dmol) {
            // Update preview viewer
            if (window.current3DMolViewer) {
                console.log('Updating current3DMolViewer background');
                try {
                    window.current3DMolViewer.setBackgroundColor(backgroundColor);
                    window.current3DMolViewer.render();
                } catch (e) {
                    console.error('Error updating current3DMolViewer:', e);
                }
            }

            // Update any other active viewers
            if (window.fileHandler && window.fileHandler.previewViewer) {
                console.log('Updating fileHandler.previewViewer background');
                try {
                    window.fileHandler.previewViewer.setBackgroundColor(backgroundColor);
                    window.fileHandler.previewViewer.render();
                } catch (e) {
                    console.error('Error updating fileHandler.previewViewer:', e);
                }
            }
        }
    }

    // Configurar navegación
    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        
        console.log('🔗 Setting up navigation with', navLinks.length, 'nav links');

        navLinks.forEach((link, index) => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const targetId = link.getAttribute('data-section');
                console.log(`✅ Navigation clicked on link ${index}: navigating to section "${targetId}"`);
                
                this.showSection(targetId);
                this.updateActiveNav(link);
            });
        });
    }

    showSection(sectionId) {
        console.log(`📂 showSection called with sectionId: "${sectionId}"`);
        
        // Hide all sections
        const allSections = document.querySelectorAll('.section');
        console.log(`   Found ${allSections.length} sections total`);
        
        allSections.forEach(section => {
            if (section.classList.contains('active')) {
                console.log(`   Hiding section: ${section.id}`);
            }
            section.classList.remove('active');
        });

        // Show target section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            console.log(`   Showing target section: ${sectionId}`);
            targetSection.classList.add('active');
        } else {
            console.warn(`   ⚠️ Target section with id "${sectionId}" not found!`);
        }
    }

    updateActiveNav(activeLink) {
        const allLinks = document.querySelectorAll('.nav-link');
        allLinks.forEach(link => {
            link.classList.remove('active');
        });
        activeLink.classList.add('active');
        console.log(`   Updated active nav link`);
    }






    // Configurar chat con nuevo flujo simplificado
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
            // Use 50px when empty, otherwise use scrollHeight (max 200px)
            const newHeight = chatInput.value.trim() === '' ? 50 : Math.min(chatInput.scrollHeight, 200);
            chatInput.style.height = newHeight + 'px';
        });

        // Set initial height
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
                    this.addMessageToChat(t('genericError'), 'assistant', true);
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

            this.addMessageToChat(errorMessage, 'assistant', true);
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
        let message = `❌ ${result.error || result.message}`;
        
        if (result.suggestions && result.suggestions.length > 0) {
            message += '\n\n💡 **Sugerencias:**';
            result.suggestions.forEach(suggestion => {
                message += `\n• ${suggestion}`;
            });
        }
        
        // Añadir información adicional útil
        message += '\n\n🔍 **¿Qué puedes hacer?**';
        message += '\n• Verifica la ortografía del medicamento y gen';
        message += '\n• Usa los nombres sugeridos arriba';
        message += '\n• Pregunta "¿qué proteínas hay disponibles?" para ver opciones';
        
        // Mostrar como mensaje de asistente normal, no como error
        this.addMessageToChat(message, 'assistant');
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
                    <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                        <button class="confirm-btn yes" style="background: var(--accent-color); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 500;">
                            ✅ ${t('yesLaunchExperiment')}
                        </button>
                        <button class="confirm-btn no" style="background: var(--danger-color); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 8px; cursor: pointer; font-weight: 500;">
                            ❌ ${t('noCancel')}
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

    // Nuevo método para manejar configuración avanzada
    handleAdvancedConfiguration(result, originalMessage) {
        // Don't show the message, only the panel

        // Crear interfaz de configuración avanzada
        const messagesContainer = document.getElementById('chat-messages');
        const configDiv = document.createElement('div');
        configDiv.className = 'message assistant-message';

        configDiv.innerHTML = `
            <div class="message-content" style="max-width: 800px;">
                <div class="vina-configuration">
                    <h4 style="color: var(--text-primary);">⚙️ ${t('vinaConfigTitle')}</h4>

                    <!-- Box configuration -->
                    <div class="config-section">
                        <h5>📦 ${t('boxConfiguration')}</h5>
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
                        <h5>⚡ ${t('executionParams')}</h5>
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
                            🚀 ${t('runWithConfig')}
                        </button>
                        <button class="config-btn cancel" style="background: var(--blue-color); color: white; border: none; padding: 1rem 2rem; border-radius: 8px; cursor: pointer; font-weight: 500;">
                            ❌ ${t('cancel')}
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
            let config = this.collectVinaConfiguration(configDiv);

            // Note: For chat-based docking, box enveloping is calculated on the backend
            // We only need to pass the flag and padding parameter
            // The backend will calculate the box based on the downloaded PDB/SDF files

            configDiv.remove();
            
            this.addMessageToChat(t('customConfigApplied'), 'user');
            this.addMessageToChat(`${t('runningDockingAdvanced')}
                • ${t('boxMethod')}: ${config.use_box_enveloping ? t('automatic') : t('manual')}
                • ${t('padding')}: ${config.padding ? config.padding + ' Å' : 'N/A'}
                • ${t('cpuLabel')}: ${config.cpu}
                • ${t('exhaustivenessLabel')}: ${config.exhaustiveness}
                • ${t('scoringLabel')}: ${config.scoring}`, 'assistant');
            
            // Enviar configuración al backend
            this.sendChatMessage(originalMessage, { 
                confirmacion: true,
                estructura_seleccionada: result.structure,
                manual_mode: false,
                vina_config: config,
                isAutoResponse: true 
            });
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


    // Get box parameters from UI (backward compatibility method)
    getBoxEnvelopingFromUI() {
        // Combine manual box parameters and execution parameters
        let config = { use_custom_box: false, use_custom_execution: false };
        
        const boxParams = this.getManualBoxParameters();
        if (boxParams) {
            config = { ...config, ...boxParams };
        }
        
        const execParams = this.getManualExecutionParameters();
        if (execParams) {
            config = { ...config, ...execParams };
        }
        
        return config;
    }

    // Actualizar handleModeSelection para incluir configuración avanzada
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
                                style="background: var(--blue-color); color: white; border: none; padding: 1rem; border-radius: 8px; cursor: pointer; text-align: left;">
                            ⚙️ ${t('dockingConfiguration')}
                            <div style="font-size: 0.9rem; opacity: 0.9; margin-top: 0.5rem;">${t('customizeVinaParams')}</div>
                        </button>
                        <button class="mode-btn manual" data-mode="manual"
                                style="background: var(--text-secondary); color: white; border: none; padding: 1rem; border-radius: 8px; cursor: pointer; text-align: left;">
                            📥 ${t('downloadFiles')}
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
        // NUEVO: Mostrar información adicional si está disponible
        if (result.experiment_analysis && result.experiment_analysis.drug_name) {
            this.displayExperimentAnalysis(result.experiment_analysis);
        }

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

        // Generate binding affinity display if available
        const bindingAffinityHTML = (analysis.binding_affinity !== undefined && analysis.binding_affinity !== null) ? `
        <div style="font-size: 1rem; color: var(--text-primary); margin-top: 0.75rem; padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px; border-left: 3px solid var(--accent-color);">
            <strong>🎯 ${t('bindingAffinity')}:</strong> ${analysis.binding_affinity} kcal/mol
            ${analysis.affinity_classification ? `<span style="color: var(--accent-color); font-weight: 600;"> (${analysis.affinity_classification})</span>` : ''}
        </div>
        ` : '';

        // Crear el HTML con información de la base de datos
        analysisDiv.innerHTML = `
            <div class="message-content">
                <div style="
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 1.5rem;
                    margin-bottom: 1rem;
                ">
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border-color);">
                        <span style="font-size: 1.5rem;">ℹ️</span>
                        <h3 style="margin: 0; font-size: 1.2rem; font-weight: 600; color: var(--text-primary);">${t('experimentInfo')}</h3>
                    </div>

                    <!-- Información del Experimento -->
                    <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
                        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                            <strong style="color: var(--text-primary);">${t('experimentLabel')}</strong>
                            ${analysis.drug_name} ⚡ ${analysis.gene_name}
                            ${analysis.pdb_structure ? `(${analysis.pdb_structure})` : ''}
                        </div>
                        ${bindingAffinityHTML}
                        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.5rem;">
                            ${analysis.timestamp || ''}
                        </div>
                    </div>

                    <!-- Información del Fármaco -->
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

                    <!-- Información del Gen/Proteína -->
                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                            <span style="font-size: 1.2rem;">🧬</span>
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

    async handleDockingComplete(result) {
        const isCached = result.docking_results.cached === true;

        // NUEVO: Mostrar análisis si está disponible y no se mostró antes
        if (result.experiment_analysis && result.experiment_analysis.drug_name) {
            this.displayExperimentAnalysis(result.experiment_analysis);
        }

        // Check if experiment has binding affinity (success indicator)
        const hasResults = result.docking_results && result.docking_results.binding_affinity !== null;

        if (!hasResults) {
            // Experiment failed - check log for error
            const errorMessage = await this.checkExperimentError(result.structure, result.drug);

            const message = `
                ❌ **${t('dockingFailed')}**

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

        const statusIcon = isCached ? '💾' : '✅';
        const statusText = isCached ? t('cachedResults') : result.message;

        const message = `
            ${statusIcon} ${statusText}

            **${t('dockingResults')}**
            • ${t('drug')}: ${result.drug}
            • ${t('gene')}: ${result.gene}
            • ${t('structure')}: ${result.structure}
            • ${t('bindingAffinity')}: ${result.docking_results.binding_affinity} kcal/mol

            **${t('information')}**
            ${this.formatCompoundInfo(result.compound_info)}

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
            this.viewerManager.loadVinaOutputFile(result.drug, result.structure);
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
            ❌ **${t('dockingFailed')}**

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

    formatCompoundInfo(info) {
        let formatted = '';

        if (info.drug_info && Object.keys(info.drug_info).length > 0) {
            formatted += `\n**${t('drugInformation')}**\n`;
            Object.entries(info.drug_info).forEach(([key, value]) => {
                if (value) {
                    formatted += `• ${key}: ${value}\n`;
                }
            });
        }

        if (info.gene_info && Object.keys(info.gene_info).length > 0) {
            formatted += `\n**${t('geneInformation')}**\n`;
            Object.entries(info.gene_info).forEach(([key, value]) => {
                if (value) {
                    formatted += `• ${key}: ${value}\n`;
                }
            });
        }

        return formatted;
    }

    // Parse Vina log file to extract specific sections
    parseVinaLog(logContent) {
        const lines = logContent.split('\n');
        let filteredLog = '';
        
        // Extract configuration parameters
        let config = {};
        let inConfig = false;
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
                // Get the next few lines for progress bar
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
                // Get the next line with column headers
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

    // Configurar docking manual
    setupDocking() {
        const runDockingBtn = document.getElementById('run-docking-btn');
        if (runDockingBtn) {
            runDockingBtn.addEventListener('click', () => {
                this.runDocking();
            });
        }
    }

    // Setup manual box configuration UI
    setupBoxEnveloping() {
        console.log('Setting up manual box configuration');
        
        // Get UI elements
        const enableCheckbox = document.getElementById('enable-custom-box');
        const boxInputs = document.querySelectorAll('#box-center-x, #box-center-y, #box-center-z, #box-size-x, #box-size-y, #box-size-z');
        const previewBtn = document.getElementById('preview-box-btn');
        const clearBtn = document.getElementById('clear-box-btn');
        
        // Enable/disable box parameters based on checkbox
        if (enableCheckbox) {
            const toggleParams = () => {
                const isEnabled = enableCheckbox.checked;
                
                boxInputs.forEach(input => {
                    input.disabled = !isEnabled;
                    input.style.opacity = isEnabled ? '1' : '0.5';
                });
                
                // Enable/disable preview buttons
                if (previewBtn) previewBtn.disabled = !isEnabled;
                if (clearBtn) clearBtn.disabled = !isEnabled;
                
                console.log(`Custom box parameters ${isEnabled ? 'enabled' : 'disabled'}`);
            };
            
            enableCheckbox.addEventListener('change', toggleParams);
            toggleParams(); // Initial state (disabled by default)
        }
        
        // Preview box button
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

        // Clear box button
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

        // Auto-update preview when input values change (if preview is currently shown)
        boxInputs.forEach(input => {
            input.addEventListener('input', () => {
                // Only auto-update if custom box is enabled and has valid values
                if (this.isCustomBoxEnabled() && this.viewerManager && this.viewerManager.previewViewer) {
                    // Debounce the update to avoid too many redraws
                    clearTimeout(this.boxPreviewTimeout);
                    this.boxPreviewTimeout = setTimeout(() => {
                        this.viewerManager.updateBoxPreviewIfVisible();
                    }, 500);
                }
            });
        });
        
        console.log('Manual box configuration setup complete');
    }

    // Setup execution parameters UI
    setupExecutionParameters() {
        console.log('Setting up execution parameters configuration');
        
        // Get UI elements
        const enableCheckbox = document.getElementById('enable-custom-params');
        const paramInputs = document.querySelectorAll('#exhaustiveness, #num-modes, #energy-range, #cpu-cores, #seed');
        
        // Enable/disable execution parameters based on checkbox
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
            toggleParams(); // Initial state (disabled by default)
        }
        
        console.log('Execution parameters configuration setup complete');
    }

    // Check if custom box parameters are enabled in UI
    isCustomBoxEnabled() {
        const enableCheckbox = document.getElementById('enable-custom-box');
        return enableCheckbox ? enableCheckbox.checked : false;
    }

    // Get manual box parameters from UI
    getManualBoxParameters() {
        const enableCustomBoxElement = document.getElementById('enable-custom-box');
        const useCustomBox = enableCustomBoxElement ? enableCustomBoxElement.checked : false;

        if (!useCustomBox) {
            return {
                use_box_enveloping: true,
                padding: 2.0
            };
        }

        return {
            use_box_enveloping: false,
            box_center: [
                parseFloat(document.getElementById('box-center-x').value) || 0,
                parseFloat(document.getElementById('box-center-y').value) || 0,
                parseFloat(document.getElementById('box-center-z').value) || 0
            ],
            box_size: [
                parseFloat(document.getElementById('box-size-x').value) || 20,
                parseFloat(document.getElementById('box-size-y').value) || 20,
                parseFloat(document.getElementById('box-size-z').value) || 20
            ]
        };
    }

    // Check if custom execution parameters are enabled in UI
    isCustomExecutionEnabled() {
        const enableCheckbox = document.getElementById('enable-custom-params');
        return enableCheckbox ? enableCheckbox.checked : false;
    }

    // Get manual execution parameters from UI
    getManualExecutionParameters() {
        if (!this.isCustomExecutionEnabled()) {
            return null;
        }

        const exhaustivenessInput = document.getElementById('exhaustiveness');
        const numModesInput = document.getElementById('num-modes');
        const energyRangeInput = document.getElementById('energy-range');
        const cpuCoresInput = document.getElementById('cpu-cores');
        const seedInput = document.getElementById('seed');

        const params = {
            use_custom_execution: true
        };

        // Only add parameters that have values
        if (exhaustivenessInput?.value) {
            params.exhaustiveness = parseInt(exhaustivenessInput.value);
        }
        
        if (numModesInput?.value) {
            params.num_modes = parseInt(numModesInput.value);
        }
        
        if (energyRangeInput?.value) {
            params.energy_range = parseFloat(energyRangeInput.value);
        }
        
        if (cpuCoresInput?.value) {
            params.cpu = parseInt(cpuCoresInput.value);
        }
        
        if (seedInput?.value) {
            params.seed = parseInt(seedInput.value);
        }

        return params;
    }

    updateDockingButton() {
        const runDockingBtn = document.getElementById('run-docking-btn');
        if (!runDockingBtn) return;

        // Get uploaded files from file manager
        const uploadedFiles = this.fileManager ? this.fileManager.getUploadedFiles() : {};

        // Check if required files are uploaded successfully and have server file paths
        const hasReceptor = uploadedFiles.receptor &&
                           uploadedFiles.receptor.success &&
                           uploadedFiles.receptor.file_path;

        const hasDrug = uploadedFiles.drug &&
                       uploadedFiles.drug.success &&
                       uploadedFiles.drug.file_path;

        const hasRequired = hasReceptor && hasDrug;

        runDockingBtn.disabled = !hasRequired;

        if (hasRequired) {
            runDockingBtn.textContent = '🧬 Run Molecular Docking with RePo-SUDOE-AI';
            runDockingBtn.title = 'Click to start molecular docking experiment';
        } else {
            // Show different messages based on what's missing
            if (!uploadedFiles.receptor && !uploadedFiles.drug) {
                runDockingBtn.textContent = '🧬 Upload receptor and drug files first';
            } else if (!hasReceptor) {
                runDockingBtn.textContent = '🧬 Upload receptor file first';
            } else if (!hasDrug) {
                runDockingBtn.textContent = '🧬 Upload drug file first';
            }
            runDockingBtn.title = 'Upload required files to enable docking';
        }
    }

    async runDocking() {
        const outputContent = document.getElementById('results-fallback');
        const runDockingBtn = document.getElementById('run-docking-btn');
        if (!outputContent || !runDockingBtn) return;

        // Get uploaded files early for use in loading display
        const uploadedFiles = this.fileManager ? this.fileManager.getUploadedFiles() : {};

        // Set button to loading state
        const originalButtonText = runDockingBtn.textContent;
        runDockingBtn.disabled = true;
        runDockingBtn.textContent = '⏳ Running Experiment...';
        runDockingBtn.style.opacity = '0.7';

        // Hide entire input tab and show loading card
        const manualSection = document.getElementById('manual');
        const mainContent = document.querySelector('.main-content');
        
        console.log('🔍 Loading display setup:', { manualSection: !!manualSection, mainContent: !!mainContent });
        
        if (manualSection && mainContent) {
            console.log('✅ Found manual section, hiding input tab and creating loading display');
            
            // Hide the entire manual mode section
            manualSection.style.display = 'none';
            
            // Create loading overlay that replaces the entire input ta b
            const loadingDiv = document.createElement('section');
            loadingDiv.id = 'docking-loading-section';
            loadingDiv.className = 'section manual-section';
            loadingDiv.innerHTML = `
                <div class="section-content" style="display: flex; justify-content: center; align-items: center; min-height: 80vh;">
                    <div style="text-align: center; padding: 4rem 3rem; background: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 600px; width: 100%;">
                        <div class="spinner-large" style="margin: 0 auto 2rem auto; width: 80px; height: 80px;">
                            <div class="spinner" style="width: 80px; height: 80px; border: 8px solid var(--bg-secondary); border-top: 8px solid var(--accent-color); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                        </div>
                        <h2 style="margin: 0 0 1rem 0; color: var(--text-primary); font-size: 1.5rem;">🧬 Running Molecular Docking Experiment</h2>
                        <p style="margin: 0 0 2rem 0; color: var(--text-secondary); font-size: 1.1rem;">${t('processingExperiment')}</p>
                        
                        <div style="background: var(--bg-secondary); padding: 1.5rem; border-radius: 8px; margin: 2rem 0; text-align: left;">
                            <div style="margin-bottom: 1rem; font-size: 1rem; font-weight: 600; color: var(--text-primary);">📁 Experiment Files:</div>
                            <div style="font-family: monospace; font-size: 0.9rem; color: var(--text-secondary); line-height: 1.5;">
                                <div style="margin-bottom: 0.5rem;">🧪 <strong>Receptor:</strong> ${uploadedFiles.receptor.filename}</div>
                                <div style="margin-bottom: 0.5rem;">💊 <strong>Drug:</strong> ${uploadedFiles.drug.filename}</div>
                                ${uploadedFiles.pose ? `<div>📍 <strong>Pose:</strong> ${uploadedFiles.pose.filename}</div>` : ''}
                            </div>
                        </div>
                        
                        <div style="margin-top: 2rem; padding: 1rem; background: linear-gradient(135deg, var(--accent-color-light), var(--accent-color)); border-radius: 8px; color: white;">
                            <div style="font-size: 0.9rem; opacity: 0.9;">Please wait while we perform the molecular docking analysis...</div>
                        </div>
                    </div>
                </div>
            `;
            
            // Add CSS for spinner animation if not exists
            if (!document.getElementById('spinner-animation')) {
                const style = document.createElement('style');
                style.id = 'spinner-animation';
                style.textContent = `
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Insert loading section after the manual section
            manualSection.parentNode.insertBefore(loadingDiv, manualSection.nextSibling);
            console.log('✅ Loading section created and input tab hidden');

            // Keep the manual tab active to show the loading screen
            // Don't switch to output until experiment is complete
        }
        
        // Get manual box configuration from UI
        let vinaConfig = {};
        const manualBoxParams = this.getManualBoxParameters();
        if (manualBoxParams) {
            vinaConfig = { ...vinaConfig, ...manualBoxParams };
            console.log('Applied manual box configuration to docking:', manualBoxParams);
        }

        // Get manual execution parameters from UI
        const manualExecParams = this.getManualExecutionParameters();
        if (manualExecParams) {
            vinaConfig = { ...vinaConfig, ...manualExecParams };
            console.log('Applied manual execution parameters to docking:', manualExecParams);
        }
        
        // Create configuration info display
        let configInfo = '';
        if (vinaConfig.use_custom_box) {
            configInfo += `<div class="config-info" style="margin-top: 1rem; padding: 0.5rem; background: var(--bg-secondary); border-radius: 4px; font-size: 0.9rem;">
                📦 Custom Box: Center [${vinaConfig.box_center.map(c => c.toFixed(1)).join(', ')}], Size [${vinaConfig.box_size.map(s => s.toFixed(1)).join(', ')}] Å
            </div>`;
        }
        if (vinaConfig.use_custom_execution) {
            const execParams = [];
            if (vinaConfig.exhaustiveness) execParams.push(`Exhaustiveness: ${vinaConfig.exhaustiveness}`);
            if (vinaConfig.num_modes) execParams.push(`Modes: ${vinaConfig.num_modes}`);
            if (vinaConfig.energy_range) execParams.push(`Energy Range: ${vinaConfig.energy_range} kcal/mol`);
            if (vinaConfig.cpu) execParams.push(`CPUs: ${vinaConfig.cpu}`);
            if (vinaConfig.seed) execParams.push(`Seed: ${vinaConfig.seed}`);
            
            if (execParams.length > 0) {
                configInfo += `<div class="config-info" style="margin-top: 0.5rem; padding: 0.5rem; background: var(--bg-secondary); border-radius: 4px; font-size: 0.9rem;">
                    ⚙️ Custom Parameters: ${execParams.join(', ')}
                </div>`;
            }
        }

        outputContent.innerHTML = `
            <div class="docking-progress">
                <div class="spinner-large"></div>
                <h3>Running Molecular Docking Simulation</h3>
                <p>This may take a few minutes...</p>
                ${configInfo}
            </div>
        `;
        
        try {
            // Validate uploaded files exist
            if (!uploadedFiles.receptor || !uploadedFiles.drug) {
                throw new Error('Required files not uploaded');
            }

            const requestBody = {
                receptor_file: uploadedFiles.receptor.file_path,
                drug_file: uploadedFiles.drug.file_path,
                pose_file: uploadedFiles.pose?.file_path || null,
            };
            
            // Add box enveloping configuration if available
            if (Object.keys(vinaConfig).length > 0) {
                requestBody.vina_config = vinaConfig;
            }
            
            // Log the request being sent
            console.log('VINA DOCKING REQUEST:');
            console.log('  Files:', {
                receptor: uploadedFiles.receptor.file_path,
                drug: uploadedFiles.drug.file_path,
                pose: uploadedFiles.pose?.file_path || 'none'
            });
            console.log('  Configuration:', vinaConfig);
            console.log('  Full request body:', requestBody);
            
            const response = await fetch('/api/docking/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.csrfToken
                },
                body: JSON.stringify(requestBody)
            });
            
            const result = await response.json();
            
            // Log the response from backend
            console.log(' VINA DOCKING RESPONSE:');
            console.log('  ✅ Success:', result.success);
            if (result.success) {
                console.log('  Results:', result.results);
                
                // Log the actual Vina command that was executed
                if (result.results?.docker_command) {
                    console.log('  DOCKER COMMAND EXECUTED:');
                    console.log('    ', result.results.docker_command);
                }
                
                if (result.results?.execution_time) {
                    console.log('   Execution time:', result.results.execution_time + 's');
                }
                if (result.results?.binding_affinity) {
                    console.log('  Binding affinity:', result.results.binding_affinity + ' kcal/mol');
                }
                
                if (result.results?.config_used) {
                    console.log('  Final configuration used:', result.results.config_used);
                }
                
                // Log all available result keys for debugging
                console.log('  All result keys:', Object.keys(result.results || {}));
                console.log('  Complete results object:', result.results);
            } else {
                console.log('  ❌ Error:', result.error);
            }
            
            if (result.success) {
                // Reset button to success state
                runDockingBtn.disabled = false;
                runDockingBtn.textContent = '✅ Experiment Complete';
                runDockingBtn.style.opacity = '1';
                runDockingBtn.style.backgroundColor = 'var(--success-color)';
                
                // Success - button shows success state
                
                this.currentResults = result;
                
                // Restore input tab first before showing output
                this.restoreInputTabAfterDocking();

                // Switch to output tab to show results
                this.showSection('output');

                // Render results in output viewer
                const pdbId = uploadedFiles.receptor.filename.replace(/\.[^/.]+$/, "");
                const drugName = uploadedFiles.drug.filename.replace(/\.[^/.]+$/, ""); // Remove file extension

                // Wait for tab switch to complete before loading
                setTimeout(() => {
                    if (this.viewerManager) {
                        console.log('Manual mode: loading results into output viewer:', { pdbId, drugName });
                        this.viewerManager.loadVinaOutputFile(drugName, pdbId);

                        // Use the ViewerManager instance to load the log
                        this.viewerManager.loadExperimentLogFromSelector(pdbId, drugName);
                        console.log('Experiment loaded successfully from selector');

                        // Update experiment information panel with results
                        this.updateExperimentInfo(result.results);
                    } else {
                        console.error('ViewerManager not initialized');
                    }
                }, 100);
                
                // Reset button after 3 seconds
                setTimeout(() => {
                    runDockingBtn.textContent = originalButtonText;
                    runDockingBtn.style.backgroundColor = '';
                }, 3000);
                
            } else {
                // Reset button to error state
                runDockingBtn.disabled = false;
                runDockingBtn.textContent = '❌ Experiment Failed';
                runDockingBtn.style.opacity = '1';
                runDockingBtn.style.backgroundColor = 'var(--error-color)';

                // Restore input tab first
                this.restoreInputTabAfterDocking();
                
                // Explicitly stay on input tab (don't go to output)
                this.showSection('input');

                // Extract error details for logging only
                const errorDetails = result.error || 'Unknown error occurred';
                console.error('Manual docking error:', {
                    error: errorDetails,
                    stdout: result.results?.stdout || result.stdout || '',
                    stderr: result.results?.stderr || result.stderr || '',
                    fullResult: result
                });

                // Reset button after 3 seconds
                setTimeout(() => {
                    runDockingBtn.textContent = originalButtonText;
                    runDockingBtn.style.backgroundColor = '';
                }, 3000);
            }
        } catch (error) {
            // Reset button to error state
            runDockingBtn.disabled = false;
            runDockingBtn.textContent = `❌ ${t('connectionErrorDocking')}`;
            runDockingBtn.style.opacity = '1';
            runDockingBtn.style.backgroundColor = 'var(--error-color)';

            // Restore input tab first
            this.restoreInputTabAfterDocking();
            
            // Explicitly stay on input tab (don't go to output)
            this.showSection('input');

            // Log error for debugging
            console.error('Connection error during docking:', error);

            // Reset button after 3 seconds
            setTimeout(() => {
                runDockingBtn.textContent = originalButtonText;
                runDockingBtn.style.backgroundColor = '';
            }, 3000);
        }
    }

    renderDockingResults(results, compoundInfo = null) {
        console.log("🔬 Rendering docking results:", results);

        // Update experiment info panel
        this.updateExperimentInfo(results, compoundInfo);

        // Show the experiment info panel
        const experimentInfo = document.getElementById('experiment-info');
        if (experimentInfo) {
            experimentInfo.style.display = 'block';
        }

        // Load available experiments for selection (this will include our new manual experiment)
        this.loadAvailableExperiments().then(() => {
            // After loading experiments, sync dropdown with current experiment
            if (results.output_file_path) {
                this.syncExperimentDropdown(results.output_file_path);
            }
        });

        // Setup integrated visualizer controls (handled by ViewerManager)
        // this.setupIntegratedVisualizerControls() - moved to ViewerManager

        // Try to load the visualization using different methods
        console.log("🔍 Looking for visualization files in results:", {
            'output_file_path': results.output_file_path,
            'manual_command': results.manual_command,
            'binding_affinity': results.binding_affinity
        });

        // Method 1: Direct file path from results
        if (results.output_file_path) {
            console.log("✅ Using direct output file path");
            setTimeout(() => {
                this.loadMolecularData(results.output_file_path);
            }, 1000);
        }else{

        }
    }

    updateExperimentInfo(results, compoundInfo = null) {
        const experimentInfo = document.getElementById('experiment-info');
        const experimentName = document.getElementById('experiment-name');
        const experimentAffinity = document.getElementById('experiment-affinity');
        
        console.log('🔍 Updating experiment info:', { results, compoundInfo, experimentInfo: !!experimentInfo });
        
        if (experimentInfo && experimentName && experimentAffinity) {
            let displayName;
            
            // Check if this is from chat-based docking (has drug/gene/structure) or manual docking
            if (this.currentResults?.drug && this.currentResults?.gene && this.currentResults?.structure) {
                // Chat-based docking
                const drug = this.currentResults.drug;
                const structure = this.currentResults.structure;
                displayName = `${structure} + ${drug}`;
            } else {
                // Manual docking - use uploaded file names from file manager
                const uploadedFiles = this.fileManager ? this.fileManager.getUploadedFiles() : {};
                const receptorName = uploadedFiles?.receptor ?
                    uploadedFiles.receptor.filename.replace(/\.[^/.]+$/, "") : 'Manual Receptor';
                const drugName = uploadedFiles?.drug ?
                    uploadedFiles.drug.filename.replace(/\.[^/.]+$/, "") : 'Manual Drug';
                displayName = `${receptorName} + ${drugName}`;
            }
            
            experimentName.textContent = displayName;

            // Format binding affinity
            console.log('🔍 Results object for affinity:', results);
            const affinityValue = results.binding_affinity || results.poses?.[0]?.affinity || 'N/A';
            console.log('🔍 Extracted affinity value:', affinityValue);
            experimentAffinity.textContent = affinityValue !== 'N/A' ? `${affinityValue} kcal/mol` : 'N/A';

            experimentInfo.style.display = 'block';
        }
    }


    // Restore input tab after docking completion
    restoreInputTabAfterDocking() {
        try {
            console.log('🔄 Restoring input tab after docking completion');
            
            // Remove loading section
            const loadingSection = document.getElementById('docking-loading-section');
            console.log('🔍 Loading section found:', !!loadingSection);
            if (loadingSection) {
                loadingSection.remove();
                console.log('✅ Loading section removed');
            }
            
            // Show manual section again
            const manualSection = document.getElementById('manual');
            console.log('🔍 Manual section found:', !!manualSection);
            if (manualSection) {
                manualSection.style.display = 'block';
                console.log('✅ Manual section restored');
            }
            
            console.log('✅ Input tab restored after docking completion');
        } catch (error) {
            console.error('❌ Error restoring input tab:', error);
        }
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.repoSudoeAI && window.repoSudoeAI.pollingInterval) {
        clearInterval(window.repoSudoeAI.pollingInterval);
    }
});

// Añadir estilos adicionales para elementos dinámicos
document.addEventListener('DOMContentLoaded', () => {
    const dynamicStyles = document.createElement('style');
    dynamicStyles.textContent = `
        /* Estilos para elementos dinámicos del chat */
        .confirmation-controls, 
        .structure-selection, 
        .mode-selection, 
        .download-links {
            margin: 1rem 0;
        }
        
        .confirm-btn, 
        .structure-btn, 
        .mode-btn,
        .config-btn {
            transition: all 0.2s ease;
            font-family: inherit;
        }
        
        .confirm-btn:hover, 
        .structure-btn:hover, 
        .mode-btn:hover,
        .config-btn:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        
        .confirm-btn:active, 
        .structure-btn:active, 
        .mode-btn:active,
        .config-btn:active {
            transform: translateY(0);
        }
        
        /* Animaciones para mensajes */
        .message {
            animation: messageSlideIn 0.3s ease-out;
        }
        
        @keyframes messageSlideIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        /* Estilos para elementos de carga */
        .loading-indicator {
            display: none;
            align-items: center;
            gap: 0.5rem;
            padding: 1rem 0;
            color: var(--text-secondary);
        }
        
        .loading-indicator.show {
            display: flex;
        }
        
        /* Mejoras para accesibilidad */
        .confirm-btn:focus,
        .structure-btn:focus,
        .mode-btn:focus,
        .config-btn:focus {
            outline: 2px solid var(--accent-color);
            outline-offset: 2px;
        }
        
        /* Responsive adjustments para elementos dinámicos */
        @media (max-width: 768px) {
            .confirmation-controls,
            .structure-selection,
            .mode-selection {
                margin: 0.5rem 0;
            }
            
            .confirm-btn,
            .structure-btn,
            .mode-btn,
            .config-btn {
                padding: 0.75rem;
                font-size: 0.9rem;
            }
            
            .viewer-controls {
                flex-direction: column;
                gap: 0.5rem;
            }
            
            .control-group {
                justify-content: space-between;
                width: 100%;
            }
        }
    `;
    
    document.head.appendChild(dynamicStyles);
});

// Initialize the application
window.addEventListener('DOMContentLoaded', () => {
    window.repoSudoeAI = new RePoSUDOEAI();
});

