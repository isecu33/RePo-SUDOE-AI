// File location: RePo-SUDOE-AI/frontend/static/frontend/js/navigation.js
// Navigation and section management

class NavigationManager {
    constructor(appInstance) {
        this.app = appInstance;
    }

    setupNavigation() {
        const navLinks = document.querySelectorAll('.nav-link');
        console.log(icon('info') + ' Setting up navigation with', navLinks.length, 'nav links');

        if (navLinks.length === 0) {
            console.warn(icon('warning') + ' No navigation links found');
            return;
        }

        const handleHashNavigation = () => {
            const hash = window.location.hash.substring(1) || 'chat';
            console.log(icon('info') + ' Hash navigation to:', hash);
            this.showSection(hash);
            
            navLinks.forEach(link => {
                const section = link.getAttribute('data-section');
                if (section === hash) {
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
                window.location.hash = targetId;
            });
        });

        console.log(icon('success') + ' Navigation setup complete');
    }

    showSection(sectionId) {
        console.log(icon('info') + ` showSection called with sectionId: "${sectionId}"`);

        const allSections = document.querySelectorAll('.section');
        console.log(`   Found ${allSections.length} sections total`);

        allSections.forEach(section => {
            if (section.classList.contains('active')) {
                console.log(`   Hiding section: ${section.id}`);
            }
            section.classList.remove('active');
        });

        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            console.log(`   Showing target section: ${sectionId}`);
            targetSection.classList.add('active');
        } else {
            console.warn(icon('error') + ` Target section with id "${sectionId}" not found!`);
        }
    }

    updateActiveNav(activeLink) {
        const allLinks = document.querySelectorAll('.nav-link');
        allLinks.forEach(link => {
            link.classList.remove('active');
        });
        activeLink.classList.add('active');
        console.log(`   Updated active nav link`);
    }
}

console.log(icon('success') + ' navigation.js loaded');
