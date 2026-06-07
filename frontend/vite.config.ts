import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Directorio raíz del frontend (donde están src/ y este config)
  root: resolve(__dirname),

  build: {
    // Django sirve los estáticos desde frontend/static/frontend/
    outDir: resolve(__dirname, 'static/frontend/dist'),
    emptyOutDir: true,

    rollupOptions: {
      input: {
        // Entry point principal: carga todos los módulos TS
        main: resolve(__dirname, 'src/main.ts'),
      },
      output: {
        // Nombres de chunk predecibles para los {% static %} de Django
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'main.css';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },

    // Generar sourcemaps en desarrollo
    sourcemap: process.env.NODE_ENV !== 'production',
  },

  // En modo dev, el servidor de Vite proxea al Django dev server
  server: {
    port: 5173,
    proxy: {
      // Redirige todas las rutas no-asset al servidor Django
      '/api': 'http://localhost:8000',
      '/i18n': 'http://localhost:8000',
      '/accounts': 'http://localhost:8000',
      '/static': 'http://localhost:8000',
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
