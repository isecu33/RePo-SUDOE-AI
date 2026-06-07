// utils.ts — Funciones de utilidad para la aplicación
import type { CompoundInfo, GeneInfo } from './types';

// Mapa de alias de iconos
const ICON_MAP: Record<string, string> = {
  check: 'check_box',
  success: 'check_box',
  ok: 'check_box',
  error: 'close',
  cancel: 'close',
  info: 'info',
  warning: 'info',
  search: 'search',
  download: 'download',
  save: 'save',
  settings: 'settings',
  config: 'settings',
  play: 'play',
  run: 'play',
  genetics: 'genetics',
  gene: 'genes',
  genes: 'genes',
  dna: 'genetics',
  mix: 'mix',
  pill: 'pill',
  drug: 'pill',
  lightbulb: 'lightbulb',
  idea: 'lightbulb',
  build: 'build_circle',
};

/**
 * Devuelve un icono como imagen inline HTML.
 * @param iconName - Nombre del icono (sin extensión .svg)
 * @param className - Clase CSS opcional
 * @param size - Tamaño en píxeles (por defecto 16)
 */
export function getIcon(iconName: string, className = '', size = 16): string {
  const iconFile = ICON_MAP[iconName.toLowerCase()] ?? iconName;
  const iconPath = `/static/frontend/img/icons/${iconFile}.svg`;
  const classAttr = className ? ` class="${className}"` : '';
  return `<img src="${iconPath}" alt="${iconName}" width="${size}" height="${size}"${classAttr} style="display: inline-block; vertical-align: text-bottom; margin-right: 4px;">`;
}

/** Atajo para uso común de iconos */
export function icon(iconName: string): string {
  return getIcon(iconName);
}

// Tipos auxiliares para UIUtils
interface VinaLogConfig {
  scoring?: string;
  receptor?: string;
  ligand?: string;
  center?: string;
  size?: string;
  spacing?: string;
  exhaustiveness?: string;
  cpu?: string;
  verbosity?: string;
}

export class UIUtils {
  /** Añade un mensaje al contenedor de chat */
  static addMessageToChat(message: string, sender: string, isError = false): void {
    const messagesContainer = document.getElementById('chat-messages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message ${isError ? 'error' : ''}`;

    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

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

  /** Formatea un campo de información con etiqueta y valor */
  static formatInfoField(label: string, value: string | null | undefined): string {
    if (!value || value === 'No disponible' || value === '') return '';
    return `
      <div style="margin-bottom: 0.75rem;">
        <strong style="color: var(--text-secondary); font-size: 0.85rem;">${label}:</strong>
        <div style="margin-top: 0.25rem; font-size: 0.9rem; line-height: 1.5;">${value}</div>
      </div>
    `;
  }

  /** Parsea el log de AutoDock Vina en formato legible */
  static parseVinaLog(logContent: string): string {
    const lines = logContent.split('\n');
    const config: VinaLogConfig = {};
    let filteredLog = '';
    let progressSection = '';
    let resultsSection = '';
    let inResults = false;
    let foundGrid = false;
    let foundProgress = false;

    for (const line of lines) {
      if (line.includes('Scoring function') && !config.scoring) {
        const match = line.match(/:\s*(\w+)/);
        if (match) config.scoring = match[1];
      }
      if (line.includes('Rigid receptor') && !config.receptor) {
        const match = line.match(/:\s*(\S+)/);
        if (match) config.receptor = match[1];
      }
      if (line.includes('Ligand') && !config.ligand) {
        const match = line.match(/:\s*(\S+)/);
        if (match) config.ligand = match[1];
      }
      if (line.includes('Grid center') && !config.center) {
        config.center = line.substring(line.indexOf(':') + 1).trim();
        foundGrid = true;
      }
      if (foundGrid && line.includes('Grid size')) {
        config.size = line.substring(line.indexOf(':') + 1).trim();
      }
      if (line.includes('Grid spacing') && !config.spacing) {
        const match = line.match(/:\s*([\d.]+)/);
        if (match) config.spacing = match[1];
      }
      if (line.includes('Exhaustiveness') && !config.exhaustiveness) {
        const match = line.match(/:\s*(\d+)/);
        if (match) config.exhaustiveness = match[1];
      }
      if (line.includes('CPU') && !config.cpu) {
        const match = line.match(/:\s*(\d+)/);
        if (match) config.cpu = match[1];
      }
      if (line.includes('Verbosity') && !config.verbosity) {
        const match = line.match(/:\s*(\d+)/);
        if (match) config.verbosity = match[1];
      }
      if (line.includes('Output') && line.includes('Binding')) {
        inResults = true;
        foundProgress = true;
      }
      if (inResults && line.trim() && !line.includes('Output')) {
        resultsSection += line + '\n';
      }
      if (foundProgress && !inResults && line.includes('-----')) {
        progressSection += line + '\n';
      }
    }

    filteredLog += `Scoring function : ${config.scoring ?? 'vina'}\n`;
    filteredLog += `Rigid receptor: ${config.receptor ?? '/receptor.pdbqt'}\n`;
    filteredLog += `Ligand: ${config.ligand ?? '/ligand.pdbqt'}\n`;
    filteredLog += `Grid center: ${config.center ?? 'X 41.03 Y 18.98 Z 14.03'}\n`;
    filteredLog += `Grid size  : ${config.size ?? 'X 20 Y 20 Z 20'}\n`;
    filteredLog += `Grid space : ${config.spacing ?? '0.375'}\n`;
    filteredLog += `Exhaustiveness: ${config.exhaustiveness ?? '8'}\n`;
    filteredLog += `CPU: ${config.cpu ?? '2'}\n`;
    filteredLog += `Verbosity: ${config.verbosity ?? '1'}\n\n`;
    filteredLog += progressSection;
    if (progressSection && !progressSection.endsWith('\n')) filteredLog += '\n';
    filteredLog += '\n';
    filteredLog += resultsSection;

    return filteredLog;
  }

  /** Formatea información de compuesto/gen como HTML */
  static formatCompoundInfo(info: {
    drug_info?: CompoundInfo;
    gene_info?: GeneInfo;
  }): string {
    let formatted = '';

    if (info.drug_info && Object.keys(info.drug_info).length > 0) {
      formatted += '<div style="margin: 0.5rem 0;"><strong>Drug Information:</strong><ul>';
      for (const [key, value] of Object.entries(info.drug_info)) {
        formatted += `<li>${key}: ${value}</li>`;
      }
      formatted += '</ul></div>';
    }

    if (info.gene_info && Object.keys(info.gene_info).length > 0) {
      formatted += '<div style="margin: 0.5rem 0;"><strong>Gene Information:</strong><ul>';
      for (const [key, value] of Object.entries(info.gene_info)) {
        formatted += `<li>${key}: ${value}</li>`;
      }
      formatted += '</ul></div>';
    }

    return formatted;
  }
}

console.log('utils.ts cargado.');
