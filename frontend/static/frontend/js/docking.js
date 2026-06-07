// File location: RePo-SUDOE-AI/frontend/static/frontend/js/docking.js
// Docking experiment handling

class DockingManager {
    constructor(appInstance) {
        this.app = appInstance;
    }

    setupDocking() {
        const runDockingBtn = document.getElementById('run-docking-btn');
        if (runDockingBtn) {
            runDockingBtn.addEventListener('click', () => this.app.runDocking());
        }
    }

    setupBoxEnveloping() {
        console.log(icon('config') + ' Setting up manual box configuration');
        
        const enableCheckbox = document.getElementById('enable-custom-box');
        const boxInputs = document.querySelectorAll('#box-center-x, #box-center-y, #box-center-z, #box-size-x, #box-size-y, #box-size-z');
        const previewBtn = document.getElementById('preview-box-btn');
        const clearBtn = document.getElementById('clear-box-btn');
        
        if (enableCheckbox) {
            enableCheckbox.addEventListener('change', () => {
                const isEnabled = enableCheckbox.checked;
                boxInputs.forEach(input => {
                    input.disabled = !isEnabled;
                    input.style.opacity = isEnabled ? '1' : '0.5';
                });

                // Enable/disable preview and clear buttons
                if (previewBtn) {
                    previewBtn.disabled = !isEnabled;
                    previewBtn.style.opacity = isEnabled ? '1' : '0.5';
                }
                if (clearBtn) {
                    clearBtn.disabled = !isEnabled;
                    clearBtn.style.opacity = isEnabled ? '1' : '0.5';
                }
            });

            // Set initial state (disabled by default)
            const isEnabled = enableCheckbox.checked;
            if (previewBtn) {
                previewBtn.disabled = !isEnabled;
                previewBtn.style.opacity = isEnabled ? '1' : '0.5';
            }
            if (clearBtn) {
                clearBtn.disabled = !isEnabled;
                clearBtn.style.opacity = isEnabled ? '1' : '0.5';
            }
        }
        
        if (previewBtn) {
            previewBtn.addEventListener('click', () => {
                console.log(icon('success') + ' Box preview requested');
                if (this.viewerManager) {
                    this.viewerManager.previewManualBox();
                } else {
                    console.error(icon('error') + ' ViewerManager not initialized');
                    alert('ViewerManager not available');
                }
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                console.log(icon('success') + ' Box clear requested');
                if (this.viewerManager) {
                    this.viewerManager.clearManualBoxPreview();
                } else {
                    console.error(icon('error') + ' ViewerManager not initialized');
                }
                boxInputs.forEach(input => {
                    input.value = '';
                });
            });
        }

        boxInputs.forEach(input => {
            input.addEventListener('change', () => {
                console.log(icon('success') + ' Box parameter updated');
            });
        });
        
        console.log(icon('success') + ' Manual box configuration setup complete');
    }

    setupExecutionParameters() {
        console.log(icon('config') + ' Setting up execution parameters configuration');
        
        const enableCheckbox = document.getElementById('enable-custom-params');
        const paramInputs = document.querySelectorAll('#exhaustiveness, #num-modes, #energy-range, #cpu-cores, #seed');
        
        if (enableCheckbox) {
            enableCheckbox.addEventListener('change', () => {
                const isEnabled = enableCheckbox.checked;
                paramInputs.forEach(input => {
                    input.disabled = !isEnabled;
                    input.style.opacity = isEnabled ? '1' : '0.5';
                });
            });
        }
        
        console.log(icon('success') + ' Execution parameters configuration setup complete');
    }

    isCustomBoxEnabled() {
        const enableCheckbox = document.getElementById('enable-custom-box');
        return enableCheckbox ? enableCheckbox.checked : false;
    }

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

    isCustomExecutionEnabled() {
        const enableCheckbox = document.getElementById('enable-custom-params');
        return enableCheckbox ? enableCheckbox.checked : false;
    }

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

        const uploadedFiles = this.app.fileManager ? this.app.fileManager.getUploadedFiles() : {};

        const hasReceptor = uploadedFiles.receptor &&
                           uploadedFiles.receptor.success &&
                           uploadedFiles.receptor.file_path;

        const hasDrug = uploadedFiles.drug &&
                       uploadedFiles.drug.success &&
                       uploadedFiles.drug.file_path;

        const hasRequired = hasReceptor && hasDrug;

        runDockingBtn.disabled = !hasRequired;

        if (hasRequired) {
            runDockingBtn.style.opacity = '1';
            runDockingBtn.style.cursor = 'pointer';
        } else {
            runDockingBtn.style.opacity = '0.5';
            runDockingBtn.style.cursor = 'not-allowed';
        }
    }

    restoreInputTabAfterDocking() {
        try {
            console.log(icon('info') + ' Restoring input tab after docking completion');
            
            const loadingSection = document.getElementById('docking-loading-section');
            console.log('[TARGET] Loading section found:', !!loadingSection);
            if (loadingSection) {
                loadingSection.remove();
                console.log(icon('success') + ' Loading section removed');
            }
            
            const manualSection = document.getElementById('manual');
            console.log('[TARGET] Manual section found:', !!manualSection);
            if (manualSection) {
                manualSection.style.display = 'block';
                console.log(icon('success') + ' Manual section restored');
            }
            
            console.log(icon('success') + ' Input tab restored after docking completion');
        } catch (error) {
            console.error(icon('error') + ' Error restoring input tab:', error);
        }
    }

    displayExperimentAnalysis(analysis) {
        if (!analysis || !analysis.drug_name) return;

        const messagesContainer = document.getElementById('chat-messages');
        const analysisDiv = document.createElement('div');
        analysisDiv.className = 'message assistant-message';

        analysisDiv.innerHTML = `
            <div class="message-content">
                <div>
                    <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border-color);">
                        ${getIcon('info', '', 24)}
                        <h3 style="margin: 0; font-size: 1.2rem; font-weight: 600; color: var(--text-primary);">${t('experimentInfo')}</h3>
                    </div>

                    <div style="margin-bottom: 1.5rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
                        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">
                            <strong style="color: var(--text-primary);">${t('experimentLabel')}:</strong>
                            ${analysis.drug_name} ${icon('mix')} ${analysis.gene_name}
                            ${analysis.pdb_structure ? `(${analysis.pdb_structure})` : ''}
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary);">
                            ${analysis.timestamp || ''}
                        </div>
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                            ${icon('pill')}
                            <h4 style="margin: 0; font-size: 1rem; font-weight: 600; color: var(--accent-color);">${t('drugLabel')}: ${analysis.drug_name}</h4>
                        </div>
                        <div style="padding-left: 2rem; color: var(--text-primary);">
                            ${UIUtils.formatInfoField(t('description'), analysis.drug_description)}
                            ${UIUtils.formatInfoField(t('indications'), analysis.drug_indications)}
                            ${UIUtils.formatInfoField(t('status'), analysis.drug_status)}
                            ${UIUtils.formatInfoField(t('molecularFormula'), analysis.drug_molecular_formula)}
                            ${UIUtils.formatInfoField(t('molecularWeight'), analysis.drug_molecular_weight)}
                        </div>
                    </div>

                    <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                            ${icon('dna')}
                            <h4 style="margin: 0; font-size: 1rem; font-weight: 600; color: var(--blue-color);">${t('geneProteinLabel')}: ${analysis.gene_name}</h4>
                        </div>
                        <div style="padding-left: 2rem; color: var(--text-primary);">
                            ${UIUtils.formatInfoField(t('fullName'), analysis.gene_full_name)}
                            ${UIUtils.formatInfoField(t('function'), analysis.gene_function)}
                            ${UIUtils.formatInfoField(t('associatedDiseases'), analysis.gene_diseases)}
                            ${UIUtils.formatInfoField(t('molecularPathways'), analysis.gene_pathways)}
                        </div>
                    </div>
                </div>
            </div>
        `;

        messagesContainer.appendChild(analysisDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

console.log(icon('success') + ' docking.js loaded');
