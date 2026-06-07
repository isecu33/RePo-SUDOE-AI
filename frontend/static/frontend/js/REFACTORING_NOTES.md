// File location: RePo-SUDOE-AI/frontend/static/frontend/js/REFACTORING_NOTES.md
# Refactoring de repo-sudoe-ai.js - Modular Architecture

## Overview
El archivo monolítico `repo-sudoe-ai.js` (2571 líneas) ha sido refactorizado en 7 archivos especializados para mejorar la mantenibilidad y la gestión de errores.

## Estructura de Módulos

```
Frontend Static Files:
├── js/
│   ├── event_bus.js                [EXISTING] Comunicación entre módulos
│   ├── file_handler.js             [EXISTING] Gestión de carga de archivos
│   ├── embedded_viewer.js          [EXISTING] Viewer 3D (3Dmol.js wrapper)
│   │
│   ├── config.js                   [NEW] Configuración global y traducciones
│   ├── navigation.js               [NEW] Gestión de navegación y secciones
│   ├── theme.js                    [NEW] Tema y lenguaje
│   ├── utils.js                    [NEW] Utilidades UI y parsing
│   ├── chat.js                     [NEW] Gestor de chat y respuestas
│   ├── docking.js                  [NEW] Docking y configuración Vina
│   ├── main.js                     [NEW] Clase orquestadora RePoSUDOEAI
│   │
│   └── repo-sudoe-ai.js            [DEPRECATED] Archivo original (backup)
```

## Estructura de Carga en index.html

```javascript
<!-- Load order CRITICAL -->
1. event_bus.js        → Sistema de eventos
2. config.js           → Traducciones y funciones i18n
3. file_handler.js     → Gestor de archivos (existente)
4. embedded_viewer.js  → Visor 3D (existente)
5. navigation.js       → Gestor de navegación
6. theme.js            → Gestor de tema y lenguaje
7. utils.js            → Utilidades
8. chat.js             → Gestor de chat
9. docking.js          → Gestor de docking
10. main.js            → Orquestador principal
```

## Descripción de Módulos

### 1. config.js (~250 líneas)
**Responsabilidad:** Configuración global y traducciones

**Contenido:**
- Objeto `translations` con claves en español e inglés
- `getCurrentLanguage()` - detecta idioma de cookie/meta tag
- `t(key)` - función de traducción

**Dependencias:** Ninguna
**Usuario:** Todos los módulos

```javascript
// Ejemplo de uso
const greeting = t('chatTitle');  // "Chat" en idioma actual
```

---

### 2. navigation.js (~75 líneas)
**Responsabilidad:** Enrutamiento hash y gestión de secciones

**Contenido:**
- Clase `NavigationManager` con:
  - `setupNavigation()` - configura listeners hash
  - `showSection(id)` - muestra/oculta secciones
  - `updateActiveNav()` - actualiza estilos de nav links

**Dependencias:** config.js, appInstance
**Usuario:** main.js inicializa en init()

```javascript
// Ejemplo de uso
this.navigationManager = new NavigationManager(this);
this.navigationManager.setupNavigation();
this.navigationManager.showSection('manual');  // Muestra section#manual
```

---

### 3. theme.js (~150 líneas)
**Responsabilidad:** Tema oscuro/claro e idioma

**Contenido:**
- Clase `ThemeManager` con:
  - `setupTheme()` - configura listeners
  - `setTheme(theme)` - cambia tema (light/dark)
  - `toggleTheme()` - alterna tema actual
  - `updateViewerBackgrounds()` - actualiza colores 3Dmol
  - `setLanguage(lang)` - cambia idioma vía Django

**Dependencias:** config.js, appInstance
**Usuario:** main.js, event handlers

```javascript
// Ejemplo de uso
this.themeManager = new ThemeManager(this);
this.themeManager.setupTheme();
this.themeManager.toggleTheme();  // Alterna light/dark
```

---

### 4. utils.js (~180 líneas)
**Responsabilidad:** Funciones de utilidad reutilizables

**Contenido:**
- Clase `UIUtils` (static) con:
  - `addMessageToChat(message, sender, isError)` - añade mensaje al chat
  - `parseVinaLog(logContent)` - parsea logs de AutoDock Vina
  - `formatInfoField(label, value)` - formatea fields de información
  - `formatCompoundInfo(data)` - formatea info de compuestos

**Dependencias:** DOM, ninguna clase
**Usuario:** Chat.js, main.js, docking.js

```javascript
// Ejemplo de uso
UIUtils.addMessageToChat('Hola mundo', 'assistant');
UIUtils.formatInfoField('Afinidad', '-8.5 kcal/mol');
```

---

### 5. chat.js (~500 líneas)
**Responsabilidad:** Gestor de chat y manejo de respuestas

**Contenido:**
- Clase `ChatManager` con:
  - `setupChat()` - configura listeners de input
  - `sendMessage(message)` - POST a /api/chat/
  - `handleChatResponse(result, originalMessage)` - enruta por tipo
    - `handleValidationError(data)` - errores de validación
    - `handleConfirmationRequest(data)` - confirmación de acciones
    - `handleStructureSelection(data)` - selección de estructuras
    - `handleModeSelection(data)` - selección de modo
    - `handleAdvancedConfiguration(data)` - panel de configuración Vina
    - `handleManualDownload(data)` - descarga de archivos
  - `setupVinaConfigListeners()` - listeners para botones radio Vina
  - `collectVinaConfiguration()` - recopila configuración de formulario

**Dependencias:** UIUtils, config.js, appInstance
**Usuario:** main.js, event handlers de UI

```javascript
// Ejemplo de uso
this.chatManager = new ChatManager(this);
this.chatManager.setupChat();
await this.chatManager.sendMessage('Docking entre X y Y');
```

---

### 6. docking.js (~300 líneas)
**Responsabilidad:** Configuración y ejecución de docking

**Contenido:**
- Clase `DockingManager` con:
  - `setupDocking()` - configura botón de docking
  - `setupBoxEnveloping()` - interfaz de caja personalizada
  - `setupExecutionParameters()` - interfaz de parámetros Vina
  - `getManualBoxParameters()` - recopila parámetros de caja
  - `getManualExecutionParameters()` - recopila parámetros ejecución
  - `updateDockingButton()` - habilita/deshabilita botón
  - `restoreInputTabAfterDocking()` - limpia UI post-docking
  - `displayExperimentAnalysis(analysis)` - muestra análisis experimento

**Dependencias:** appInstance, UIUtils
**Usuario:** main.js, event handlers

```javascript
// Ejemplo de uso
this.dockingManager = new DockingManager(this);
this.dockingManager.setupDocking();
const boxConfig = this.dockingManager.getManualBoxParameters();
```

---

### 7. main.js (~450 líneas)
**Responsabilidad:** Orquestación y estado global

**Contenido:**
- Clase `RePoSUDOEAI` con:
  - Constructor inicializa estado
  - `init()` - inicializa todos los managers
  - `initializeManagers()` - crea instancias de managers
  - `initializeExternalManagers()` - FileManager, ViewerManager
  - `setupModuleEventHandlers()` - event bus listeners
  - `setupInitialState()` - estado inicial UI
  - `loadAvailableExperiments()` - carga experimentos
  - `populateExperimentSelector()` - UI selector
  - `loadExperimentLog(id)` - carga log de experimento
  - `runDocking()` - POST a /api/docking/
  - `handleDockingComplete(result)` - procesa resultados
  - `handleDockingError(error)` - maneja errores
  - `renderDockingResults(result)` - renderiza resultados 3D
  - `updateExperimentInfo(result)` - actualiza info experimento

**Dependencias:** Todos los managers, file_handler.js, embedded_viewer.js
**Usuario:** Inicialización global en DOMContentLoaded

```javascript
// Creación global
document.addEventListener('DOMContentLoaded', () => {
    window.repoSudoeAI = new RePoSUDOEAI();
    window.repoSudoeAI.init();
});
```

---

## Flujo de Inicialización

```
DOMContentLoaded
    ↓
main.js carga
    ↓
RePoSUDOEAI constructor
    ↓
window.repoSudoeAI.init()
    ├─ setupCSRFToken()
    ├─ initializeManagers()
    │   ├─ new NavigationManager(this)
    │   ├─ new ThemeManager(this)
    │   ├─ new ChatManager(this)
    │   └─ new DockingManager(this)
    ├─ initializeExternalManagers()
    │   ├─ new FileManager(this)
    │   └─ new ViewerManager(this)
    ├─ setupModuleEventHandlers()
    ├─ setupInitialState()
    └─ loadAvailableExperiments()
```

## Flujo de Eventos

```
User Action
    ↓
DOM Event Listener (en módulo específico)
    ↓
Acción en Manager correspondiente
    ├─ Actualiza estado (this.app.*)
    ├─ Emite EventBus si es necesario
    ├─ Llama API si es necesario
    └─ Actualiza UI
    ↓
Resultado visible en UI
```

### Ejemplo: Chat Message

```javascript
// En chat.js:ChatManager.setupChat()
chatInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const message = chatInput.value;
        await this.sendMessage(message);
    }
});

// sendMessage() hace POST a /api/chat/
const response = await fetch('/api/chat/', {
    method: 'POST',
    body: JSON.stringify({ message, chatHistory: this.app.chatHistory })
});

// handleChatResponse() enruta según tipo
if (result.type === 'docking_complete') {
    this.app.handleDockingComplete(result);
}
```

## Ventajas del Refactoring

1. **Separación de Responsabilidades**
   - Cada módulo tiene una función específica
   - Errores localizados y más fáciles de debuggear

2. **Mantenibilidad**
   - Archivos más pequeños (max ~500 líneas)
   - Código más legible y comprensible
   - Cambios aislados a un módulo

3. **Reutilización**
   - UIUtils usado por múltiples managers
   - EventBus permite comunicación flexible
   - Config compartida por toda la app

4. **Testing**
   - Cada manager puede testearse de forma independiente
   - Mock de dependencias más fácil

5. **Performance**
   - Mejor cache buster (versiones por archivo)
   - Posibilidad de lazy loading en futuro

## Correspondencia con Archivo Original

### De repo-sudoe-ai.js a nuevos módulos:

- **Lines 1-200**: Objeto `translations` → **config.js**
- **Lines 201-207**: Funciones `t()`, `getCurrentLanguage()` → **config.js**
- **Lines 208-2471**: Clase `RePoSUDOEAI` → **distribuida entre:**
  - Constructor, init() → **main.js**
  - setupNavigation() → **navigation.js**
  - setupTheme(), toggleTheme() → **theme.js**
  - addMessageToChat(), parseVinaLog() → **utils.js**
  - setupChat(), sendMessage(), handleChatResponse() → **chat.js**
  - setupDocking(), setupBoxEnveloping() → **docking.js**
  - runDocking(), handleDockingComplete() → **main.js**

## Buscador de Funciones

Si necesitas encontrar una función específica:

```
1. setupNavigation()          → navigation.js
2. setupTheme()               → theme.js
3. toggleTheme()              → theme.js
4. setupChat()                → chat.js
5. sendMessage()              → chat.js
6. handleChatResponse()        → chat.js
7. addMessageToChat()          → utils.js
8. parseVinaLog()              → utils.js
9. setupDocking()              → docking.js
10. runDocking()               → main.js / docking.js
11. loadAvailableExperiments() → main.js
12. init()                      → main.js
```

## Próximos Pasos (Opcionales)

1. **Testing:** Crear archivos test para cada módulo
2. **Documentation:** Añadir JSDoc comments
3. **Performance:** Considerar webpack/bundler
4. **Error Handling:** Mejorar manejo de errores global
5. **State Management:** Considerar Vuex/Redux si crece

## Notas Técnicas

- **EventBus:** Requiere que `window.EventBus` esté disponible
- **FileManager:** Debe estar disponible antes de main.js
- **ViewerManager:** Debe estar disponible antes de main.js
- **3Dmol:** Cargado desde CDN antes de todos los scripts
- **Django i18n:** Esperado que /i18n/setlang/ esté disponible
- **CSRF Token:** Automáticamente recogido de meta tag o hidden input

## Revisión de Versión

- **Version:** 2.0.0 (Refactoring)
- **Fecha:** Febrero 2025
- **Estado:** Completado y Testeado
- **Breaking Changes:** None (compatible con HTML anterior)
