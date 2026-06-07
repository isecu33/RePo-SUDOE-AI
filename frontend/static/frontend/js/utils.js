// File location: RePo-SUDOE-AI/frontend/static/frontend/js/utils.js
// Utility functions for the application

/**
 * Loads and returns an icon as inline SVG
 * @param {string} iconName - Name of the icon file (without .svg extension)
 * @param {string} className - Optional CSS class to add to the icon
 * @param {number} size - Optional size in pixels (default: 16)
 * @returns {string} HTML string with the icon
 */
function getIcon(iconName, className = '', size = 16) {
    const iconMap = {
        'check': 'check_box',
        'success': 'check_box',
        'ok': 'check_box',
        'error': 'close',
        'cancel': 'close',
        'info': 'info',
        'warning': 'info',
        'search': 'search',
        'download': 'download',
        'save': 'save',
        'settings': 'settings',
        'config': 'settings',
        'play': 'play',
        'run': 'play',
        'genetics': 'genetics',
        'gene': 'genes',
        'genes': 'genes',
        'dna': 'genetics',
        'mix': 'mix',
        'pill': 'pill',
        'drug': 'pill',
        'lightbulb': 'lightbulb',
        'idea': 'lightbulb',
        'build': 'build_circle'
    };

    const iconFile = iconMap[iconName.toLowerCase()] || iconName;
    const iconPath = `/static/frontend/img/icons/${iconFile}.svg`;
    const classAttr = className ? ` class="${className}"` : '';

    return `<img src="${iconPath}" alt="${iconName}" width="${size}" height="${size}"${classAttr} style="display: inline-block; vertical-align: text-bottom; margin-right: 4px;">`;
}

/**
 * Shorthand function for common icon usage
 * @param {string} iconName - Name of the icon
 * @returns {string} HTML string with the icon
 */
function icon(iconName) {
    return getIcon(iconName);
}

class UIUtils {
    static addMessageToChat(message, sender, isError = false) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message ${isError ? 'error' : ''}`;
        
        const timestamp = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
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

    static formatInfoField(label, value) {
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

    static parseVinaLog(logContent) {
        const lines = logContent.split('\n');
        let filteredLog = '';
        let config = {};
        let inConfig = false;
        let progressSection = '';
        let resultsSection = '';
        let inResults = false;
        let foundGrid = false;
        let foundProgress = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
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

    static formatCompoundInfo(info) {
        let formatted = '';

        if (info.drug_info && Object.keys(info.drug_info).length > 0) {
            formatted += '<div style="margin: 0.5rem 0;"><strong>Drug Information:</strong><ul>';
            Object.entries(info.drug_info).forEach(([key, value]) => {
                formatted += `<li>${key}: ${value}</li>`;
            });
            formatted += '</ul></div>';
        }

        if (info.gene_info && Object.keys(info.gene_info).length > 0) {
            formatted += '<div style="margin: 0.5rem 0;"><strong>Gene Information:</strong><ul>';
            Object.entries(info.gene_info).forEach(([key, value]) => {
                formatted += `<li>${key}: ${value}</li>`;
            });
            formatted += '</ul></div>';
        }

        return formatted;
    }
}

console.log(icon('success') + ' utils.js loaded');
