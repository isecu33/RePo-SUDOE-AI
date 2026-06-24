# Frontend — RePo-SUDOE-AI

Guía técnica del frontend moderno basado en **Vite + TypeScript + Tailwind CSS**.

---

## ¿Por qué Vite + TypeScript + Tailwind?

El frontend original usaba JavaScript vanilla con jQuery. La modernización trae:

| Problema anterior | Solución |
|---|---|
| Sin tipado → bugs en runtime difíciles de detectar | TypeScript con strict mode |
| Bundle manual y lento | Vite: HMR instantáneo, build optimizado |
| CSS disperso y difícil de mantener | Tailwind CSS: utility-first, purga CSS no usado |
| Sin estructura de módulos | Módulos ES6 con imports explícitos |
| Sin EventBus → acoplamiento entre módulos | `EventBus` tipado para comunicación desacoplada |

---

## Estructura de `frontend/src/`

```
frontend/src/
├── main.ts              # Punto de entrada: inicializa todos los módulos
├── config.ts            # Constantes de configuración (timeouts, URLs, etc.)
├── event_bus.ts         # Bus de eventos tipado — comunicación entre módulos
├── chat.ts              # Módulo de chat con el asistente de IA
├── docking.ts           # Módulo de formulario y ejecución de docking
├── embedded_viewer.ts   # Visor molecular 3D (integración con NGL/3Dmol)
├── file_handler.ts      # Subida y validación de ficheros .pdbqt
├── navigation.ts        # Navegación entre secciones de la SPA
├── theme.ts             # Gestión del tema claro/oscuro
├── utils.ts             # Funciones de utilidad compartidas
├── styles/
│   └── main.css         # Directivas Tailwind + estilos globales
└── types/
    ├── chat.ts          # Interfaces del módulo de chat
    ├── docking.ts       # Interfaces del módulo de docking
    └── index.ts         # Re-exportaciones de tipos públicos
```

---

## Cómo añadir un nuevo módulo TypeScript

### 1. Crear el archivo del módulo

```typescript
// frontend/src/mi_modulo.ts

import { eventBus } from './event_bus';
import type { MiTipo } from './types/mi_modulo';

export class MiModulo {
  private state: MiTipo;

  constructor() {
    this.state = { /* valores iniciales */ };
    this.bindEvents();
  }

  private bindEvents(): void {
    // Suscribirse a eventos de otros módulos
    eventBus.on('docking:completed', (result) => {
      this.handleDockingResult(result);
    });

    // Vincular elementos del DOM
    const btn = document.getElementById('mi-boton');
    btn?.addEventListener('click', () => this.handleClick());
  }

  private handleClick(): void {
    // lógica
    eventBus.emit('mimodulo:accion', { dato: 'valor' });
  }

  private handleDockingResult(result: unknown): void {
    // reaccionar a evento
  }
}
```

### 2. Definir los tipos en `types/`

```typescript
// frontend/src/types/mi_modulo.ts

export interface MiTipo {
  campo: string;
  activo: boolean;
}
```

### 3. Registrar el tipo en `types/index.ts`

```typescript
// frontend/src/types/index.ts
export type { MiTipo } from './mi_modulo';
```

### 4. Inicializar en `main.ts`

```typescript
// frontend/src/main.ts
import { MiModulo } from './mi_modulo';

document.addEventListener('DOMContentLoaded', () => {
  // ...módulos existentes...
  new MiModulo();
});
```

---

## Convenciones de tipos

### Dónde van las interfaces

- **Tipos de dominio** (estructuras de datos): en `src/types/<modulo>.ts`
- **Tipos locales a un módulo** (solo usados dentro del módulo): inline en el mismo archivo, sin exportar
- **Tipos de respuesta HTTP**: en `src/types/api.ts` (crear si no existe)

### Ejemplo de tipado de respuesta HTTP

```typescript
// src/types/api.ts
export interface DockingJobResponse {
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  result?: DockingResult;
  error?: string;
}

export interface DockingResult {
  binding_affinity: number;
  output_files: string[];
  logs: string;
}
```

### Cómo usar el EventBus

El `EventBus` tipado garantiza que los eventos tienen el tipo correcto en el payload:

```typescript
// Emitir un evento
eventBus.emit('chat:message_sent', { text: 'Hola', timestamp: Date.now() });

// Escuchar un evento
eventBus.on('chat:message_sent', (payload) => {
  // payload está tipado automáticamente
  console.log(payload.text);
});

// Escuchar una vez (se desuscribe automáticamente)
eventBus.once('docking:completed', (result) => {
  showResults(result);
});
```

### Convención de nombres de eventos

```
<modulo>:<accion>
```

Ejemplos: `chat:message_sent`, `docking:started`, `docking:completed`, `viewer:loaded`, `theme:changed`

---

## Scripts disponibles

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo con HMR (Hot Module Replacement)
npm run dev

# Build de producción (genera dist/)
npm run build

# Verificación de tipos sin compilar
npm run type-check

# Linter (ESLint)
npm run lint

# Linter con corrección automática
npm run lint:fix
```

---

## Cómo integrar con Django templates

El frontend compila a archivos estáticos en `frontend/dist/`. Django los sirve mediante `collectstatic`.

### Proceso de build

```bash
# Compilar el frontend
cd frontend && npm run build

# Django recoge los estáticos
python manage.py collectstatic --noinput
```

### Incluir en un template Django

```html
{% load static %}
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="{% static 'frontend/dist/assets/main.css' %}">
</head>
<body>
  <!-- contenido -->
  <script type="module" src="{% static 'frontend/dist/assets/main.js' %}"></script>
</body>
</html>
```

### Pasar datos de Django al frontend

Para pasar datos del contexto Django al TypeScript, usa un script `<script>` en el template:

```html
<script>
  window.APP_CONFIG = {
    userId: {{ request.user.id|default:"null" }},
    csrfToken: "{{ csrf_token }}",
    apiBase: "{% url 'api:root' %}",
    debug: {{ debug|yesno:"true,false" }}
  };
</script>
```

Y en TypeScript, declara el tipo:

```typescript
// src/config.ts
declare global {
  interface Window {
    APP_CONFIG: {
      userId: number | null;
      csrfToken: string;
      apiBase: string;
      debug: boolean;
    };
  }
}
```

---

## Configuración de Vite (`vite.config.ts`)

```typescript
import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'src/main.ts'),
      output: {
        entryFileNames: 'assets/main.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
  server: {
    // Proxy de API calls a Django en desarrollo
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
})
```
