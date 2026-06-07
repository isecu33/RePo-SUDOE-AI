// ViewerManager Module - Handles all molecular viewer operations
class ViewerManager {
    constructor(eventBus, csrfToken) {
        this.eventBus = eventBus;
        this.csrfToken = csrfToken;
        this.previewViewer = null; // Store reference to unified viewer
        this.enhancedViewer = null;
        this.currentResults = null;
        this.selectedPose = 0;
        this.loadedFiles = []; // Reference to loaded files
        this.boxPreviewTimeout = null;
        this.manualFiles = []; // Store manually uploaded files
    }

    // Initialize viewer manager
    init() {
        this.setupIntegratedVisualizerControls();
        this.setupEventListeners();
    }

    // Setup event listeners for file manager events
    setupEventListeners() {
        console.log('📡 ViewerManager: Setting up event listeners');

        this.eventBus.on('fileLoaded', (data) => {
            console.log('🎯 ViewerManager: Received fileLoaded event:', data);
            this.loadedFiles = data.loadedFiles;
            console.log(`📦 ViewerManager: Updated loadedFiles, count: ${this.loadedFiles.length}`);
            this.updateUnifiedPreview();
        });

        this.eventBus.on('fileRemoved', (data) => {
            this.loadedFiles = data.loadedFiles;
            if (this.loadedFiles.length > 0) {
                this.updateUnifiedPreview();
            } else {
                this.clearUnifiedPreview();
            }
        });

        this.eventBus.on('allFilesCleared', () => {
            this.loadedFiles = [];
            this.clearUnifiedPreview();
        });
    }

    // Update unified preview with all loaded files
    updateUnifiedPreview() {
        // Ensure unified preview section is visible first
        this.showUnifiedPreviewSection();
        this._performUpdate();
    }

    _performUpdate() {
        if (!window.$3Dmol) {
            console.error('3DMol not loaded yet');
            return;
        }

        // Get the viewer element by ID
        const viewerElement = document.getElementById('manual-viewer');
        if (!viewerElement) {
            console.error('Viewer element #manual-viewer not found');
            return;
        }

        console.log('Available loadedFiles:', this.loadedFiles.map(f => `${f.type}: ${f.filename}`));

        try {
            // Simply create viewer on the element
            if (!this.previewViewer) {
                console.log('Creating viewer on #manual-viewer');

                // Get theme-appropriate background color
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const backgroundColor = currentTheme === 'dark' ? 0x1a1f2e : 0xffffff;

                // Show the viewer element
                viewerElement.style.display = 'block';

                // Create viewer
                this.previewViewer = $3Dmol.createViewer($(viewerElement), {
                    backgroundColor: backgroundColor,
                    defaultcolors: $3Dmol.rasmolElementColors
                });

                window.current3DMolViewer = this.previewViewer;

                // Force resize to match container dimensions
                setTimeout(() => {
                    if (this.previewViewer) {
                        this.previewViewer.resize();
                        console.log('🔄 Viewer resized to match container');
                    }
                }, 100);

                console.log('✅ Viewer created and shown');
            } else {
                console.log('Clearing existing models');
                this.previewViewer.removeAllModels();

                // Update background color for current theme
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const backgroundColor = currentTheme === 'dark' ? 0x1a1f2e : 0xffffff;
                this.previewViewer.setBackgroundColor(backgroundColor);
            }

            console.log(`About to load ${this.loadedFiles.length} files into viewer`);

            // Load all files into the same viewer
            this.loadedFiles.forEach((fileInfo, index) => {
                console.log(`Adding ${fileInfo.type} model to unified viewer:`, fileInfo.filename);
                console.log(`File data length: ${fileInfo.data.length}, format: ${fileInfo.format}`);

                try {
                    // Add model to viewer using the data directly
                    const model = this.previewViewer.addModel(fileInfo.data, fileInfo.format);
                    console.log(`Model added successfully for ${fileInfo.type}, index: ${index}`);

                    // Apply different styling for each file type
                    const styleObj = this.getFileTypeStyle(fileInfo.type, fileInfo.format, fileInfo.color);

                    // Apply style to this specific model
                    this.previewViewer.setStyle({ model: index }, styleObj);
                    console.log(`Applied ${fileInfo.type} style to model ${index}:`, styleObj);

                } catch (modelError) {
                    console.error(`Error adding ${fileInfo.type} model:`, modelError);
                }
            });

            // 🔥 SOLUCIÓN: Usa requestAnimationFrame para asegurar que el DOM esté listo
            requestAnimationFrame(() => {
                this.previewViewer.zoomTo();
                this.previewViewer.render();
                
                // Espera un frame más para el resize definitivo
                requestAnimationFrame(() => {
                    this.previewViewer.resize();
                    this.previewViewer.render();
                    this.previewViewer.zoom(1.2, 1000);
                });
            });

            // Show the unified preview section
            this.showUnifiedPreviewSection();

            console.log(`Unified preview updated with ${this.loadedFiles.length} files`);

        } catch (error) {
            console.error(`Error updating unified preview:`, error);
            unifiedViewer.innerHTML = `<div style="padding: 20px; text-align: center; color: #d73027;">Error loading unified preview: ${error.message}</div>`;
        }
    }

    // Get styling for different file types
    getFileTypeStyle(type, format, color) {
        switch(type) {
            case 'receptor':
                // Show receptor as cartoon/ribbon for proteins
                if (format === 'pdb' || format === 'pdbqt') {
                    return { cartoon: { color: color }, opacity: 0.8 };
                } else {
                    return { stick: { radius: 0.3, colorScheme: color } };
                }
            case 'drug':
                // Show drug as sticks
                return { stick: { radius: 0.4, color: color } };
            case 'pose':
                // Show pose as balls and sticks
                return {
                    stick: { radius: 0.3, colorscheme: color },
                    sphere: { radius: 0.3, colorscheme: color }
                };
            default:
                return { stick: { radius: 0.3, colorscheme: 'spectrum' } };
        }
    }

    // Show unified preview section and hide individual ones
    showUnifiedPreviewSection() {
        // Find and show the unified preview section
        const unifiedPreview = document.querySelector('.unified-preview-section');
        const previewContainer = document.querySelector('#preview');

        console.log('Showing unified preview section - elements found:', {
            unifiedPreview: !!unifiedPreview,
            previewContainer: !!previewContainer
        });

        // Show the unified preview section
        if (unifiedPreview) {
            unifiedPreview.style.display = 'block';
            console.log('Set unified preview section to display: block');
        }

        // Ensure the main preview container is visible
        if (previewContainer) {
            previewContainer.style.display = 'block';
            console.log('Set preview container to display: block');
        }

        // Update title to indicate it's showing all files
        const unifiedTitle = document.querySelector('#unified-preview-title');
        if (unifiedTitle) {
            const fileCount = this.loadedFiles.length;
            if (fileCount > 1) {
                unifiedTitle.textContent = `Unified Preview - ${fileCount} Files Loaded`;
                unifiedTitle.style.fontWeight = 'bold';
                unifiedTitle.style.color = 'var(--accent-color)';
            } else if (fileCount === 1) {
                unifiedTitle.textContent = `Molecular Structure Preview - ${this.loadedFiles[0].type.charAt(0).toUpperCase() + this.loadedFiles[0].type.slice(1)}`;
                unifiedTitle.style.fontWeight = '600';
                unifiedTitle.style.color = 'var(--text-primary)';
            }
        }
    }

    // Load molecular data directly into 3DMol viewer following proper pattern
    loadMolecularData(viewerElement, fileData, format, fileType, filename) {
        if (!window.$3Dmol) {
            console.error('3DMol not loaded yet');
            return;
        }

        try {
            // Clear existing viewer content
            viewerElement.innerHTML = '';

            // Create viewer with proper config
            // Check current theme to set appropriate background
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const themeBackgroundColor = currentTheme === 'dark' ? '0x1a1f2e' : '0xffffff';
            const backgroundColor = viewerElement.getAttribute('data-backgroundcolor') || themeBackgroundColor;

            const config = {
                backgroundColor: backgroundColor
            };

            const viewer = $3Dmol.createViewer(viewerElement, { backgroundColor: config.backgroundColor });
            
            // Load molecular data directly (following your example pattern)
            console.log(`Loading ${format} data for ${fileType}: ${filename}`);
            
            // Add model directly from file data
            viewer.addModel(fileData, format);
            
            // Apply consistent stick styling for all preview windows
            viewer.setStyle({}, { stick: { radius: 0.3, colorscheme: 'default' } });
            
            // Set camera and render
            viewer.zoomTo();
            viewer.render();
            viewer.zoom(1.2, 1000); // slight zoom following your example
            
            // Store viewer globally for controls if it's the output viewer
            if (fileType === 'output') {
                window.current3DMolViewer = viewer;
                console.log('Output viewer stored globally for controls');
            }
            
            console.log(`Successfully loaded ${format} data for ${fileType}: ${filename}`);
            
        } catch (error) {
            console.error(`Error loading molecular data for ${fileType}:`, error);
            viewerElement.innerHTML = `<div style="padding: 20px; text-align: center; color: #d73027;">Error loading ${filename}<br>Format: ${format}</div>`;
        }
    }

     // Clear unified preview when no files are loaded
    clearUnifiedPreview() {
        console.log('Clearing unified preview');

        // Destroy the viewer completely and clear HTML
        if (this.previewViewer) {
            this.previewViewer.removeAllModels();
            this.previewViewer = null;
            window.current3DMolViewer = null;
        }

        // Clear and hide the viewer element
        const viewerElement = document.getElementById('manual-viewer');
        if (viewerElement) {
            viewerElement.innerHTML = '';
            viewerElement.style.display = 'none';
            console.log('Viewer cleared and hidden');
        }

        // Reset title
        const unifiedTitle = document.querySelector('#unified-preview-title');
        if (unifiedTitle) {
            unifiedTitle.textContent = 'Molecular Structure Preview';
            unifiedTitle.style.fontWeight = '600';
            unifiedTitle.style.color = 'var(--text-primary)';
        }

        // Viewer will be recreated next time a file is loaded
        console.log('Unified preview models cleared');
    }


    
    // Visualize docking box in the 3D viewer
    visualizeDockingBox(boxConfig) {
        if (!this.previewViewer || !boxConfig.calculated_center || !boxConfig.calculated_size) {
            console.warn('Cannot visualize docking box: viewer or box parameters missing');
            return;
        }

        try {
            const [cx, cy, cz] = boxConfig.calculated_center;
            const [sx, sy, sz] = boxConfig.calculated_size;

            // Create box wireframe vertices
            const halfX = sx / 2;
            const halfY = sy / 2;
            const halfZ = sz / 2;

            const boxVertices = [
                // Bottom face
                [cx - halfX, cy - halfY, cz - halfZ],
                [cx + halfX, cy - halfY, cz - halfZ],
                [cx + halfX, cy + halfY, cz - halfZ],
                [cx - halfX, cy + halfY, cz - halfZ],
                // Top face
                [cx - halfX, cy - halfY, cz + halfZ],
                [cx + halfX, cy - halfY, cz + halfZ],
                [cx + halfX, cy + halfY, cz + halfZ],
                [cx - halfX, cy + halfY, cz + halfZ]
            ];

            // Create box edges
            const boxEdges = [
                // Bottom face edges
                [0, 1], [1, 2], [2, 3], [3, 0],
                // Top face edges
                [4, 5], [5, 6], [6, 7], [7, 4],
                // Vertical edges
                [0, 4], [1, 5], [2, 6], [3, 7]
            ];

            // Add box visualization to the viewer
            boxEdges.forEach(([start, end]) => {
                const startPos = boxVertices[start];
                const endPos = boxVertices[end];
                
                this.previewViewer.addCylinder({
                    start: { x: startPos[0], y: startPos[1], z: startPos[2] },
                    end: { x: endPos[0], y: endPos[1], z: endPos[2] },
                    radius: 0.1,
                    color: 'red',
                    alpha: 0.7
                });
            });

            // Add center point
            this.previewViewer.addSphere({
                center: { x: cx, y: cy, z: cz },
                radius: 0.3,
                color: 'yellow',
                alpha: 0.8
            });

            this.previewViewer.render();
            console.log('Docking box visualized in 3D viewer');

        } catch (error) {
            console.error('Error visualizing docking box:', error);
        }
    }

    // Remove docking box visualization
    removeDockingBoxVisualization() {
        if (!this.previewViewer) return;
        
        try {
            // Remove all shapes (this will remove box and center point)
            this.previewViewer.removeAllShapes();
            this.previewViewer.render();
            console.log('Docking box visualization removed');
        } catch (error) {
            console.error('Error removing docking box visualization:', error);
        }
    }

    // Test and preview box enveloping parameters
    previewBoxEnveloping() {
        if (this.loadedFiles.length === 0) {
            console.warn('No molecules loaded for box enveloping preview');
            return;
        }

        // Configure box enveloping with current molecules
        const boxConfig = this.calculateBoxEnvelopingConfig(this.loadedFiles);
        
        if (boxConfig.calculated_center && boxConfig.calculated_size) {
            console.log('Box Enveloping Preview:');
            console.log(`Center: [${boxConfig.calculated_center.map(c => c.toFixed(2)).join(', ')}]`);
            console.log(`Size: [${boxConfig.calculated_size.map(s => s.toFixed(2)).join(', ')}] Å`);
            console.log(`Padding: ${boxConfig.padding} Å`);
            
            // Visualize the box in the 3D viewer
            this.visualizeDockingBox(boxConfig);
            
            return boxConfig;
        } else {
            console.warn('Could not calculate box enveloping parameters');
            return null;
        }
    }

    // Quick access method to apply box enveloping to manual docking
    applyBoxEnvelopingToManualDocking() {
        if (this.loadedFiles.length === 0) {
            console.warn('No molecules loaded for box enveloping');
            return {};
        }

        const boxConfig = this.calculateBoxEnvelopingConfig(this.loadedFiles);
        const vinaConfig = this.applyBoxEnveloping({}, boxConfig);
        
        console.log('Box enveloping applied to manual docking:', vinaConfig);
        return vinaConfig;
    }

    // Check if custom box parameters are enabled in UI
    isCustomBoxEnabled() {
        const enableCheckbox = document.getElementById('enable-custom-box');
        return enableCheckbox ? enableCheckbox.checked : false;
    }

    // Get manual box parameters from UI
    getManualBoxParameters() {
        if (!this.isCustomBoxEnabled()) {
            return null;
        }

        const centerX = document.getElementById('box-center-x');
        const centerY = document.getElementById('box-center-y');
        const centerZ = document.getElementById('box-center-z');
        const sizeX = document.getElementById('box-size-x');
        const sizeY = document.getElementById('box-size-y');
        const sizeZ = document.getElementById('box-size-z');

        // Check if all required fields have values
        const center = [
            parseFloat(centerX?.value) || 0,
            parseFloat(centerY?.value) || 0,
            parseFloat(centerZ?.value) || 0
        ];

        const size = [
            parseFloat(sizeX?.value) || 20,
            parseFloat(sizeY?.value) || 20,
            parseFloat(sizeZ?.value) || 20
        ];

        return {
            use_custom_box: true,
            box_center: center,
            box_size: size
        };
    }



    // Preview manual docking box in 3D viewer
    previewManualBox() {
        if (!this.isCustomBoxEnabled()) {
            alert('Please enable custom box parameters first.');
            return;
        }

        if (!this.previewViewer) {
            alert('Please upload molecular files first to see the preview.');
            return;
        }

        const boxParams = this.getManualBoxParameters();
        if (!boxParams) {
            alert('Please enter valid box parameters.');
            return;
        }

        try {
            // Clear any existing box visualization
            this.clearManualBoxPreview();

            const [cx, cy, cz] = boxParams.box_center;
            const [sx, sy, sz] = boxParams.box_size;

            console.log(`Previewing box: Center [${cx}, ${cy}, ${cz}], Size [${sx}, ${sy}, ${sz}]`);

            // Create box wireframe vertices
            const halfX = sx / 2;
            const halfY = sy / 2;
            const halfZ = sz / 2;

            const boxVertices = [
                // Bottom face
                [cx - halfX, cy - halfY, cz - halfZ],
                [cx + halfX, cy - halfY, cz - halfZ],
                [cx + halfX, cy + halfY, cz - halfZ],
                [cx - halfX, cy + halfY, cz - halfZ],
                // Top face
                [cx - halfX, cy - halfY, cz + halfZ],
                [cx + halfX, cy - halfY, cz + halfZ],
                [cx + halfX, cy + halfY, cz + halfZ],
                [cx - halfX, cy + halfY, cz + halfZ]
            ];

            // Create box edges
            const boxEdges = [
                // Bottom face edges
                [0, 1], [1, 2], [2, 3], [3, 0],
                // Top face edges
                [4, 5], [5, 6], [6, 7], [7, 4],
                // Vertical edges
                [0, 4], [1, 5], [2, 6], [3, 7]
            ];

            // Add box visualization to the viewer
            boxEdges.forEach(([start, end]) => {
                const startPos = boxVertices[start];
                const endPos = boxVertices[end];
                
                this.previewViewer.addCylinder({
                    start: { x: startPos[0], y: startPos[1], z: startPos[2] },
                    end: { x: endPos[0], y: endPos[1], z: endPos[2] },
                    radius: 0.2,
                    color: 'limegreen',
                    alpha: 0.85
                });
            });

            this.previewViewer.render();
            console.log('Manual docking box preview displayed successfully');

        } catch (error) {
            console.error('Error previewing manual docking box:', error);
            alert('Error displaying box preview: ' + error.message);
        }
    }

    // Clear manual docking box preview
    clearManualBoxPreview() {
        if (!this.previewViewer) return;
        
        try {
            // Remove all shapes (this will remove box visualization)
            this.previewViewer.removeAllShapes();
            this.previewViewer.render();
            console.log('Manual docking box preview cleared');
        } catch (error) {
            console.error('Error clearing manual docking box preview:', error);
        }
    }

    // Update box preview if it's currently visible (for real-time updates)
    updateBoxPreviewIfVisible() {
        if (!this.previewViewer || !this.isCustomBoxEnabled()) {
            return;
        }

        try {
            // Check if there are currently any shapes in the viewer (indicating preview is active)
            const hasShapes = this.previewViewer.getShapes && this.previewViewer.getShapes().length > 0;
            
            // If preview is visible, update it
            if (hasShapes) {
                this.previewManualBox();
                console.log('Box preview updated in real-time');
            }
        } catch (error) {
            // If getShapes is not available, just try to update anyway
            const boxParams = this.getManualBoxParameters();
            if (boxParams) {
                this.previewManualBox();
            }
        }
    }

    
    // Load experiment files for enhanced viewer
    async loadExperimentFiles() {
        if (!this.enhancedViewer) return;
        
        try {
            // Request experiment files from backend
            const response = await fetch('/api/get-visualizer-files/', {
                method: 'GET',
                headers: {
                    'X-CSRFToken': this.csrfToken
                }
            });
            
            const result = await response.json();
            
            if (result.success && result.files) {
                const fileData = {
                    ligandFile: result.files.pdbqt_content,
                    logFile: result.files.log_content
                };
                
                await this.enhancedViewer.loadExperimentFiles(fileData);
                console.log('Experiment files loaded successfully');
                
                // Update pose information
                this.updatePoseInformation();
                
                // Hide loading indicator
                const loading = document.getElementById('viewer-loading');
                if (loading) {
                    loading.style.display = 'none';
                }
                
                // Show pose navigation
                const poseNav = document.getElementById('pose-navigation');
                if (poseNav) {
                    poseNav.style.display = 'flex';
                }
            } else {
                console.log('No experiment files available');
                this.hideLoadingIndicator();
            }
        } catch (error) {
            console.error('Error loading experiment files:', error);
            this.hideLoadingIndicator();
        }
    }

    // Load available experiments for selection
    async loadAvailableExperiments() {
        try {
            const response = await fetch('/api/get-available-experiments/', {
                method: 'GET',
                headers: {
                    'X-CSRFToken': this.csrfToken
                }
            });
            
            if (response.ok) {
                const experiments = await response.json();
                this.populateExperimentSelector(experiments);
            }
        } catch (error) {
            console.error('Error loading available experiments:', error);
        }
    }

    populateExperimentSelector(experiments) {
        const selector = document.getElementById('experiment-selector');
        if (!selector) return;
        
        // Clear current options
        selector.innerHTML = '<option value="">Select experiment...</option>';
        
        // Add experiment options
        experiments.forEach(exp => {
            const option = document.createElement('option');
            option.value = exp.key;
            option.textContent = `${exp.estructura_id} + ${exp.drug_id}`;
            selector.appendChild(option);
        });
    }

    // Setup integrated visualizer controls
    
    setupIntegratedVisualizerControls() {
        console.log('setupIntegratedVisualizerControls called');

        // Experiment selector - Enhanced functionality
        const loadSelectedBtn = document.getElementById('load-selected-experiment');
        console.log('Load button found:', loadSelectedBtn);
        if (loadSelectedBtn) {
            console.log('Adding click listener to Load button');
            loadSelectedBtn.addEventListener('click', async () => {
                console.log('Load button clicked!');
                const experimentSelector = document.getElementById('experiment-selector');
                const selectedExperiment = experimentSelector.value;
                console.log('Selected experiment:', selectedExperiment);

                if (!selectedExperiment) {
                    alert('Please select an experiment.');
                    return;
                }

                // Check if it's a manual file
                if (selectedExperiment.startsWith('manual_')) {
                    this.loadManualFile(selectedExperiment);
                } else {
                    // Extract PDB ID and drug name from the selected experiment
                    // Use split with limit to handle drug names that contain underscores
                    const parts = selectedExperiment.split('_');
                    const pdbId = parts[0];
                    const drugName = parts.slice(1).join('_');  // Rejoin everything after first underscore

                    console.log('📋 Raw experiment key:', selectedExperiment);
                    console.log('📋 Parsed:', { pdbId, drugName });

                    // Use the new loadVinaOutputFile method that loads receptor + best pose
                    this.loadVinaOutputFile(drugName, pdbId);

                    // Also load the experiment log
                    this.loadExperimentLogFromSelector(pdbId, drugName);
                }
            });
        }

        // Style controls
        const applyStyleBtn = document.getElementById('apply-style');
        const styleSelector = document.getElementById('style-selector');
        if (applyStyleBtn && styleSelector) {
            applyStyleBtn.addEventListener('click', () => {
                const style = styleSelector.value;
                this.applyMolecularStyle(style);
            });
        }

        // Color scheme controls
        const applyColorBtn = document.getElementById('apply-color');
        const colorScheme = document.getElementById('color-scheme');
        if (applyColorBtn && colorScheme) {
            applyColorBtn.addEventListener('click', () => {
                const scheme = colorScheme.value;
                const currentStyle = styleSelector ? styleSelector.value : 'stick';
                this.applyColorScheme(currentStyle, scheme);
            });
        }

        // Reset view control
        const resetViewBtn = document.getElementById('reset-view');
        if (resetViewBtn) {
            resetViewBtn.addEventListener('click', () => {
                this.resetMolecularView();
            });
        }

        // Zoom to binding site
        const zoomBindingBtn = document.getElementById('zoom-binding');
        if (zoomBindingBtn) {
            zoomBindingBtn.addEventListener('click', () => {
                this.zoomToBindingSite();
            });
        }

        // Receptor style controls
        const applyReceptorStyleBtn = document.getElementById('apply-receptor-style');
        const receptorStyleSelector = document.getElementById('receptor-style-selector');
        const receptorColorSelector = document.getElementById('receptor-color-scheme');

        if (applyReceptorStyleBtn && receptorStyleSelector && receptorColorSelector) {
            applyReceptorStyleBtn.addEventListener('click', () => {
                const style = receptorStyleSelector.value;
                const colorScheme = receptorColorSelector.value;
                this.applyReceptorStyle(style, colorScheme);
            });
        }

        // Ligand style controls
        const applyLigandStyleBtn = document.getElementById('apply-ligand-style');
        const ligandStyleSelector = document.getElementById('ligand-style-selector');
        const ligandColorSelector = document.getElementById('ligand-color-scheme');

        if (applyLigandStyleBtn && ligandStyleSelector && ligandColorSelector) {
            applyLigandStyleBtn.addEventListener('click', () => {
                const style = ligandStyleSelector.value;
                const colorScheme = ligandColorSelector.value;
                this.applyLigandStyle(style, colorScheme);
            });
        }

        // Download button - download selected experiment files
        const downloadBtn = document.getElementById('download-pdbqt');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadSelectedExperiment();
            });
        }

        // Pose selector - Load selected pose
        const loadPoseBtn = document.getElementById('load-selected-pose');
        const poseSelector = document.getElementById('pose-selector');
        if (loadPoseBtn && poseSelector) {
            loadPoseBtn.addEventListener('click', () => {
                const selectedPoseIndex = poseSelector.value;
                if (selectedPoseIndex === '') {
                    alert('Please select a pose first.');
                    return;
                }
                this.loadSpecificPose(parseInt(selectedPoseIndex));
            });
        }

    }

    // Apply style to receptor (model 0)
    applyReceptorStyle(style, colorScheme) {
        if (!window.current3DMolViewer) {
            console.warn('No 3DMol viewer available');
            return;
        }

        console.log('Applying receptor style:', style, colorScheme);

        const styleObj = {};
        styleObj[style] = {
            colorscheme: colorScheme
        };

        window.current3DMolViewer.setStyle({ model: 0 }, styleObj);
        window.current3DMolViewer.render();
    }

    // Apply style to ligand (model 1)
    applyLigandStyle(style, colorScheme) {
        if (!window.current3DMolViewer) {
            console.warn('No 3DMol viewer available');
            return;
        }

        console.log('Applying ligand style:', style, colorScheme);

        const styleObj = {};
        styleObj[style] = {
            radius: 0.25,
            colorscheme: colorScheme
        };

        window.current3DMolViewer.setStyle({ model: 1 }, styleObj);
        window.current3DMolViewer.render();
    }

    // Download selected experiment files as ZIP
    downloadSelectedExperiment() {
        const experimentSelector = document.getElementById('experiment-selector');
        if (!experimentSelector || !experimentSelector.value) {
            alert('Please select an experiment from the dropdown first.');
            return;
        }

        const selectedExperiment = experimentSelector.value;
        console.log('📦 Downloading experiment as ZIP:', selectedExperiment);

        // Check if it's a manual file
        if (selectedExperiment.startsWith('manual_')) {
            alert('Download not available for manually uploaded files.');
            return;
        }

        // Download as ZIP file with all experiment files
        const zipUrl = `/api/download-experiment/${selectedExperiment}/`;

        // Create download link
        const link = document.createElement('a');
        link.href = zipUrl;
        link.download = `${selectedExperiment}_experiment.zip`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        console.log('✅ ZIP download initiated for experiment:', selectedExperiment);
    }

    // Load manually uploaded file from stored data
    loadManualFile(fileKey) {
        const fileInfo = this.manualFiles.find(f => f.key === fileKey);
        if (!fileInfo) {
            console.error('Manual file not found:', fileKey);
            return;
        }

        console.log('Loading manual file:', fileInfo.name);

        const outputViewer = document.getElementById('output-viewer');
        if (!outputViewer) {
            console.error('Output viewer #output-viewer not found');
            return;
        }

        // Show and create new viewer
        outputViewer.style.display = 'block';
        outputViewer.innerHTML = '';
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const backgroundColor = currentTheme === 'dark' ? 0x1a1f2e : 0xffffff;
        const viewer = $3Dmol.createViewer($(outputViewer), {
            backgroundColor: backgroundColor,
            defaultcolors: $3Dmol.rasmolElementColors
        });

        // Force resize after creation
        setTimeout(() => {
            if (viewer) {
                viewer.resize();
                console.log('🔄 Output viewer resized');
            }
        }, 100);

        // Check if this is a combined file (receptor + ligand)
        if (fileInfo.receptorFile || fileInfo.ligandFile) {
            // Load receptor first (if available)
            if (fileInfo.receptorFile) {
                viewer.addModel(fileInfo.receptorFile.data, fileInfo.receptorFile.format);
                viewer.setStyle({ model: 0 }, { cartoon: { color: 'spectrum' } });
            }

            // Load ligand (if available)
            if (fileInfo.ligandFile) {
                const ligandData = fileInfo.ligandFile.data.includes('MODEL')
                    ? this.extractBestPose(fileInfo.ligandFile.data)
                    : fileInfo.ligandFile.data;

                viewer.addModel(ligandData, fileInfo.ligandFile.format);
                const modelIndex = fileInfo.receptorFile ? 1 : 0;
                viewer.setStyle({ model: modelIndex }, { stick: { radius: 0.25, colorscheme: 'greenCarbon' } });
            }
        } else {
            // Old format - single file
            if (fileInfo.isVinaOutput) {
                const bestPose = this.extractBestPose(fileInfo.data);
                viewer.addModel(bestPose, fileInfo.format);
                viewer.setStyle({}, { stick: { radius: 0.25, colorscheme: 'greenCarbon' } });
            } else {
                viewer.addModel(fileInfo.data, fileInfo.format);
                viewer.setStyle({}, { cartoon: { color: 'spectrum' } });
            }
        }

        viewer.zoomTo();
        viewer.render();
        viewer.zoom(1.2, 1000);

        window.current3DMolViewer = viewer;
        console.log('Manual file loaded successfully:', fileInfo.name);
    }

    // Load experiment log when selecting from dropdown
    async loadExperimentLogFromSelector(structureId, drugName) {
        console.log('loadExperimentLogFromSelector called with:', { structureId, drugName });

        const moleculeInfo = document.getElementById('molecule-info');
        if (!moleculeInfo) {
            console.error('molecule-info element not found');
            return;
        }

        // Show loading message
        moleculeInfo.innerHTML = `<div class="experiment-details">
            <p>Loading experiment log...</p>
        </div>`;

        try {
            // Fetch the actual Vina log file
            const logPath = `/api/output/${structureId}_${drugName}_vina.log`;
            console.log('Fetching log file from:', logPath);

            const response = await fetch(logPath);
            console.log('Log fetch response:', { status: response.status, ok: response.ok });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const logContent = await response.text();
            console.log('Log content loaded, length:', logContent.length);

            // Parse and filter the log content
            const filteredLog = this.parseVinaLog(logContent);
            console.log('Filtered log length:', filteredLog.length);

            // Extract binding affinity from log
            const bindingAffinity = this.extractBindingAffinityFromLog(logContent);
            console.log('Extracted binding affinity:', bindingAffinity);

            // Update experiment info box with binding affinity
            this.updateExperimentInfoBox(structureId, drugName, bindingAffinity);

            // Display only the log content
            moleculeInfo.innerHTML = `<pre style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4; white-space: pre-wrap; margin: 0;">${filteredLog}</pre>`;

            console.log('Log displayed successfully');

        } catch (error) {
            console.error('Error loading Vina log file:', error);

            // Show error message
            moleculeInfo.innerHTML = `<pre style="background: var(--bg-secondary); padding: 15px; border-radius: 8px; color: var(--error-color); margin: 0;">Could not load experiment log: ${error.message}</pre>`;
        }
    }

    // Apply molecular style to the current output viewer
    applyMolecularStyle(style) {
        if (window.current3DMolViewer) {
            console.log('Applying style:', style);
            const styleObj = {};
            
            // Configure style-specific parameters
            switch(style) {
                case 'stick':
                    styleObj[style] = { radius: 0.3, colorscheme: 'default' };
                    break;
                case 'sphere':
                    styleObj[style] = { radius: 1.0, colorscheme: 'default' };
                    break;
                case 'cartoon':
                    styleObj[style] = { color: 'spectrum', opacity: 0.8 };
                    break;
                case 'line':
                    styleObj[style] = { linewidth: 2, colorscheme: 'default' };
                    break;
                default:
                    styleObj[style] = { radius: 0.3, colorscheme: 'default' };
            }
            
            window.current3DMolViewer.setStyle({}, styleObj);
            window.current3DMolViewer.render();
            console.log('Applied style:', style);
        } else {
            console.warn('No 3DMol viewer available');
        }
    }

    // Apply color scheme to the current output viewer
    applyColorScheme(style, colorScheme) {
        if (window.current3DMolViewer) {
            console.log('Applying color scheme:', colorScheme, 'with style:', style);
            
            const styleObj = {};
            
            // Map HTML option values to valid 3DMol.js color schemes
            let color3DMol;
            switch(colorScheme) {
                case 'default':
                    color3DMol = 'default'; // CPK coloring by element
                    break;
                case 'carbon':
                    color3DMol = 'grayCarbon'; // Gray carbon atoms
                    break;
                case 'chainbow': 
                    color3DMol = 'rainbow'; // Rainbow coloring
                    break;
                case 'residue':
                    color3DMol = 'residue'; // By amino acid residue
                    break;
                case 'spectrum':
                    color3DMol = 'spectrum'; // Spectrum coloring
                    break;
                case 'chain':
                    color3DMol = 'chain'; // By protein chain
                    break;
                case 'atom':
                    color3DMol = 'atom'; // By atom type
                    break;
                default:
                    color3DMol = 'default';
            }
            
            styleObj[style] = { 
                radius: 0.3, 
                colorscheme: color3DMol
            };
            
            window.current3DMolViewer.setStyle({}, styleObj);
            window.current3DMolViewer.render();
            console.log('Applied color scheme:', color3DMol);
        } else {
            console.warn('No 3DMol viewer available');
        }
    }

    // Reset the molecular view
    resetMolecularView() {
        if (window.current3DMolViewer) {
            console.log('Resetting molecular view');
            window.current3DMolViewer.zoomTo();
            window.current3DMolViewer.render();
        } else {
            console.warn('No 3DMol viewer available');
        }
    }

    // Zoom to binding site (center on the molecule)
    zoomToBindingSite() {
        if (window.current3DMolViewer) {
            console.log('Zooming to binding site');
            window.current3DMolViewer.zoomTo();
            window.current3DMolViewer.zoom(1.5, 1000);
            window.current3DMolViewer.render();
        } else {
            console.warn('No 3DMol viewer available');
        }
    }

    // Calculate box enveloping parameters based on loaded files
    calculateBoxEnvelopingConfig(loadedFiles) {
        if (!loadedFiles || loadedFiles.length === 0) {
            console.warn('No files loaded for box enveloping');
            return { padding: 5.0 };
        }

        try {
            // Calculate bounding box from all loaded molecules
            let minX = Infinity, minY = Infinity, minZ = Infinity;
            let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
            let atomCount = 0;

            // Get atoms from the preview viewer
            if (this.previewViewer) {
                const models = this.previewViewer.getModels();
                models.forEach(model => {
                    const atoms = model.selectedAtoms({});
                    atoms.forEach(atom => {
                        if (atom.x !== undefined && atom.y !== undefined && atom.z !== undefined) {
                            minX = Math.min(minX, atom.x);
                            minY = Math.min(minY, atom.y);
                            minZ = Math.min(minZ, atom.z);
                            maxX = Math.max(maxX, atom.x);
                            maxY = Math.max(maxY, atom.y);
                            maxZ = Math.max(maxZ, atom.z);
                            atomCount++;
                        }
                    });
                });
            }

            if (atomCount === 0) {
                console.warn('No atoms found in loaded molecules');
                return { padding: 5.0 };
            }

            // Calculate center and size
            const center = [
                (minX + maxX) / 2,
                (minY + maxY) / 2,
                (minZ + maxZ) / 2
            ];

            const size = [
                maxX - minX,
                maxY - minY,
                maxZ - minZ
            ];

            const padding = 5.0; // Default padding in Angstroms

            console.log('Box enveloping calculated:', {
                center,
                size,
                padding,
                atomCount
            });

            return {
                calculated_center: center,
                calculated_size: size,
                padding: padding
            };

        } catch (error) {
            console.error('Error calculating box enveloping:', error);
            return { padding: 5.0 };
        }
    }

    // Apply box enveloping configuration to Vina config
    applyBoxEnveloping(vinaConfig, boxConfig) {
        if (!boxConfig || !boxConfig.calculated_center || !boxConfig.calculated_size) {
            console.warn('Invalid box configuration for enveloping');
            return vinaConfig;
        }

        const padding = boxConfig.padding || 5.0;

        // Apply center
        vinaConfig.center_x = boxConfig.calculated_center[0];
        vinaConfig.center_y = boxConfig.calculated_center[1];
        vinaConfig.center_z = boxConfig.calculated_center[2];

        // Apply size with padding
        vinaConfig.size_x = boxConfig.calculated_size[0] + (2 * padding);
        vinaConfig.size_y = boxConfig.calculated_size[1] + (2 * padding);
        vinaConfig.size_z = boxConfig.calculated_size[2] + (2 * padding);

        console.log('Box enveloping applied to Vina config:', vinaConfig);

        return vinaConfig;
    }

    // Clean PDBQT content for 3DMol.js visualization
    // Removes ROOT, BRANCH, TORSDOF tags that interfere with visualization
    cleanPDBQTForVisualization(pdbqtContent) {
        const lines = pdbqtContent.split('\n');
        const cleanedLines = [];

        for (const line of lines) {
            // Skip AutoDock-specific tags that break 3DMol.js
            if (line.startsWith('ROOT') ||
                line.startsWith('ENDROOT') ||
                line.startsWith('BRANCH') ||
                line.startsWith('ENDBRANCH') ||
                line.startsWith('TORSDOF')) {
                continue;
            }
            cleanedLines.push(line);
        }

        return cleanedLines.join('\n');
    }

    // Extract best pose (pose with lowest/best binding affinity) from PDBQT file
    extractBestPose(pdbqtContent) {
        // Use extractAllPoses to get all poses with affinity values
        const allPoses = this.extractAllPoses(pdbqtContent);

        if (allPoses.length === 0) {
            // Fallback: no MODEL found, return full content
            return this.cleanPDBQTForVisualization(pdbqtContent);
        }

        // Find the pose with the lowest (most negative = best) affinity
        let bestPose = allPoses[0];
        for (const pose of allPoses) {
            if (pose.affinity && parseFloat(pose.affinity) < parseFloat(bestPose.affinity || 0)) {
                bestPose = pose;
            }
        }

        console.log(`Best pose selected: Model ${bestPose.model} with affinity ${bestPose.affinity} kcal/mol`);

        // Clean the PDBQT before returning for 3DMol.js
        return this.cleanPDBQTForVisualization(bestPose.pdbqt);
    }

    // Extract all poses from PDBQT file with affinity values
    extractAllPoses(pdbqtContent) {
        const lines = pdbqtContent.split('\n');
        const poses = [];
        let currentPose = '';
        let currentModelNumber = null;
        let currentAffinity = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.startsWith('MODEL')) {
                currentModelNumber = parseInt(line.split(' ')[1]);
                currentPose = line + '\n';
                // Try to find the affinity in the REMARK lines
                for (let j = i + 1; j < i + 10 && j < lines.length; j++) {
                    if (lines[j].includes('REMARK VINA RESULT:')) {
                        const parts = lines[j].trim().split(/\s+/);
                        currentAffinity = parts[3]; // The affinity value
                        break;
                    }
                }
                continue;
            }

            if (line.startsWith('ENDMDL')) {
                currentPose += line + '\n';
                poses.push({
                    model: currentModelNumber,
                    affinity: currentAffinity,
                    pdbqt: currentPose
                });
                currentPose = '';
                currentModelNumber = null;
                currentAffinity = null;
                continue;
            }

            if (currentModelNumber !== null) {
                currentPose += line + '\n';
            }
        }

        return poses;
    }

    // Load Vina output file into the output viewer (receptor + best ligand pose)
    async loadVinaOutputFile(drugName, structureId) {
        console.log('Loading Vina experiment:', { drugName, structureId });

        try {
            // Get viewer element
            const outputViewer = document.getElementById('output-viewer');
            if (!outputViewer) {
                console.error('Output viewer #output-viewer not found');
                return;
            }

            // Show and clear existing viewer
            outputViewer.style.display = 'block';
            outputViewer.innerHTML = '';

            // Create viewer with proper configuration
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const backgroundColor = currentTheme === 'dark' ? 0x1a1f2e : 0xffffff;

            // Initialize viewer properly with full size
            const viewer = $3Dmol.createViewer($(outputViewer), {
                backgroundColor: backgroundColor,
                defaultcolors: $3Dmol.rasmolElementColors
            });

            // Force resize after creation
            setTimeout(() => {
                if (viewer) {
                    viewer.resize();
                }
            }, 100);

            if (!viewer) {
                throw new Error('Failed to create 3DMol viewer');
            }

            // Load receptor
            let receptorLoaded = false;
            let receptorData = null;
            try {
                const receptorResponse = await fetch(`/api/input/${structureId}.pdb`);
                if (receptorResponse.ok) {
                    receptorData = await receptorResponse.text();
                    viewer.addModel(receptorData, "pdb");
                    viewer.setStyle({}, { cartoon: { color: 'spectrum' } });
                    receptorLoaded = true;
                }
            } catch (error) {
                console.warn('Could not load receptor PDB:', error);
            }

            // Load ligand output file with ALL poses
            const ligandFilename = `${structureId}_${drugName}_out.pdbqt`;
            console.log('🔍 Requesting ligand file:', ligandFilename);
            console.log('🔍 Full URL:', `/api/output/${ligandFilename}`);
            const ligandResponse = await fetch(`/api/output/${ligandFilename}`);
            console.log('📥 Response status:', ligandResponse.status, ligandResponse.statusText);
            if (!ligandResponse.ok) {
                throw new Error(`Ligand output file not found: ${ligandFilename}`);
            }

            const ligandData = await ligandResponse.text();
            console.log('Ligand PDBQT data length:', ligandData.length);
            console.log('First 500 chars of ligand data:', ligandData.substring(0, 500));

            // Extract all poses and populate dropdown
            const allPoses = this.extractAllPoses(ligandData);
            console.log('Extracted poses:', allPoses.length);

            if (allPoses.length > 0) {
                console.log('First pose data length:', allPoses[0].pdbqt.length);
                console.log('First pose preview:', allPoses[0].pdbqt.substring(0, 300));
            }

            // Store poses globally for later use
            window.currentExperiment = {
                drugName: drugName,
                structureId: structureId,
                receptorData: receptorData,
                allPoses: allPoses,
                ligandData: ligandData
            };

            // Populate pose selector dropdown
            const poseSelector = document.getElementById('pose-selector');
            if (poseSelector) {
                poseSelector.innerHTML = '<option value="">Select pose...</option>';
                allPoses.forEach((pose, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = `Pose ${pose.model} (Affinity: ${pose.affinity} kcal/mol)`;
                    poseSelector.appendChild(option);
                });
            }

            // Load best pose (first one)
            const bestPose = this.extractBestPose(ligandData);
            console.log('Best pose data length:', bestPose.length);
            console.log('Best pose preview:', bestPose.substring(0, 300));

            // Add ligand model
            const ligandModel = viewer.addModel(bestPose, "pdbqt");
            console.log('🧬 Ligand model added:', ligandModel);
            console.log('🧬 Ligand model atom count:', ligandModel.selectedAtoms({}).length);

            // Apply styles
            const allModels = viewer.getModel();
            console.log('📊 All models object:', allModels);
            console.log('📊 All models type:', typeof allModels);
            console.log('📊 Is array?:', Array.isArray(allModels));
            if (Array.isArray(allModels)) {
                console.log('📊 Model count:', allModels.length);
                allModels.forEach((m, i) => {
                    console.log(`📊 Model ${i}: ${m.selectedAtoms({}).length} atoms`);
                });
            } else {
                console.log('📊 Single model with atoms:', allModels.selectedAtoms({}).length);
            }

            // Style receptor (model 0) and ligand (model 1)
            if (receptorLoaded) {
                viewer.setStyle({model: 0}, { cartoon: { color: 'spectrum' } });
                console.log('💅 Receptor styled (model 0)');
            }
            viewer.setStyle({model: receptorLoaded ? 1 : 0}, { stick: { radius: 0.3, colorscheme: 'greenCarbon' } });
            console.log(`💅 Ligand styled (model ${receptorLoaded ? 1 : 0})`);

            // 🔥 Usa requestAnimationFrame aquí también
            requestAnimationFrame(() => {
                viewer.zoomTo();
                viewer.resize();
                viewer.render();
                
                requestAnimationFrame(() => {
                    viewer.resize(); // Segundo resize para asegurar
                    viewer.zoom(1.2, 1000);
                });
            });

            // Store viewer globally for controls
            window.current3DMolViewer = viewer;
            console.log('Vina experiment visualization complete');

        } catch (error) {
            console.error('Failed to load Vina output:', error);
            const outputViewer = document.querySelector('#output .viewer_3Dmoljs');
            if (outputViewer) {
                outputViewer.innerHTML = `<div style="padding: 20px; text-align: center; color: #d73027;">
                    Error loading experiment visualization<br>
                    ${error.message}
                </div>`;
            }
        }
    }

    // Load a specific pose from the current experiment
    loadSpecificPose(poseIndex) {
        if (!window.currentExperiment || !window.currentExperiment.allPoses) {
            console.error('No experiment loaded');
            alert('Please load an experiment first');
            return;
        }

        const pose = window.currentExperiment.allPoses[poseIndex];
        if (!pose) {
            console.error('Pose not found:', poseIndex);
            return;
        }

        console.log('Loading pose:', pose.model, 'Affinity:', pose.affinity);

        const outputViewer = document.getElementById('output-viewer');
        if (!outputViewer) {
            console.error('Output viewer #output-viewer not found');
            return;
        }

        // Show and recreate viewer
        outputViewer.style.display = 'block';
        outputViewer.innerHTML = '';

        const currentTheme = document.documentElement.getAttribute('data-theme');
        const backgroundColor = currentTheme === 'dark' ? 0x1a1f2e : 0xffffff;

        const viewer = $3Dmol.createViewer($(outputViewer), {
            backgroundColor: backgroundColor,
            defaultcolors: $3Dmol.rasmolElementColors
        });

        // Force resize after creation
        setTimeout(() => {
            if (viewer) {
                viewer.resize();
            }
        }, 100);

        // Load receptor if available
        if (window.currentExperiment.receptorData) {
            viewer.addModel(window.currentExperiment.receptorData, "pdb");
            viewer.setStyle({model: 0}, { cartoon: { color: 'spectrum' } });
        }

        // Load selected pose (clean PDBQT for 3DMol.js)
        const cleanedPose = this.cleanPDBQTForVisualization(pose.pdbqt);
        viewer.addModel(cleanedPose, "pdbqt");
        viewer.setStyle({model: 1}, { stick: { radius: 0.3, colorscheme: 'greenCarbon' } });

        // Render con requestAnimationFrame
        requestAnimationFrame(() => {
            viewer.zoomTo();
            viewer.resize();
            viewer.render();
            
            requestAnimationFrame(() => {
                viewer.resize();
                viewer.zoom(1.2, 1000);
            });
        });

        // Store viewer globally
        window.current3DMolViewer = viewer;

        console.log('Pose loaded successfully');
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

    configureBoxEnveloping(config) {
        if (!this.currentViewer || !config.use_box_enveloping) {
            console.warn('Viewer not initialized or box enveloping not enabled');
            return false;
        }

        try {
            // Check if models are loaded
            const models = this.currentViewer.getModels();
            if (!models || models.length === 0) {
                console.error('No files loaded for box enveloping');
                return false;
            }

            // Calculate box dimensions from loaded molecules
            const atoms = [];
            models.forEach(model => {
                model.selectedAtoms({}).forEach(atom => {
                    atoms.push(atom);
                });
            });

            if (atoms.length === 0) {
                console.error('No atoms found for box calculation');
                return false;
            }

            // Calculate box center and dimensions
            const box = this.calculateBoxDimensions(atoms, config.padding || 2.0);
            
            // Update configuration with calculated values
            config.box_center = [box.center.x, box.center.y, box.center.z];
            config.box_size = [box.size.x, box.size.y, box.size.z];

            console.log('Box configuration updated:', config);
            return true;

        } catch (error) {
            console.error('Error in box enveloping configuration:', error);
            return false;
        }
    }

    calculateBoxDimensions(atoms, padding) {
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

        // Find min/max coordinates
        atoms.forEach(atom => {
            minX = Math.min(minX, atom.x);
            minY = Math.min(minY, atom.y);
            minZ = Math.min(minZ, atom.z);
            maxX = Math.max(maxX, atom.x);
            maxY = Math.max(maxY, atom.y);
            maxZ = Math.max(maxZ, atom.z);
        });

        // Add padding
        minX -= padding; minY -= padding; minZ -= padding;
        maxX += padding; maxY += padding; maxZ += padding;

        return {
            center: {
                x: (minX + maxX) / 2,
                y: (minY + maxY) / 2,
                z: (minZ + maxZ) / 2
            },
            size: {
                x: maxX - minX,
                y: maxY - minY,
                z: maxZ - minZ
            }
        };
    }

    extractBindingAffinityFromLog(logContent) {
        if (!logContent) return null;

        // Look for the first affinity value in the results table
        // Format: "   1        -8.5      0.000      0.000"
        const lines = logContent.split('\n');
        for (const line of lines) {
            // Skip header lines
            if (line.includes('mode |') || line.includes('-----')) continue;

            // Match lines with affinity values (format: "   1        -8.5      0.000      0.000")
            const match = line.match(/^\s+1\s+([-\d.]+)/);
            if (match) {
                return parseFloat(match[1]);
            }
        }

        return null;
    }

    updateExperimentInfoBox(structureId, drugName, bindingAffinity) {
        const experimentName = document.getElementById('experiment-name');
        const experimentAffinity = document.getElementById('experiment-affinity');
        const experimentInfo = document.getElementById('experiment-info');

        if (experimentName && experimentAffinity && experimentInfo) {
            experimentName.textContent = `${structureId} + ${drugName}`;
            experimentAffinity.textContent = bindingAffinity !== null ? `${bindingAffinity} kcal/mol` : 'N/A';
            experimentInfo.style.display = 'block';

            console.log('Experiment info box updated:', { structureId, drugName, bindingAffinity });
        } else {
            console.warn('Experiment info elements not found in DOM');
        }
    }
}