// theme.ts — Gestión de tema (claro/oscuro) e idioma
import { getCurrentLanguage } from './config';
import { icon } from './utils';
import type { RePoSUDOEAI } from './main';

type Theme = 'light' | 'dark';

export class ThemeManager {
  private app: RePoSUDOEAI;
  private currentTheme: Theme;

  constructor(appInstance: RePoSUDOEAI) {
    this.app = appInstance;
    const stored = localStorage.getItem('repo-sudoe-ai-theme');
    this.currentTheme = (stored === 'dark' || stored === 'light') ? stored : 'light';
  }

  setupTheme(): void {
    this.setTheme(this.currentTheme);

    const themeToggle = document.querySelector<HTMLButtonElement>('.theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }

    this.setupLanguageToggle();
  }

  setupLanguageToggle(): void {
    const languageToggle = document.getElementById('language-toggle') as HTMLButtonElement | null;
    if (languageToggle) {
      const currentLang = getCurrentLanguage();
      languageToggle.textContent = currentLang.toUpperCase();
      console.log(icon('info') + ` Botón de idioma inicializado: ${currentLang.toUpperCase()}`);

      languageToggle.addEventListener('click', () => {
        const lang = getCurrentLanguage();
        const newLang = lang === 'es' ? 'en' : 'es';
        this.setLanguage(newLang);
      });
    }
  }

  setLanguage(lang: string): void {
    console.log(icon('info') + ` Cambiando idioma a: ${lang}`);

    const csrfToken =
      window.csrfToken ||
      document.querySelector<HTMLInputElement>('[name=csrfmiddlewaretoken]')?.value ||
      document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ||
      '';

    if (!csrfToken) {
      console.error(icon('error') + ' CSRF token no encontrado!');
      return;
    }

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = '/i18n/setlang/';

    const addHidden = (name: string, value: string): void => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };

    addHidden('language', lang);
    addHidden('csrfmiddlewaretoken', csrfToken);
    addHidden('next', window.location.pathname);

    document.body.appendChild(form);
    form.submit();
  }

  setTheme(theme: Theme): void {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('repo-sudoe-ai-theme', theme);
    this.currentTheme = theme;
  }

  toggleTheme(): void {
    const newTheme: Theme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
    console.log(icon('info') + ` Tema cambiado a: ${newTheme}`);
  }

  getCurrentTheme(): Theme {
    return this.currentTheme;
  }
}

console.log(icon('success') + ' theme.ts cargado.');
