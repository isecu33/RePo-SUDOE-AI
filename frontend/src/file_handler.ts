// file_handler.ts — Gestión de archivos y preview para Modo Manual
import { icon } from './utils';
import type { EventBus } from './event_bus';
import type {
  UploadType,
  MoleculeFormat,
  LoadedFile,
  UploadedFiles,
  FileLoadedEvent,
} from './types';

interface ServerUploadedFile {
  filename: string;
  file_path: string | null;
  success: boolean;
  error?: string;
}

type ServerUploadedFiles = Record<UploadType, ServerUploadedFile | null>;

const FILE_TYPE_COLORS: Record<UploadType, string> = {
  receptor: 'spectrum',
  drug: 'darkorange',
  pose: 'lime',
};

const FILE_TYPE_DISPLAY: Record<UploadType, string> = {
  receptor: 'Receptor',
  drug: 'Drug',
  pose: 'Pose',
};

const FORMAT_MAP: Record<string, MoleculeFormat> = {
  pdbqt: 'pdbqt',
  pdb: 'pdb',
  sdf: 'sdf',
  mol2: 'mol2',
  xyz: 'xyz',
};

export class FileManager {
  private eventBus: EventBus;
  private csrfToken: string;
  private uploadedFiles: ServerUploadedFiles = { receptor: null, drug: null, pose: null };
  private loadedFiles: LoadedFile[] = [];

  constructor(eventBus: EventBus, csrfToken: string) {
    this.eventBus = eventBus;
    this.csrfToken = csrfToken;
  }

  init(): void {
    this.setupFileUpload();
    this.setupChangeButtons();
  }

  // ---- Configuración de uploads ----

  setupFileUpload(): void {
    console.log('Configurando upload unificado de archivos');
    const fileInputs = document.querySelectorAll<HTMLInputElement>('.file-input');

    fileInputs.forEach((input) => {
      input.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0];
        if (!file) return;

        const uploadType = target.id.split('-')[0] as UploadType;
        this.handleFileSelected(uploadType, file);
      });
    });

    // Handlers de tarjetas de upload (click + drag & drop)
    document.querySelectorAll<HTMLElement>('.upload-card').forEach((card) => {
      const uploadType = card.getAttribute('data-upload') as UploadType | null;
      if (!uploadType) return;
      const fileInput = document.getElementById(`${uploadType}-file`) as HTMLInputElement | null;
      if (!fileInput) return;

      card.addEventListener('click', () => fileInput.click());

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        card.classList.add('dragover');
      });
      card.addEventListener('dragleave', () => card.classList.remove('dragover'));
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('dragover');
        const dt = (e as DragEvent).dataTransfer;
        if (dt?.files.length) {
          fileInput.files = dt.files;
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      });
    });
  }

  private handleFileSelected(uploadType: UploadType, file: File): void {
    const previewFilename = document.getElementById(`${uploadType}-filename`);
    const uploadCard = document.querySelector<HTMLElement>(`[data-upload="${uploadType}"]`);
    const changeButton = document.getElementById(`change-${uploadType}`) as HTMLElement | null;

    if (!previewFilename) {
      console.error(`Elemento de filename no encontrado para ${uploadType}`);
      return;
    }

    if (uploadCard) uploadCard.style.display = 'none';

    // Actualizar nombre de archivo mostrado
    const filenameTextSpan = previewFilename.querySelector<HTMLElement>('.filename-text');
    if (filenameTextSpan) {
      filenameTextSpan.textContent = file.name;
    } else {
      previewFilename.textContent = `${FILE_TYPE_DISPLAY[uploadType]}: ${file.name}`;
    }
    previewFilename.style.display = 'inline-block';
    previewFilename.style.fontWeight = '600';
    previewFilename.style.color = 'var(--text-primary)';

    if (changeButton) changeButton.style.display = 'inline-block';

    // Leer contenido del archivo
    const reader = new FileReader();
    reader.onload = (e) => {
      const fileData = e.target?.result as string;
      if (!fileData) return;

      const format = this.detectFileFormat(file.name);
      this.storeFileForUnifiedPreview(uploadType, fileData, format, file.name);

      const payload: FileLoadedEvent = {
        type: uploadType,
        filename: file.name,
        format,
        loadedFiles: this.loadedFiles,
      };
      this.eventBus.emit<FileLoadedEvent>('fileLoaded', payload);

      // Auto-calcular centro del receptor PDB
      if (uploadType === 'receptor' && format === 'pdb') {
        const center = FileManager.calculatePdbCenter(fileData);
        if (center) {
          const setVal = (id: string, val: number) => {
            const el = document.getElementById(id) as HTMLInputElement | null;
            if (el) el.value = String(val);
          };
          setVal('box-center-x', center[0]);
          setVal('box-center-y', center[1]);
          setVal('box-center-z', center[2]);
          console.log('Centro de masa del receptor calculado:', center);
        }
      }
    };
    reader.onerror = (err) => console.error('Error leyendo archivo:', err);
    reader.readAsText(file);

    // Subir al servidor para el docking
    void this.uploadFileToServer(uploadType, file);
  }

  // ---- Detección de formato ----

  detectFileFormat(filename: string): MoleculeFormat {
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    return FORMAT_MAP[ext] ?? 'pdb';
  }

  // ---- Botones "Cambiar archivo" ----

  setupChangeButtons(): void {
    const fileTypes: UploadType[] = ['receptor', 'drug', 'pose'];
    fileTypes.forEach((type) => {
      const btn = document.getElementById(`change-${type}`);
      if (btn) btn.addEventListener('click', () => this.showUploadZone(type));
    });
  }

  showUploadZone(fileType: UploadType): void {
    const uploadCard = document.querySelector<HTMLElement>(`[data-upload="${fileType}"]`);
    const filenameElement = document.getElementById(`${fileType}-filename`);
    const changeButton = document.getElementById(`change-${fileType}`) as HTMLElement | null;
    const fileInput = document.getElementById(`${fileType}-file`) as HTMLInputElement | null;

    if (uploadCard) {
      uploadCard.style.display = 'block';
      uploadCard.classList.remove('success', 'error', 'uploading');
    }
    if (filenameElement) {
      filenameElement.style.display = 'none';
      const span = filenameElement.querySelector<HTMLElement>('.filename-text');
      if (span) span.textContent = '';
      else filenameElement.textContent = '';
      filenameElement.style.fontWeight = 'normal';
      filenameElement.style.color = 'var(--text-secondary)';
    }
    if (changeButton) changeButton.style.display = 'none';
    if (fileInput) fileInput.value = '';

    this.loadedFiles = this.loadedFiles.filter((f) => f.type !== fileType);
    this.uploadedFiles[fileType] = null;

    this.eventBus.emit('fileRemoved', { type: fileType, loadedFiles: this.loadedFiles });
    this.eventBus.emit('dockingFilesChanged', this.uploadedFiles);
  }

  // ---- Preview unificado ----

  private storeFileForUnifiedPreview(
    uploadType: UploadType,
    fileData: string,
    format: MoleculeFormat,
    filename: string,
  ): void {
    const fileInfo: LoadedFile & { color: string } = {
      type: uploadType,
      data: fileData,
      format,
      filename,
      color: FILE_TYPE_COLORS[uploadType],
    };

    const existingIdx = this.loadedFiles.findIndex((f) => f.type === uploadType);
    if (existingIdx >= 0) {
      this.loadedFiles[existingIdx] = fileInfo;
    } else {
      this.loadedFiles.push(fileInfo);
    }
  }

  // ---- Subida al servidor ----

  private async uploadFileToServer(uploadType: UploadType, file: File): Promise<void> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('file_type', uploadType);

      const response = await fetch('/api/upload/', {
        method: 'POST',
        headers: { 'X-CSRFToken': this.csrfToken },
        body: formData,
      });

      const result = (await response.json()) as { success: boolean; file_path?: string; error?: string };

      if (result.success) {
        this.uploadedFiles[uploadType] = {
          filename: file.name,
          file_path: result.file_path ?? null,
          success: true,
        };
        console.log(icon('success') + ` ${uploadType} subido: ${result.file_path ?? ''}`);
        this.eventBus.emit('fileUploaded', { type: uploadType, success: true, uploadedFiles: this.uploadedFiles });
      } else {
        this.uploadedFiles[uploadType] = { filename: file.name, file_path: null, success: false, error: result.error };
        this.eventBus.emit('fileUploadError', { type: uploadType, error: result.error });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.uploadedFiles[uploadType] = { filename: file.name, file_path: null, success: false, error: msg };
      this.eventBus.emit('fileUploadError', { type: uploadType, error: msg });
    }
  }

  // ---- Getters ----

  getUploadedFiles(): ServerUploadedFiles {
    return this.uploadedFiles;
  }

  getLoadedFiles(): LoadedFile[] {
    return this.loadedFiles;
  }

  clearAllFiles(): void {
    this.uploadedFiles = { receptor: null, drug: null, pose: null };
    this.loadedFiles = [];
    this.eventBus.emit('allFilesCleared');
  }

  // ---- Utilidades estáticas ----

  /**
   * Calcula el centro de masa de un archivo PDB parseando columnas fijas del formato.
   * @returns [x, y, z] redondeado a 2 decimales, o null si no hay átomos.
   */
  static calculatePdbCenter(pdbText: string): [number, number, number] | null {
    let sumX = 0, sumY = 0, sumZ = 0, count = 0;
    for (const line of pdbText.split('\n')) {
      if (line.startsWith('ATOM')) {
        const x = parseFloat(line.substring(30, 38));
        const y = parseFloat(line.substring(38, 46));
        const z = parseFloat(line.substring(46, 54));
        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
          sumX += x; sumY += y; sumZ += z; count++;
        }
      }
    }
    if (count === 0) return null;
    const r = (v: number) => Math.round((v / count) * 100) / 100;
    return [r(sumX), r(sumY), r(sumZ)];
  }
}

/** Descarga un archivo del servidor por su ruta */
export function downloadFile(filePath: string, fileName?: string): void {
  const actualFileName = fileName ?? filePath.split(/[/\\]/).pop() ?? 'download';
  const link = document.createElement('a');
  link.href = `/download/output/${actualFileName}`;
  link.download = actualFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
