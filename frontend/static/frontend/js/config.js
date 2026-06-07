// File location: RePo-SUDOE-AI/frontend/static/frontend/js/config.js
// Configuration and translations for the application

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
        runningDockingAdvanced: 'Ejecutando docking con configuración avanzada:',
        autoBoxEnveloping: 'Box enveloping automático aplicado:',
        processingExperiment: 'Procesando tu experimento con AutoDock Vina...',
        dockingFailed: 'Docking Fallido',
        connectionErrorDocking: 'Error de Conexión',
        failedToConnect: 'Error al conectar con el servidor. Por favor verifica tu conexión a internet e intenta de nuevo.',
        dockingResults: 'Resultados del Docking:',
        drug: 'Fármaco',
        gene: 'Gen',
        structure: 'Estructura',
        bindingAffinity: 'Afinidad de Unión',
        information: 'Información:',
        preparingVisualization: 'Preparando visualización 3D... Ve a la pestaña "Output" para ver el resultado.',
        experiment: 'Experimento:',
        error: 'Error:',
        checkConfiguration: 'Por favor verifica la configuración del experimento e intenta de nuevo.',
        dockingCompletedNoResults: 'Docking completado pero no se generaron resultados',
        logFileNotFound: 'Archivo de log no encontrado. El experimento puede estar aún procesándose.',
        couldNotRetrieveError: 'No se pudieron obtener los detalles del error',
        cachedResults: 'Resultados cargados desde experimento previo',
        drugInformation: 'Información del Medicamento:',
        geneInformation: 'Información del Gen:',

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
        scoringLabel: 'Scoring',

        // Experiment information labels
        experimentInfo: 'Información del Experimento',
        experimentLabel: 'Experimento',
        drugLabel: 'Medicamento',
        geneProteinLabel: 'Gen/Proteína',
        description: 'Descripción',
        indications: 'Indicaciones',
        status: 'Estado',
        molecularFormula: 'Fórmula Molecular',
        molecularWeight: 'Peso Molecular',
        fullName: 'Nombre Completo',
        function: 'Función',
        associatedDiseases: 'Enfermedades Asociadas',
        molecularPathways: 'Vías Moleculares',

        // Compound info field labels (for formatCompoundInfo)
        name: 'Nombre',
        molecular_formula: 'Fórmula Molecular',
        molecular_weight: 'Peso Molecular',
        smiles: 'SMILES',
        gene_name: 'Nombre del Gen',
        hgnc_symbol: 'Símbolo HGNC',
        disease: 'Enfermedad',
        function_info: 'Función',
        pathway: 'Vía',

        // Yes/No labels
        yes: 'Sí',
        no: 'No',

        // Output viewer
        selectExperiment: 'Selecciona un experimento',

        // Binding affinity classification
        classification: 'Clasificación',
        unknownAffinity: 'Afinidad desconocida',
        veryStrong: 'Muy fuerte (< -12.0 kcal/mol)',
        veryInteresting: 'Muy interesante (-12.0 a -10.0 kcal/mol)',
        veryGood: 'Muy buena (-10.0 a -9.0 kcal/mol)',
        interesting: 'Interesante para estudio (-9.0 a -8.0 kcal/mol)',
        goodAffinity: 'Buena afinidad (-8.0 a -7.0 kcal/mol)',
        moderate: 'Interacción moderada (-7.0 a -6.0 kcal/mol)',
        weakIrrelevant: 'Débil / Irrelevante (> -6.0 kcal/mol)'
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
        runningDockingAdvanced: 'Running docking with advanced configuration:',
        autoBoxEnveloping: 'Automatic box enveloping applied:',
        processingExperiment: 'Processing your experiment with AutoDock Vina...',
        dockingFailed: 'Docking Failed',
        connectionErrorDocking: 'Connection Error',
        failedToConnect: 'Failed to connect to the server. Please check your internet connection and try again.',
        dockingResults: 'Docking Results:',
        drug: 'Drug',
        gene: 'Gene',
        structure: 'Structure',
        bindingAffinity: 'Binding Affinity',
        information: 'Information:',
        preparingVisualization: 'Preparing 3D visualization... Go to the "Output" tab to view the result.',
        experiment: 'Experiment:',
        error: 'Error:',
        checkConfiguration: 'Please check the experiment configuration and try again.',
        dockingCompletedNoResults: 'Docking completed but no results were generated',
        logFileNotFound: 'Log file not found. The experiment may still be processing.',
        couldNotRetrieveError: 'Could not retrieve error details',
        cachedResults: 'Results loaded from previous experiment',
        drugInformation: 'Drug Information:',
        geneInformation: 'Gene Information:',

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
        scoringLabel: 'Scoring',

        // Experiment information labels
        experimentInfo: 'Experiment Information',
        experimentLabel: 'Experiment',
        drugLabel: 'Drug',
        geneProteinLabel: 'Gene/Protein',
        description: 'Description',
        indications: 'Indications',
        status: 'Status',
        molecularFormula: 'Molecular Formula',
        molecularWeight: 'Molecular Weight',
        fullName: 'Full Name',
        function: 'Function',
        associatedDiseases: 'Associated Diseases',
        molecularPathways: 'Molecular Pathways',

        // Compound info field labels (for formatCompoundInfo)
        name: 'Name',
        molecular_formula: 'Molecular Formula',
        molecular_weight: 'Molecular Weight',
        smiles: 'SMILES',
        gene_name: 'Gene Name',
        hgnc_symbol: 'HGNC Symbol',
        disease: 'Disease',
        function_info: 'Function',
        pathway: 'Pathway',

        // Yes/No labels
        yes: 'Yes',
        no: 'No',

        // Output viewer
        selectExperiment: 'Select an experiment',

        // Binding affinity classification
        classification: 'Classification',
        unknownAffinity: 'Unknown affinity',
        veryStrong: 'Very strong (< -12.0 kcal/mol)',
        veryInteresting: 'Very interesting (-12.0 to -10.0 kcal/mol)',
        veryGood: 'Very good (-10.0 to -9.0 kcal/mol)',
        interesting: 'Interesting for study (-9.0 to -8.0 kcal/mol)',
        goodAffinity: 'Good affinity (-8.0 to -7.0 kcal/mol)',
        moderate: 'Moderate interaction (-7.0 to -6.0 kcal/mol)',
        weakIrrelevant: 'Weak / Irrelevant (> -6.0 kcal/mol)'
    }
};

// Get current language from cookie or meta tag
function getCurrentLanguage() {
    const name = 'django_language=';
    const decodedCookie = decodeURIComponent(document.cookie);
    const cookies = decodedCookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
        let cookie = cookies[i].trim();
        if (cookie.indexOf(name) === 0) {
            return cookie.substring(name.length, cookie.length);
        }
    }

    const langMeta = document.querySelector('meta[name="language"]');
    if (langMeta) {
        return langMeta.getAttribute('content');
    }

    return 'es';
}

// Get translated message
function t(key) {
    const lang = getCurrentLanguage();
    return translations[lang]?.[key] || translations['en']?.[key] || key;
}

// Export to window for global access
window.getCurrentLanguage = getCurrentLanguage;
window.t = t;
window.translations = translations;

console.log(icon('success') + ' config.js loaded with translation support');
