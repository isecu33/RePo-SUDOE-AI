// embedded_viewer.ts — Gestión del visualizador 3D molecular (3Dmol.js)
import { UIUtils } from './utils';
import type { EventBus } from './event_bus';
import type { LoadedFile, ThreeDMolViewer } from './types';

// Tipos para datos de pose PDBQT
interface Pose {
  model: number | null;
  affinity: string | null;
  pdbqt: string;
}

// Configuración de caja de docking
interface BoxConfig {
  calculated_center?: [number, number, number];
  calculated_size?: [number, number, number];
  padding?: number;
}

interface BoxDimensions {
  center: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
}

// Info de archivo manual almacenado
interface ManualFileInfo {
  key: string;
  name: string;
  data?: string;
  format?: string;
  isVinaOutput?: boolean;
  receptorFile?: { data: string; format: string } | null;
  ligandFile?: { data: string; format: string } | null;
}

// Configuración de Vina (local)
interface VinaBoxConfig {
  center_x?: number;
  center_y?: number;
  center_z?: number;
  size_x?: number;
  size_y?: number;
  size_z?: number;
  [key: string]: unknown;
}

// Experimento activo en el visor
interface CurrentExperiment {
  drugName: string;
  structureId: string;
  receptorData: string | null;
  allPoses: Pose[];
  ligandData: string;
}

// Extensión de Window para el viewer global
declare global {
  interface Window {
    current3DMolViewer?: ThreeDMolViewer;
    currentExperiment?: CurrentExperiment;
    $3Dmol: import('./types').ThreeDMol;
    $: (el: HTMLElement | string) => HTMLElement; // jQuery-like wrapper (devuelve el elemento para 3Dmol)
  }
}

export class ViewerManager {
  private eventBus: EventBus;
  private csrfToken: string;
  previewViewer: ThreeDMolViewer | null = null;
  private enhancedViewer: unknown = null;
  private currentResults: unknown = null;
  private selectedPose = 0;
  loadedFiles: LoadedFile[] = [];
  private boxPreviewTimeout: ReturnType<typeof setTimeout> | null = null;
  private manualFiles: ManualFileInfo[] = [];

  constructor(eventBus: EventBus, csrfToken: string) {
    this.eventBus = eventBus;
    this.csrfToken = csrfToken;
  }

  init(): void {
    this.setupIntegratedVisualizerControls();
    this.setupEventListeners();
  }

  // ---- Listeners de EventBus ----

  setupEventListeners(): void {
    this.eventBus.on<{ loadedFiles: LoadedFile[] }>('fileLoaded', (data) => {
      this.loadedFiles = data.loadedFiles;
      this.updateUnifiedPreview();
    });
    this.eventBus.on<{ loadedFiles: LoadedFile[] }>('fileRemoved', (data) => {
      this.loadedFiles = data.loadedFiles;
      if (this.loadedFiles.length > 0) this.updateUnifiedPreview();
      else this.clearUnifiedPreview();
    });
    this.eventBus.on('allFilesCleared', () => {
      this.loadedFiles = [];
      this.clearUnifiedPreview();
    });
  }

  // ---- Preview unificado ----

  updateUnifiedPreview(): void {
    this.showUnifiedPreviewSection();
    this._performUpdate();
  }

  private _performUpdate(): void {
    if (!window.$3Dmol) { console.error('3DMol no cargado'); return; }
    const viewerElement = document.getElementById('manual-viewer');
    if (!viewerElement) { console.error('#manual-viewer no encontrado'); return; }

    try {
      if (!this.previewViewer) {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const bg = currentTheme === 'dark' ? 0x1a1f2e : 0xffffff;
        viewerElement.style.display = 'block';
        this.previewViewer = window.$3Dmol.createViewer(window.$(viewerElement), {
          backgroundColor: bg,
          defaultcolors: (window.$3Dmol as unknown as Record<string, unknown>)['rasmolElementColors'],
        });
        window.current3DMolViewer = this.previewViewer;
        setTimeout(() => { this.previewViewer?.resize(); }, 100);
      } else {
        this.previewViewer.removeAllModels();
        const currentTheme = document.documentElement.getAttribute('data-theme');
        (this.previewViewer as unknown as { setBackgroundColor: (c: number) => void }).setBackgroundColor(
          currentTheme === 'dark' ? 0x1a1f2e : 0xffffff,
        );
      }

      this.loadedFiles.forEach((fileInfo, idx) => {
        try {
          const model = this.previewViewer!.addModel(fileInfo.data, fileInfo.format);
          const style = this.getFileTypeStyle(fileInfo.type, fileInfo.format);
          this.previewViewer!.setStyle({ model: idx }, style);
        } catch (err) {
          console.error(`Error al añadir modelo ${fileInfo.type}:`, err);
        }
      });

      requestAnimationFrame(() => {
        this.previewViewer!.zoomTo();
        this.previewViewer!.render();
        requestAnimationFrame(() => {
          this.previewViewer!.resize();
          this.previewViewer!.render();
          this.previewViewer!.zoom(1.2, 1000);
        });
      });

      this.showUnifiedPreviewSection();
    } catch (err) {
      console.error('Error actualizando preview:', err);
    }
  }

  private getFileTypeStyle(type: string, format: string): object {
    switch (type) {
      case 'receptor':
        if (format === 'pdb' || format === 'pdbqt') return { cartoon: { color: 'spectrum' }, opacity: 0.8 };
        return { stick: { radius: 0.3, colorScheme: 'spectrum' } };
      case 'drug':
        return { stick: { radius: 0.4, color: 'darkorange' } };
      case 'pose':
        return { stick: { radius: 0.3, colorscheme: 'lime' }, sphere: { radius: 0.3, colorscheme: 'lime' } };
      default:
        return { stick: { radius: 0.3, colorscheme: 'spectrum' } };
    }
  }

  private showUnifiedPreviewSection(): void {
    const el = document.querySelector<HTMLElement>('.unified-preview-section');
    if (el) el.style.display = 'block';
    const preview = document.querySelector<HTMLElement>('#preview');
    if (preview) preview.style.display = 'block';

    const titleEl = document.querySelector<HTMLElement>('#unified-preview-title');
    if (!titleEl) return;
    const count = this.loadedFiles.length;
    if (count > 1) {
      titleEl.textContent = `Vista Unificada — ${count} archivos`;
      titleEl.style.color = 'var(--accent-color)';
    } else if (count === 1) {
      const t = this.loadedFiles[0]!.type;
      titleEl.textContent = `Vista Molecular — ${t.charAt(0).toUpperCase() + t.slice(1)}`;
    }
  }

  clearUnifiedPreview(): void {
    if (this.previewViewer) {
      this.previewViewer.removeAllModels();
      this.previewViewer = null;
      window.current3DMolViewer = undefined;
    }
    const el = document.getElementById('manual-viewer');
    if (el) { el.innerHTML = ''; el.style.display = 'none'; }
  }

  // ---- Carga de outputs de docking ----

  async loadVinaOutputFile(drugName: string, structureId: string): Promise<void> {
    console.log('Cargando experimento:', { drugName, structureId });
    const outputViewer = document.getElementById('output-viewer');
    if (!outputViewer) { console.error('#output-viewer no encontrado'); return; }

    try {
      outputViewer.style.display = 'block';
      outputViewer.innerHTML = '';
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const bg = currentTheme === 'dark' ? 0x1a1f2e : 0xffffff;

      const viewer = window.$3Dmol.createViewer(window.$(outputViewer), {
        backgroundColor: bg,
        defaultcolors: (window.$3Dmol as unknown as Record<string, unknown>)['rasmolElementColors'],
      });
      setTimeout(() => viewer?.resize(), 100);

      // Receptor
      let receptorLoaded = false;
      let receptorData: string | null = null;
      try {
        const r = await fetch(`/api/input/${structureId}.pdb`);
        if (r.ok) {
          receptorData = await r.text();
          viewer.addModel(receptorData, 'pdb');
          viewer.setStyle({}, { cartoon: { color: 'spectrum' } });
          receptorLoaded = true;
        }
      } catch { /* no hay receptor */ }

      // Ligando
      const ligandFilename = `${structureId}_${drugName}_out.pdbqt`;
      const ligandResp = await fetch(`/api/output/${ligandFilename}`);
      if (!ligandResp.ok) throw new Error(`Archivo de ligando no encontrado: ${ligandFilename}`);
      const ligandData = await ligandResp.text();

      const allPoses = this.extractAllPoses(ligandData);
      window.currentExperiment = { drugName, structureId, receptorData, allPoses, ligandData };

      // Poblar selector de poses
      const poseSelector = document.getElementById('pose-selector') as HTMLSelectElement | null;
      if (poseSelector) {
        poseSelector.innerHTML = '<option value="">Seleccionar pose...</option>';
        allPoses.forEach((pose, i) => {
          const opt = document.createElement('option');
          opt.value = String(i);
          opt.textContent = `Pose ${pose.model ?? i + 1} (Afinidad: ${pose.affinity ?? 'N/A'} kcal/mol)`;
          poseSelector.appendChild(opt);
        });
      }

      const bestPose = this.extractBestPose(ligandData);
      viewer.addModel(bestPose, 'pdbqt');

      if (receptorLoaded) viewer.setStyle({ model: 0 }, { cartoon: { color: 'spectrum' } });
      viewer.setStyle({ model: receptorLoaded ? 1 : 0 }, { stick: { radius: 0.3, colorscheme: 'greenCarbon' } });

      requestAnimationFrame(() => {
        viewer.zoomTo(); viewer.resize(); viewer.render();
        requestAnimationFrame(() => { viewer.resize(); viewer.zoom(1.2, 1000); });
      });

      window.current3DMolViewer = viewer;
    } catch (error) {
      console.error('Error cargando output Vina:', error);
      outputViewer.innerHTML = `<div style="padding:20px;text-align:center;color:#d73027;">Error: ${error instanceof Error ? error.message : String(error)}</div>`;
    }
  }

  loadSpecificPose(poseIndex: number): void {
    const exp = window.currentExperiment;
    if (!exp?.allPoses) { console.error('No hay experimento cargado'); return; }
    const pose = exp.allPoses[poseIndex];
    if (!pose) { console.error('Pose no encontrada:', poseIndex); return; }

    const outputViewer = document.getElementById('output-viewer');
    if (!outputViewer) return;
    outputViewer.style.display = 'block';
    outputViewer.innerHTML = '';

    const currentTheme = document.documentElement.getAttribute('data-theme');
    const bg = currentTheme === 'dark' ? 0x1a1f2e : 0xffffff;
    const viewer = window.$3Dmol.createViewer(window.$(outputViewer), { backgroundColor: bg });
    setTimeout(() => viewer?.resize(), 100);

    if (exp.receptorData) {
      viewer.addModel(exp.receptorData, 'pdb');
      viewer.setStyle({ model: 0 }, { cartoon: { color: 'spectrum' } });
    }

    viewer.addModel(this.cleanPDBQTForVisualization(pose.pdbqt), 'pdbqt');
    viewer.setStyle({ model: 1 }, { stick: { radius: 0.3, colorscheme: 'greenCarbon' } });

    requestAnimationFrame(() => {
      viewer.zoomTo(); viewer.resize(); viewer.render();
      requestAnimationFrame(() => { viewer.resize(); viewer.zoom(1.2, 1000); });
    });
    window.current3DMolViewer = viewer;
  }

  // ---- Controles del visualizador integrado ----

  setupIntegratedVisualizerControls(): void {
    // Cargar experimento seleccionado
    document.getElementById('load-selected-experiment')?.addEventListener('click', async () => {
      const sel = document.getElementById('experiment-selector') as HTMLSelectElement | null;
      const val = sel?.value;
      if (!val) { alert('Selecciona un experimento.'); return; }

      if (val.startsWith('manual_')) {
        this.loadManualFile(val);
      } else {
        const parts = val.split('_');
        const pdbId = parts[0] ?? '';
        const drugName = parts.slice(1).join('_');
        await this.loadVinaOutputFile(drugName, pdbId);
        await this.loadExperimentLogFromSelector(pdbId, drugName);
      }
    });

    // Estilo molecular
    const applyStyleBtn = document.getElementById('apply-style');
    const styleSelector = document.getElementById('style-selector') as HTMLSelectElement | null;
    applyStyleBtn?.addEventListener('click', () => {
      if (styleSelector) this.applyMolecularStyle(styleSelector.value);
    });

    // Color
    const applyColorBtn = document.getElementById('apply-color');
    const colorScheme = document.getElementById('color-scheme') as HTMLSelectElement | null;
    applyColorBtn?.addEventListener('click', () => {
      if (colorScheme && styleSelector) this.applyColorScheme(styleSelector.value, colorScheme.value);
    });

    // Reset / zoom
    document.getElementById('reset-view')?.addEventListener('click', () => this.resetMolecularView());
    document.getElementById('zoom-binding')?.addEventListener('click', () => this.zoomToBindingSite());

    // Receptor/ligando independientes
    const applyRecBtn = document.getElementById('apply-receptor-style');
    const recStyle = document.getElementById('receptor-style-selector') as HTMLSelectElement | null;
    const recColor = document.getElementById('receptor-color-scheme') as HTMLSelectElement | null;
    applyRecBtn?.addEventListener('click', () => {
      if (recStyle && recColor) this.applyReceptorStyle(recStyle.value, recColor.value);
    });

    const applyLigBtn = document.getElementById('apply-ligand-style');
    const ligStyle = document.getElementById('ligand-style-selector') as HTMLSelectElement | null;
    const ligColor = document.getElementById('ligand-color-scheme') as HTMLSelectElement | null;
    applyLigBtn?.addEventListener('click', () => {
      if (ligStyle && ligColor) this.applyLigandStyle(ligStyle.value, ligColor.value);
    });

    // Descarga ZIP
    document.getElementById('download-pdbqt')?.addEventListener('click', () => this.downloadSelectedExperiment());

    // Selector de pose
    const loadPoseBtn = document.getElementById('load-selected-pose');
    const poseSelector = document.getElementById('pose-selector') as HTMLSelectElement | null;
    loadPoseBtn?.addEventListener('click', () => {
      const v = poseSelector?.value;
      if (!v) { alert('Selecciona una pose.'); return; }
      this.loadSpecificPose(parseInt(v, 10));
    });
  }

  // ---- Estilos y colores ----

  applyMolecularStyle(style: string): void {
    if (!window.current3DMolViewer) return;
    const styleObj: Record<string, unknown> = {};
    styleObj[style] = style === 'cartoon' ? { color: 'spectrum', opacity: 0.8 }
      : style === 'sphere' ? { radius: 1.0, colorscheme: 'default' }
      : style === 'line' ? { linewidth: 2, colorscheme: 'default' }
      : { radius: 0.3, colorscheme: 'default' };
    window.current3DMolViewer.setStyle({}, styleObj);
    window.current3DMolViewer.render();
  }

  applyColorScheme(style: string, colorScheme: string): void {
    if (!window.current3DMolViewer) return;
    const map: Record<string, string> = {
      default: 'default', carbon: 'grayCarbon', chainbow: 'rainbow',
      residue: 'residue', spectrum: 'spectrum', chain: 'chain', atom: 'atom',
    };
    const styleObj: Record<string, unknown> = {};
    styleObj[style] = { radius: 0.3, colorscheme: map[colorScheme] ?? 'default' };
    window.current3DMolViewer.setStyle({}, styleObj);
    window.current3DMolViewer.render();
  }

  applyReceptorStyle(style: string, colorScheme: string): void {
    if (!window.current3DMolViewer) return;
    const s: Record<string, unknown> = {};
    s[style] = { colorscheme: colorScheme };
    window.current3DMolViewer.setStyle({ model: 0 }, s);
    window.current3DMolViewer.render();
  }

  applyLigandStyle(style: string, colorScheme: string): void {
    if (!window.current3DMolViewer) return;
    const s: Record<string, unknown> = {};
    s[style] = { radius: 0.25, colorscheme: colorScheme };
    window.current3DMolViewer.setStyle({ model: 1 }, s);
    window.current3DMolViewer.render();
  }

  resetMolecularView(): void {
    window.current3DMolViewer?.zoomTo();
    window.current3DMolViewer?.render();
  }

  zoomToBindingSite(): void {
    if (window.current3DMolViewer) {
      window.current3DMolViewer.zoomTo();
      window.current3DMolViewer.zoom(1.5, 1000);
      window.current3DMolViewer.render();
    }
  }

  // ---- Box preview ----

  previewManualBox(): void {
    if (!this.isCustomBoxEnabled()) { alert('Activa los parámetros de caja primero.'); return; }
    if (!this.previewViewer) { alert('Carga archivos moleculares primero.'); return; }
    const boxParams = this.getManualBoxParameters();
    if (!boxParams) { alert('Introduce parámetros de caja válidos.'); return; }

    this.clearManualBoxPreview();
    const [cx, cy, cz] = boxParams.box_center;
    const [sx, sy, sz] = boxParams.box_size;
    const hx = sx / 2, hy = sy / 2, hz = sz / 2;

    const verts: Array<[number, number, number]> = [
      [cx - hx, cy - hy, cz - hz], [cx + hx, cy - hy, cz - hz],
      [cx + hx, cy + hy, cz - hz], [cx - hx, cy + hy, cz - hz],
      [cx - hx, cy - hy, cz + hz], [cx + hx, cy - hy, cz + hz],
      [cx + hx, cy + hy, cz + hz], [cx - hx, cy + hy, cz + hz],
    ];
    const edges: Array<[number, number]> = [
      [0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7],
    ];

    const v = this.previewViewer as unknown as {
      addCylinder: (spec: object) => void;
      render: () => void;
    };
    edges.forEach(([s, e]) => {
      v.addCylinder({
        start: { x: verts[s]![0], y: verts[s]![1], z: verts[s]![2] },
        end: { x: verts[e]![0], y: verts[e]![1], z: verts[e]![2] },
        radius: 0.2, color: 'limegreen', alpha: 0.85,
      });
    });
    v.render();
  }

  clearManualBoxPreview(): void {
    if (!this.previewViewer) return;
    this.previewViewer.removeAllShapes();
    this.previewViewer.render();
  }

  clearBoxPreview(): void { this.clearManualBoxPreview(); }

  updateBoxPreviewIfVisible(): void {
    if (!this.previewViewer || !this.isCustomBoxEnabled()) return;
    try {
      const v = this.previewViewer as unknown as { getShapes?: () => unknown[] };
      if ((v.getShapes?.().length ?? 0) > 0) this.previewManualBox();
    } catch { this.previewManualBox(); }
  }

  isCustomBoxEnabled(): boolean {
    return (document.getElementById('enable-custom-box') as HTMLInputElement | null)?.checked ?? false;
  }

  getManualBoxParameters(): { use_custom_box: true; box_center: [number, number, number]; box_size: [number, number, number] } | null {
    if (!this.isCustomBoxEnabled()) return null;
    const getF = (id: string) => parseFloat((document.getElementById(id) as HTMLInputElement | null)?.value ?? '');
    const center: [number, number, number] = [getF('box-center-x') || 0, getF('box-center-y') || 0, getF('box-center-z') || 0];
    const size: [number, number, number] = [getF('box-size-x') || 20, getF('box-size-y') || 20, getF('box-size-z') || 20];
    return { use_custom_box: true, box_center: center, box_size: size };
  }

  // ---- Utilidades PDBQT ----

  cleanPDBQTForVisualization(pdbqt: string): string {
    return pdbqt.split('\n').filter((l) =>
      !l.startsWith('ROOT') && !l.startsWith('ENDROOT') &&
      !l.startsWith('BRANCH') && !l.startsWith('ENDBRANCH') && !l.startsWith('TORSDOF')
    ).join('\n');
  }

  extractBestPose(pdbqtContent: string): string {
    const poses = this.extractAllPoses(pdbqtContent);
    if (poses.length === 0) return this.cleanPDBQTForVisualization(pdbqtContent);
    let best = poses[0]!;
    for (const p of poses) {
      if (p.affinity && best.affinity && parseFloat(p.affinity) < parseFloat(best.affinity)) best = p;
    }
    return this.cleanPDBQTForVisualization(best.pdbqt);
  }

  extractAllPoses(pdbqtContent: string): Pose[] {
    const lines = pdbqtContent.split('\n');
    const poses: Pose[] = [];
    let current = '';
    let modelNum: number | null = null;
    let affinity: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      if (line.startsWith('MODEL')) {
        modelNum = parseInt(line.split(' ')[1] ?? '0', 10);
        current = line + '\n';
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          if ((lines[j] ?? '').includes('REMARK VINA RESULT:')) {
            affinity = (lines[j] ?? '').trim().split(/\s+/)[3] ?? null;
            break;
          }
        }
      } else if (line.startsWith('ENDMDL')) {
        current += line + '\n';
        poses.push({ model: modelNum, affinity, pdbqt: current });
        current = ''; modelNum = null; affinity = null;
      } else if (modelNum !== null) {
        current += line + '\n';
      }
    }
    return poses;
  }

  // ---- Cálculo de caja (box enveloping) ----

  calculateBoxEnvelopingConfig(loadedFiles: LoadedFile[]): BoxConfig {
    if (!loadedFiles.length || !this.previewViewer) return { padding: 5.0 };
    try {
      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      let count = 0;

      const v = this.previewViewer as unknown as { getModels: () => Array<{ selectedAtoms: (s: object) => Array<{ x: number; y: number; z: number }> }> };
      v.getModels().forEach((m) => {
        m.selectedAtoms({}).forEach((atom) => {
          minX = Math.min(minX, atom.x); maxX = Math.max(maxX, atom.x);
          minY = Math.min(minY, atom.y); maxY = Math.max(maxY, atom.y);
          minZ = Math.min(minZ, atom.z); maxZ = Math.max(maxZ, atom.z);
          count++;
        });
      });

      if (count === 0) return { padding: 5.0 };
      return {
        calculated_center: [(minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2],
        calculated_size: [maxX - minX, maxY - minY, maxZ - minZ],
        padding: 5.0,
      };
    } catch { return { padding: 5.0 }; }
  }

  applyBoxEnveloping(vinaConfig: VinaBoxConfig, boxConfig: BoxConfig): VinaBoxConfig {
    if (!boxConfig.calculated_center || !boxConfig.calculated_size) return vinaConfig;
    const pad = boxConfig.padding ?? 5.0;
    vinaConfig.center_x = boxConfig.calculated_center[0];
    vinaConfig.center_y = boxConfig.calculated_center[1];
    vinaConfig.center_z = boxConfig.calculated_center[2];
    vinaConfig.size_x = boxConfig.calculated_size[0] + 2 * pad;
    vinaConfig.size_y = boxConfig.calculated_size[1] + 2 * pad;
    vinaConfig.size_z = boxConfig.calculated_size[2] + 2 * pad;
    return vinaConfig;
  }

  calculateBoxDimensions(atoms: Array<{ x: number; y: number; z: number }>, padding: number): BoxDimensions {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    atoms.forEach((a) => {
      minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x);
      minY = Math.min(minY, a.y); maxY = Math.max(maxY, a.y);
      minZ = Math.min(minZ, a.z); maxZ = Math.max(maxZ, a.z);
    });
    minX -= padding; maxX += padding;
    minY -= padding; maxY += padding;
    minZ -= padding; maxZ += padding;
    return {
      center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
      size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
    };
  }

  // ---- Log del experimento ----

  async loadExperimentLogFromSelector(structureId: string, drugName: string): Promise<void> {
    const moleculeInfo = document.getElementById('molecule-info');
    if (!moleculeInfo) return;
    moleculeInfo.innerHTML = '<div class="experiment-details"><p>Cargando log...</p></div>';

    try {
      const resp = await fetch(`/api/output/${structureId}_${drugName}_vina.log`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const log = await resp.text();
      const filtered = UIUtils.parseVinaLog(log);
      const affinity = this.extractBindingAffinityFromLog(log);
      this.updateExperimentInfoBox(structureId, drugName, affinity);
      moleculeInfo.innerHTML = `<pre style="background:var(--bg-secondary);padding:15px;border-radius:8px;overflow-x:auto;font-family:'Courier New',monospace;font-size:12px;line-height:1.4;white-space:pre-wrap;margin:0;">${filtered}</pre>`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      moleculeInfo.innerHTML = `<pre style="padding:15px;border-radius:8px;color:var(--error-color);margin:0;">No se pudo cargar el log: ${msg}</pre>`;
    }
  }

  extractBindingAffinityFromLog(logContent: string): number | null {
    for (const line of logContent.split('\n')) {
      if (line.includes('mode |') || line.includes('-----')) continue;
      const match = line.match(/^\s+1\s+([-\d.]+)/);
      if (match) return parseFloat(match[1] ?? '');
    }
    return null;
  }

  updateExperimentInfoBox(structureId: string, drugName: string, affinity: number | null): void {
    const nameEl = document.getElementById('experiment-name');
    const affinityEl = document.getElementById('experiment-affinity');
    const infoEl = document.getElementById('experiment-info');
    if (nameEl) nameEl.textContent = `${structureId} + ${drugName}`;
    if (affinityEl) affinityEl.textContent = affinity !== null ? `${affinity} kcal/mol` : 'N/A';
    if (infoEl) infoEl.style.display = 'block';
  }

  // ---- Experimentos disponibles ----

  async loadAvailableExperiments(): Promise<void> {
    try {
      const resp = await fetch('/api/get-available-experiments/', {
        headers: { 'X-CSRFToken': this.csrfToken },
      });
      if (resp.ok) this.populateExperimentSelector((await resp.json()) as Array<{ key: string; estructura_id: string; drug_id: string }>);
    } catch (err) { console.error('Error cargando experimentos:', err); }
  }

  populateExperimentSelector(experiments: Array<{ key: string; estructura_id: string; drug_id: string }>): void {
    const sel = document.getElementById('experiment-selector') as HTMLSelectElement | null;
    if (!sel) return;
    sel.innerHTML = '<option value="">Seleccionar experimento...</option>';
    experiments.forEach((exp) => {
      const opt = document.createElement('option');
      opt.value = exp.key;
      opt.textContent = `${exp.estructura_id} + ${exp.drug_id}`;
      sel.appendChild(opt);
    });
  }

  // ---- Descarga ZIP ----

  downloadSelectedExperiment(): void {
    const sel = document.getElementById('experiment-selector') as HTMLSelectElement | null;
    if (!sel?.value) { alert('Selecciona un experimento primero.'); return; }
    const key = sel.value;
    if (key.startsWith('manual_')) { alert('Descarga no disponible para archivos manuales.'); return; }
    const link = document.createElement('a');
    link.href = `/api/download-experiment/${key}/`;
    link.download = `${key}_experiment.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ---- Archivos manuales ----

  loadManualFile(fileKey: string): void {
    const fileInfo = this.manualFiles.find((f) => f.key === fileKey);
    if (!fileInfo) { console.error('Archivo manual no encontrado:', fileKey); return; }
    const outputViewer = document.getElementById('output-viewer');
    if (!outputViewer) return;

    outputViewer.style.display = 'block';
    outputViewer.innerHTML = '';
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const bg = currentTheme === 'dark' ? 0x1a1f2e : 0xffffff;
    const viewer = window.$3Dmol.createViewer(window.$(outputViewer), { backgroundColor: bg });
    setTimeout(() => viewer?.resize(), 100);

    if (fileInfo.receptorFile || fileInfo.ligandFile) {
      if (fileInfo.receptorFile) {
        viewer.addModel(fileInfo.receptorFile.data, fileInfo.receptorFile.format);
        viewer.setStyle({ model: 0 }, { cartoon: { color: 'spectrum' } });
      }
      if (fileInfo.ligandFile) {
        const d = fileInfo.ligandFile.data.includes('MODEL')
          ? this.extractBestPose(fileInfo.ligandFile.data)
          : fileInfo.ligandFile.data;
        viewer.addModel(d, fileInfo.ligandFile.format);
        viewer.setStyle({ model: fileInfo.receptorFile ? 1 : 0 }, { stick: { radius: 0.25, colorscheme: 'greenCarbon' } });
      }
    } else if (fileInfo.data) {
      const d = fileInfo.isVinaOutput ? this.extractBestPose(fileInfo.data) : fileInfo.data;
      viewer.addModel(d, fileInfo.format ?? 'pdb');
      viewer.setStyle({}, fileInfo.isVinaOutput
        ? { stick: { radius: 0.25, colorscheme: 'greenCarbon' } }
        : { cartoon: { color: 'spectrum' } });
    }

    requestAnimationFrame(() => {
      viewer.zoomTo(); viewer.resize(); viewer.render();
      requestAnimationFrame(() => { viewer.resize(); viewer.zoom(1.2, 1000); });
    });
    window.current3DMolViewer = viewer;
  }
}

console.log('embedded_viewer.ts cargado.'); 