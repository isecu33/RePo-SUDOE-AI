// File location: RePo-SUDOE-AI/frontend/static/frontend/js/theme.js
// Theme and language management

class ThemeManager {
    constructor(appInstance) {
        this.app = appInstance;
        this.currentTheme = localStorage.getItem('repo-sudoe-ai-theme') || 'light';
    }

    setupTheme() {
        this.setTheme(this.currentTheme);

        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        this.setupLanguageToggle();
    }

    setupLanguageToggle() {
        const languageToggle = document.getElementById('language-toggle');
        if (languageToggle) {
            // Initialize button text with current language
            const currentLang = getCurrentLanguage();
            languageToggle.textContent = currentLang.toUpperCase();
            console.log(icon('info') + ` Language button initialized to: ${currentLang.toUpperCase()}`);

            languageToggle.addEventListener('click', () => {
                const currentLang = getCurrentLanguage();
                const newLang = currentLang === 'es' ? 'en' : 'es';
                this.setLanguage(newLang);
            });
        }
    }

    setLanguage(lang) {
        console.log(icon('info') + ` Switching language to: ${lang}`);

        // Get CSRF token
        const csrfToken = window.csrfToken ||
                         document.querySelector('[name=csrfmiddlewaretoken]')?.value ||
                         document.querySelector('meta[name="csrf-token"]')?.content ||
                         '';

        if (!csrfToken) {
            console.error(icon('error') + ' CSRF token not found!');
            return;
        }

        const form = document.createElement('form');
        form.method = 'POST';
        form.action = '/i18n/setlang/';

        const languageInput = document.createElement('input');
        languageInput.type = 'hidden';
        languageInput.name = 'language';
        languageInput.value = lang;
        form.appendChild(languageInput);

        const csrfInput = document.createElement('input');
        csrfInput.type = 'hidden';
        csrfInput.name = 'csrfmiddlewaretoken';
        csrfInput.value = csrfToken;
        form.appendChild(csrfInput);

        const nextInput = document.createElement('input');
        nextInput.type = 'hidden';
        nextInput.name = 'next';
        nextInput.value = window.location.pathname;
        form.appendChild(nextInput);

        document.body.appendChild(form);
        form.submit();
    }

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('repo-sudoe-ai-theme', theme);
        this.currentTheme = theme;
        this.updateViewerBackgrounds(theme);
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
        this.updateThemeToggleIcon(newTheme);
        console.log(`RePo-SUDOE-AI theme switched to: ${newTheme}`);
    }

    updateThemeToggleIcon(theme) {
        const themeToggle = document.querySelector('.theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('img');
            if (icon) {
                icon.style.transform = theme === 'dark' ? 'rotate(180deg)' : 'rotate(0deg)';
            }
        }
    }

    updateViewerBackgrounds(theme) {
        const backgroundColor = theme === 'dark' ? 0x1a1f2e : 0xffffff;

        console.log(`Updating viewer backgrounds to ${backgroundColor.toString(16)} for theme: ${theme}`);

        // Update manual viewer (preview)
        if (window.current3DMolViewer) {
            window.current3DMolViewer.setBackgroundColor(backgroundColor);
            window.current3DMolViewer.render();
            console.log('✅ Manual viewer background updated');
        }

        // Update output viewer if it exists in ViewerManager
        if (window.app && window.app.viewerManager && window.app.viewerManager.enhancedViewer) {
            window.app.viewerManager.enhancedViewer.setBackgroundColor(backgroundColor);
            window.app.viewerManager.enhancedViewer.render();
            console.log('✅ Output viewer background updated');
        }

        if (window.$3Dmol) {
            Object.keys(window.$3Dmol.glViewer || {}).forEach(key => {
                const viewer = window.$3Dmol.glViewer[key];
                if (viewer && viewer.setBackgroundColor) {
                    const color = theme === 'dark' ? 0x1a1f2e : 0xffffff;
                    viewer.setBackgroundColor(color);
                    viewer.render();
                }
            });
        }
    }
}

console.log(icon('success') + ' theme.js loaded');
