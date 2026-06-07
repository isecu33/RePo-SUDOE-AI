/** @type {import('tailwindcss').Config} */
export default {
  // Escanea templates Django y fuentes TS para detectar clases utilizadas
  content: [
    '../templates/**/*.html',
    '../frontend/templates/**/*.html',
    '../accounts/templates/**/*.html',
    './src/**/*.ts',
  ],

  // Desactiva el preflight parcialmente para convivir con estilos legados
  // (las variables CSS :root de Django templates siguen funcionando)
  corePlugins: {
    preflight: true,
  },

  // Permite activar dark mode mediante data-theme="dark" en el HTML
  darkMode: ['selector', '[data-theme="dark"]'],

  theme: {
    extend: {
      colors: {
        // Paleta de marca RePo-SUDOE-AI
        accent: {
          DEFAULT: '#eb5e0d',
          hover: '#c04309',
        },
        brand: {
          dark: '#2c3e50',
          muted: '#6c757d',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
      },
      spacing: {
        // Alturas fijas del layout
        header: 'auto',
        footer: '58px',
      },
      boxShadow: {
        card: '0 2px 10px rgba(0,0,0,0.1)',
        'card-dark': '0 2px 10px rgba(0,0,0,0.4)',
        header: '0 4px 20px rgba(0,0,0,0.1)',
      },
      borderRadius: {
        DEFAULT: '0.375rem',
      },
      zIndex: {
        header: '1000',
        modal: '2000',
        tooltip: '3000',
      },
    },
  },

  plugins: [],
};
