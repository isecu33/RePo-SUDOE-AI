// navigation.ts — Gestión de navegación y secciones
import { icon } from './utils';
import type { RePoSUDOEAI } from './main';

export class NavigationManager {
  private app: RePoSUDOEAI;

  constructor(appInstance: RePoSUDOEAI) {
    this.app = appInstance;
  }

  setupNavigation(): void {
    const navLinks = document.querySelectorAll<HTMLAnchorElement>('.nav-link');
    console.log(icon('info') + ' Configurando navegación con', navLinks.length, 'enlaces');

    if (navLinks.length === 0) {
      console.warn(icon('warning') + ' No se encontraron enlaces de navegación');
      return;
    }

    const handleHashNavigation = (): void => {
      const hash = window.location.hash.substring(1) || 'chat';
      console.log(icon('info') + ' Navegación por hash a:', hash);
      this.showSection(hash);

      navLinks.forEach((link) => {
        if (link.getAttribute('data-section') === hash) {
          this.updateActiveNav(link);
        }
      });
    };

    window.addEventListener('hashchange', handleHashNavigation);
    handleHashNavigation();

    navLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const targetId = link.getAttribute('data-section');
        if (targetId) window.location.hash = targetId;
      });
    });

    console.log(icon('success') + ' Navegación configurada.');
  }

  showSection(sectionId: string): void {
    console.log(icon('info') + ` showSection: "${sectionId}"`);
    const allSections = document.querySelectorAll<HTMLElement>('.section');

    allSections.forEach((section) => {
      section.classList.remove('active');
    });

    const target = document.getElementById(sectionId);
    if (target) {
      target.classList.add('active');
    } else {
      console.warn(icon('error') + ` Sección "${sectionId}" no encontrada.`);
    }
  }

  updateActiveNav(activeLink: HTMLAnchorElement): void {
    document.querySelectorAll<HTMLAnchorElement>('.nav-link').forEach((link) => {
      link.classList.remove('active');
    });
    activeLink.classList.add('active');
  }
}

console.log(icon('success') + ' navigation.ts cargado.');
