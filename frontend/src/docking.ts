// docking.ts — Gestión del experimento de docking en Modo Manual
import { icon } from './utils';
import type { RePoSUDOEAI } from './main';

export class DockingManager {
  private app: RePoSUDOEAI;

  constructor(appInstance: RePoSUDOEAI) {
    this.app = appInstance;
  }

  setupDocking(): void {
    const runDockingBtn = document.getElementById('run-docking-btn');
    if (runDockingBtn) {
      runDockingBtn.addEventListener('click', () => this.app.runDocking());
    }
  }

  setupBoxEnveloping(): void {
    console.log(icon('config') + ' Configurando caja manual');

    const enableCheckbox = document.getElementById('enable-custom-box') as HTMLInputElement | null;
    const boxInputIds = [
      'box-center-x', 'box-center-y', 'box-center-z',
      'box-size-x', 'box-size-y', 'box-size-z',
    ];
    const boxInputs = boxInputIds
      .map((id) => document.getElementById(id) as HTMLInputElement | null)
      .filter((el): el is HTMLInputElement => el !== null);

    const previewBtn = document.getElementById('preview-box-btn') as HTMLButtonElement | null;
    const clearBtn = document.getElementById('clear-box-btn') as HTMLButtonElement | null;

    const setControlsState = (enabled: boolean): void => {
      boxInputs.forEach((input) => {
        input.disabled = !enabled;
        input.style.opacity = enabled ? '1' : '0.5';
      });
      if (previewBtn) { previewBtn.disabled = !enabled; previewBtn.style.opacity = enabled ? '1' : '0.5'; }
      if (clearBtn)   { clearBtn.disabled = !enabled;   clearBtn.style.opacity = enabled ? '1' : '0.5'; }
    };

    if (enableCheckbox) {
      enableCheckbox.addEventListener('change', () => setControlsState(enableCheckbox.checked));
      // Estado inicial
      setControlsState(enableCheckbox.checked);
    }

    if (previewBtn) {
      previewBtn.addEventListener('click', () => {
        console.log(icon('success') + ' Preview de caja solicitado');
        // El viewerManager lo accede el app principal
        const viewer = (this.app as unknown as { viewerManager?: { previewManualBox?: () => void } }).viewerManager;
        viewer?.previewManualBox?.();
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        console.log(icon('info') + ' Limpiando configuración de caja');
        boxInputs.forEach((input) => { input.value = ''; });
        const viewer = (this.app as unknown as { viewerManager?: { clearBoxPreview?: () => void } }).viewerManager;
        viewer?.clearBoxPreview?.();
      });
    }
  }

  /** Devuelve true si el checkbox de caja personalizada está marcado */
  isCustomBoxEnabled(): boolean {
    const enableCheckbox = document.getElementById('enable-custom-box') as HTMLInputElement | null;
    return enableCheckbox?.checked ?? false;
  }

  setupExecutionParameters(): void {
    // Sincroniza el campo seed: deshabilitar cuando es 0 o vacío
    const seedInput = document.getElementById('vina-seed') as HTMLInputElement | null;
    if (seedInput) {
      seedInput.addEventListener('input', () => {
        const val = parseInt(seedInput.value, 10);
        if (isNaN(val) || val === 0) {
          seedInput.title = 'Seed aleatorio (0 = automático)';
        }
      });
    }

    // Scoring function toggle: habilitar/deshabilitar ad4
    const scoringSelect = document.getElementById('vina-scoring') as HTMLSelectElement | null;
    if (scoringSelect) {
      scoringSelect.addEventListener('change', () => {
        const skipPrep = document.getElementById('skip-preprocessing') as HTMLInputElement | null;
        if (skipPrep && scoringSelect.value === 'ad4') {
          skipPrep.checked = true;
        }
      });
    }
  }
}

console.log(icon('success') + ' docking.ts cargado.');
