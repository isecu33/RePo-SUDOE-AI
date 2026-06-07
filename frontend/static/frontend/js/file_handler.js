// FileManager Module - Handles all file operations and preview management
class FileManager {
    constructor(eventBus, csrfToken) {
        this.eventBus = eventBus;
        this.csrfToken = csrfToken;
        this.uploadedFiles = {
            receptor: null,
            drug: null,
            pose: null
        };
        this.loadedFiles = []; // Track all loaded files for unified display
        this.previewViewer = null; // Store reference to unified viewer
    }

    // Initialize file handling
    init() {
        this.setupFileUpload();
        this.setupChangeButtons();
    }

    // Configure file uploads for manual mode - Unified preview approach
    setupFileUpload() {
        console.log('Setting up unified file upload preview');
        
        // Handle file uploads for receptor, drug, and pose using unified preview window
        const fileInputs = document.querySelectorAll('.file-input');

        fileInputs.forEach(input => {
            console.log(`Setting up event listener for input:`, input.id);
            
            input.addEventListener('change', (event) => {
                console.log(`File input change event triggered for:`, event.target.id);
                
                const file = event.target.files[0];
                if (!file) {
                    console.log('No file selected, returning');
                    return;
                }

                const uploadType = event.target.id.split('-')[0]; // e.g., "receptor", "drug", "pose"
                const previewFilename = document.getElementById(`${uploadType}-filename`);
                const uploadCard = document.querySelector(`[data-upload="${uploadType}"]`);
                const changeButton = document.getElementById(`change-${uploadType}`);

                console.log(`File selected for ${uploadType}:`, file.name);
                console.log(`File size: ${file.size} bytes, type: ${file.type}`);
                console.log(`Looking for elements:`, {
                    uploadType: uploadType,
                    filenameId: `${uploadType}-filename`,
                    previewFilename: !!previewFilename,
                    uploadCard: !!uploadCard,
                    changeButton: !!changeButton
                });

                if (!previewFilename) {
                    console.error(`Missing preview filename element for ${uploadType}`);
                    console.error(`Expected ID: ${uploadType}-filename`);
                    console.error(`Available filename elements:`, Array.from(document.querySelectorAll('[id$="-filename"]')).map(el => el.id));
                    return;
                }

                // Hide upload card and show preview
                if (uploadCard) {
                    uploadCard.style.display = 'none';
                }

                // Update the preview filename with proper format
                const filenameTextSpan = previewFilename.querySelector('.filename-text');
                if (filenameTextSpan) {
                    filenameTextSpan.textContent = file.name;
                } else {
                    // Fallback for old structure
                    const fileTypeDisplayNames = {
                        'receptor': 'Receptor',
                        'drug': 'Drug',
                        'pose': 'Pose'
                    };
                    previewFilename.textContent = `${fileTypeDisplayNames[uploadType]}: ${file.name}`;
                }
                previewFilename.style.display = 'inline-block';
                previewFilename.style.fontWeight = '600';
                previewFilename.style.color = 'var(--text-primary)';

                // Show change button
                if (changeButton) {
                    changeButton.style.display = 'inline-block';
                }

                // Read the file content directly
                const reader = new FileReader();
                reader.onload = (e) => {
                    const fileData = e.target.result;
                    console.log(`File data loaded for ${uploadType}:`, file.name, `Length: ${fileData.length}`);

                    // Determine file format from extension
                    const format = this.detectFileFormat(file.name);
                    console.log(`Detected format for ${uploadType}: ${format}`);

                    // Store file data for unified display
                    this.storeFileForUnifiedPreview(uploadType, fileData, format, file.name);

                    console.log(`Current loaded files count: ${this.loadedFiles.length}`);
                    console.log('Loaded files:', this.loadedFiles.map(f => `${f.type}: ${f.filename}`));

                    // Emit event for unified preview update
                    console.log(`📢 Emitting 'fileLoaded' event for ${uploadType}:`, {
                        type: uploadType,
                        filename: file.name,
                        format: format,
                        loadedFilesCount: this.loadedFiles.length
                    });

                    this.eventBus.emit('fileLoaded', {
                        type: uploadType,
                        filename: file.name,
                        format: format,
                        loadedFiles: this.loadedFiles
                    });

                    console.log(`✅ Event 'fileLoaded' emitted successfully`);

                    // Auto-populate box center when se carga un receptor PDB
                    if (uploadType === 'receptor' && format === 'pdb') {
                        const center = FileManager.calculatePdbCenter(fileData);
                        if (center) {
                            const cx = document.getElementById('box-center-x');
                            const cy = document.getElementById('box-center-y');
                            const cz = document.getElementById('box-center-z');
                            if (cx) cx.value = center[0];
                            if (cy) cy.value = center[1];
                            if (cz) cz.value = center[2];
                            console.log('Centro de masa auto-calculado del receptor:', center);
                        }
                    }
                };
                
                reader.onerror = (error) => {
                    console.error('Error reading file:', error);
                    alert(`Error reading file ${file.name}: ${error}`);
                };
                
                // Read file as text
                reader.readAsText(file);

                // Upload file to server for docking
                this.uploadFileToServer(uploadType, file);

                console.log(`File loaded for ${uploadType}: ${file.name}`);
            });
        });

        // Setup upload card click handlers
        const uploadCards = document.querySelectorAll('.upload-card');
        uploadCards.forEach(card => {
            const uploadType = card.getAttribute('data-upload');
            const fileInput = document.getElementById(`${uploadType}-file`);
            
            if (fileInput) {
                card.addEventListener('click', () => {
                    console.log(`Card clicked for ${uploadType}`);
                    fileInput.click();
                });

                // Drag & Drop
                card.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    card.classList.add('dragover');
                });
                
                card.addEventListener('dragleave', () => {
                    card.classList.remove('dragover');
                });
                
                card.addEventListener('drop', (e) => {
                    e.preventDefault();
                    card.classList.remove('dragover');
                    
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                        fileInput.files = files;
                        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            }
        });
    }

    // Detect file format from extension
    detectFileFormat(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        const formatMap = {
            'pdbqt': 'pdbqt',
            'pdb': 'pdb',
            'sdf': 'sdf',
            'mol': 'mol',
            'mol2': 'mol2',
            'xyz': 'xyz'
        };

        if (!formatMap[extension]) {
            console.warn(`Unknown file extension: ${extension}, using PDB format`);
            return 'pdb';
        }

        return formatMap[extension];
    }

    // Setup "Change" buttons for uploaded files
    setupChangeButtons() {
        const fileTypes = ['receptor', 'drug', 'pose'];

        fileTypes.forEach(type => {
            const changeButton = document.getElementById(`change-${type}`);
            if (changeButton) {
                changeButton.addEventListener('click', () => {
                    this.showUploadZone(type);
                });
            }
        });
    }

    // Show upload zone and hide preview for changing files
    showUploadZone(fileType) {
        const uploadCard = document.querySelector(`[data-upload="${fileType}"]`);
        const filenameElement = document.getElementById(`${fileType}-filename`);
        const changeButton = document.getElementById(`change-${fileType}`);
        const fileInput = document.getElementById(`${fileType}-file`);

        // Show upload zone
        if (uploadCard) {
            uploadCard.style.display = 'block';
            uploadCard.classList.remove('success', 'error', 'uploading');
        }

        // Hide filename and change button
        if (filenameElement) {
            filenameElement.style.display = 'none';
            // Clear filename text in new structure
            const filenameTextSpan = filenameElement.querySelector('.filename-text');
            if (filenameTextSpan) {
                filenameTextSpan.textContent = '';
            } else {
                // Fallback for old structure
                filenameElement.textContent = '';
            }
            filenameElement.style.fontWeight = 'normal';
            filenameElement.style.color = 'var(--text-secondary)';
        }

        if (changeButton) {
            changeButton.style.display = 'none';
        }

        // Clear file input
        if (fileInput) {
            fileInput.value = '';
        }

        // Remove from loaded files array for unified preview
        this.loadedFiles = this.loadedFiles.filter(f => f.type !== fileType);

        // Clear uploaded file data
        this.uploadedFiles[fileType] = null;

        // Emit events
        this.eventBus.emit('fileRemoved', { type: fileType, loadedFiles: this.loadedFiles });
        this.eventBus.emit('dockingFilesChanged', this.uploadedFiles);

        console.log(`Upload zone restored for ${fileType}`);
    }


    
    // Store file data for unified preview
    storeFileForUnifiedPreview(uploadType, fileData, format, filename) {
        console.log(`Storing file for unified preview: ${uploadType} - ${filename}`);
        
        // Find if file type already exists and update it
        const existingIndex = this.loadedFiles.findIndex(f => f.type === uploadType);
        const fileInfo = {
            type: uploadType,
            data: fileData,
            format: format,
            filename: filename,
            color: this.getFileTypeColor(uploadType)
        };

        console.log(`File info created:`, {
            type: fileInfo.type,
            format: fileInfo.format,
            filename: fileInfo.filename,
            color: fileInfo.color,
            dataLength: fileInfo.data.length
        });

        if (existingIndex >= 0) {
            console.log(`Replacing existing ${uploadType} file at index ${existingIndex}`);
            this.loadedFiles[existingIndex] = fileInfo;
        } else {
            console.log(`Adding new ${uploadType} file to loaded files array`);
            this.loadedFiles.push(fileInfo);
        }

        console.log(`Total loaded files after storing ${uploadType}:`, this.loadedFiles.length);
        console.log('All loaded files:', this.loadedFiles.map(f => f.type + ': ' + f.filename));
    }

    // Get color for different file types
    getFileTypeColor(uploadType) {
        const colors = {
            'receptor': 'spectrum',
            'drug': 'darkorange',
            'pose': 'lime'
        };
        return colors[uploadType] || 'default';
    }

    // Upload file to server and store file path for docking
    async uploadFileToServer(uploadType, file) {
        try {
            console.log(`Uploading ${uploadType} file to server:`, file.name);

            const formData = new FormData();
            formData.append('file', file);
            formData.append('file_type', uploadType);

            const response = await fetch('/api/upload/', {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.csrfToken
                },
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                // Store file info with server file path for docking
                this.uploadedFiles[uploadType] = {
                    filename: file.name,
                    file: file,
                    file_path: result.file_path,
                    success: true
                };

                console.log(`${icon('success')} ${uploadType} file uploaded successfully:`, result.file_path);

                // Emit event for docking button update
                this.eventBus.emit('fileUploaded', {
                    type: uploadType,
                    success: true,
                    uploadedFiles: this.uploadedFiles
                });

            } else {
                console.error(`${icon('error')} Failed to upload ${uploadType} file:`, result.error);

                // Store file info but mark as failed
                this.uploadedFiles[uploadType] = {
                    filename: file.name,
                    file: file,
                    file_path: null,
                    success: false,
                    error: result.error
                };

                this.eventBus.emit('fileUploadError', {
                    type: uploadType,
                    error: result.error
                });
            }

        } catch (error) {
            console.error(`${icon('error')} Error uploading ${uploadType} file:`, error);

            this.uploadedFiles[uploadType] = {
                filename: file.name,
                file: file,
                file_path: null,
                success: false,
                error: error.message
            };

            this.eventBus.emit('fileUploadError', {
                type: uploadType,
                error: error.message
            });
        }
    }

    // Get uploaded files for docking
    getUploadedFiles() {
        return this.uploadedFiles;
    }

    // Get loaded files for preview
    getLoadedFiles() {
        return this.loadedFiles;
    }

    // Clear all files
    clearAllFiles() {
        this.uploadedFiles = {
            receptor: null,
            drug: null,
            pose: null
        };
        this.loadedFiles = [];
        this.eventBus.emit('allFilesCleared');
    }

    /**
     * Calcula el centro de masa de un PDB desde su contenido texto.
     * Parsea las líneas ATOM usando las columnas fijas del formato PDB.
     * @param {string} pdbText - Contenido del archivo PDB como string
     * @returns {number[]|null} [x, y, z] redondeado a 2 decimales, o null si no hay átomos
     */
    static calculatePdbCenter(pdbText) {
        let sumX = 0, sumY = 0, sumZ = 0, count = 0;
        const lines = pdbText.split('\n');
        for (const line of lines) {
            if (line.startsWith('ATOM')) {
                const x = parseFloat(line.substring(30, 38));
                const y = parseFloat(line.substring(38, 46));
                const z = parseFloat(line.substring(46, 54));
                if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    sumX += x;
                    sumY += y;
                    sumZ += z;
                    count++;
                }
            }
        }
        if (count === 0) return null;
        return [
            Math.round(sumX / count * 100) / 100,
            Math.round(sumY / count * 100) / 100,
            Math.round(sumZ / count * 100) / 100
        ];
    }
}

    // Global function for downloading files
function downloadFile(filePath, fileName) {
    // Extract just the filename from the full path
    const actualFileName = fileName || filePath.split('/').pop().split('\\').pop();
    
    // Create download URL
    const downloadUrl = `/download/output/${actualFileName}`;
    
    // Create temporary link and trigger download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = actualFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
