// ============================================================
// Tipos e interfaces globales de RePo-SUDOE-AI
// ============================================================

// ------ Idioma / traducciones ------
export type Language = 'es' | 'en';
export type TranslationKey = string;

export interface TranslationMap {
  [key: string]: string;
}

export interface Translations {
  es: TranslationMap;
  en: TranslationMap;
}

// ------ Archivos cargados en modo manual ------
export type UploadType = 'receptor' | 'drug' | 'pose';
export type MoleculeFormat = 'pdb' | 'pdbqt' | 'sdf' | 'mol2' | 'xyz' | 'unknown';

export interface LoadedFile {
  type: UploadType;
  filename: string;
  format: MoleculeFormat;
  data: string;
}

export interface UploadedFiles {
  receptor: LoadedFile | null;
  drug: LoadedFile | null;
  pose: LoadedFile | null;
}

// ------ Respuestas de la API ------
export interface ChatRequest {
  message: string;
  session_id: string | null;
  language: Language;
  [key: string]: unknown;
}

export interface ChatResponse {
  response?: string;
  message?: string;
  session_id?: string;
  error?: string;
  status?: string;
  action?: string;
  /** Whether the request succeeded (false means failure) */
  success?: boolean;
  /** Response type discriminator used by the chat router */
  type?: string;
  // Respuestas estructuradas del agente
  drug_info?: CompoundInfo;
  gene_info?: GeneInfo;
  docking_result?: DockingResult;
  available_structures?: ProteinStructure[];
  selected_structure?: string;
  vina_config?: VinaConfig;
}

// ------ Información de compuestos / genes ------
export interface CompoundInfo {
  name?: string;
  molecular_formula?: string;
  molecular_weight?: string | number;
  smiles?: string;
  description?: string;
  indications?: string;
  status?: string;
  [key: string]: unknown;
}

export interface GeneInfo {
  gene_name?: string;
  hgnc_symbol?: string;
  full_name?: string;
  function_info?: string;
  disease?: string;
  pathway?: string;
  associated_diseases?: string;
  molecular_pathways?: string;
  [key: string]: unknown;
}

// ------ Docking ------
export interface DockingResult {
  experiment_id?: string;
  drug?: string;
  gene?: string;
  structure?: string;
  binding_affinity?: number | string;
  affinity_classification?: string;
  log_content?: string;
  output_file?: string;
  error?: string;
  cached?: boolean;
}

export interface VinaConfig {
  box_center_x?: number;
  box_center_y?: number;
  box_center_z?: number;
  box_size_x?: number;
  box_size_y?: number;
  box_size_z?: number;
  exhaustiveness?: number;
  num_cpus?: number;
  verbosity?: number;
  seed?: number;
  scoring?: 'vina' | 'ad4';
  skip_preprocessing?: boolean;
  use_box_enveloping?: boolean;
  padding?: number;
}

export interface BoxConfig {
  center_x: number;
  center_y: number;
  center_z: number;
  size_x: number;
  size_y: number;
  size_z: number;
}

// ------ Experimentos ------
export interface Experiment {
  id: string;
  name?: string;
  drug?: string;
  gene?: string;
  structure?: string;
  binding_affinity?: number | string;
  created_at?: string;
  status?: string;
}

// ------ Proteínas / estructuras ------
export interface ProteinStructure {
  id: string;
  name?: string;
  pdb_id?: string;
  description?: string;
}

// ------ EventBus ------
export type EventCallback<T = unknown> = (data: T) => void;

export interface FileLoadedEvent {
  type: UploadType;
  filename: string;
  format: MoleculeFormat;
  loadedFiles: LoadedFile[];
}

export interface ExperimentSelectedEvent {
  experimentId: string;
}

// ------ 3Dmol (tipado mínimo para el viewer externo) ------
declare global {
  interface Window {
    $3Dmol: ThreeDMol;
    EventBus: import('../event_bus').EventBus;
    getCurrentLanguage: () => Language;
    t: (key: TranslationKey) => string;
    translations: Translations;
    csrfToken: string;
    app: import('../main').RePoSUDOEAI;
  }
}

export interface ThreeDMolViewer {
  addModel(data: string, format: string): ThreeDMolModel;
  setStyle(sel: object, style: object): void;
  zoomTo(): void;
  render(): void;
  clear(): void;
  zoom(factor: number, animationDuration?: number): void;
  rotate(angle: number, axis: string, animationDuration?: number): void;
  removeAllModels(): void;
  removeAllShapes(): void;
  addBox(spec: object): void;
  getModel(id?: number): ThreeDMolModel;
  resize(): void;
  setSlab(near: number, far: number): void;
}

export interface ThreeDMolModel {
  setStyle(sel: object, style: object): void;
  setColorByElement(sel: object, colors: object): void;
}

export interface ThreeDMol {
  createViewer(element: HTMLElement | string, config?: object): ThreeDMolViewer;
  download(query: string, format: string, options: object, viewer: ThreeDMolViewer): void;
  SurfaceType: { VDW: number; MS: number; SAS: number; SES: number };
}
