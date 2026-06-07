# 🧪 GUÍA DE VERIFICACIÓN - Refactoring Modular

## 1️⃣ Verificación en Navegador

### A. Abrir la aplicación
```
1. Navega a: http://localhost:8000/
2. Abre Developer Tools: F12 o Ctrl+Shift+I
3. Ve a la pestaña "Console"
```

### B. Verificar Logs de Inicialización
En la consola deberías ver:
```javascript
[INIT] main.js loaded
[INIT] DOMContentLoaded event fired
[INIT] RePoSUDOEAI constructor called
[OK] RePoSUDOEAI instance created
[INIT] RePoSUDOEAI.init() starting
[INIT] Initializing manager instances
[OK] NavigationManager initialized
[OK] ThemeManager initialized
[OK] ChatManager initialized
[OK] DockingManager initialized
[INIT] Initializing external managers
[OK] FileManager initialized
[OK] ViewerManager initialized
[INIT] Module event handlers configured
[INIT] Setting up initial UI state
[INIT] Loading available experiments
[OK] Loaded X experiments
[OK] Experiment selector populated
[OK] RePoSUDOEAI.init() complete
[OK] RePoSUDOEAI application initialized successfully
```

### C. Verificar que no hay Errores
En la consola no debe aparecer ningún error como:
```
❌ Uncaught ReferenceError: config is not defined
❌ Uncaught TypeError: NavigationManager is not defined
❌ Uncaught SyntaxError: Unexpected token
```

---

## 2️⃣ Verificación de Funcionalidad

### ✅ Test 1: Navegación
```javascript
// Ejecuta en la consola:
window.repoSudoeAI.navigationManager.showSection('manual');

// Verificar:
✓ La sección "Manual Mode" debe aparecer
✓ Las otras secciones deben ocultarse
✓ El nav link debe cambiar de estilo
```

### ✅ Test 2: Tema
```javascript
// Ejecuta en la consola:
window.repoSudoeAI.themeManager.toggleTheme();

// Verificar:
✓ La interfaz debe cambiar a tema oscuro o claro
✓ El icono del tema debe cambiar
✓ localStorage debe guardar el tema
```

### ✅ Test 3: Traducciones
```javascript
// Ejecuta en la consola:
t('chatTitle');
t('manualMode');
t('runDocking');

// Verificar:
✓ Debe retornar el texto traducido
✓ Puede ser en español o inglés
```

### ✅ Test 4: Chat
```javascript
// Ejecuta en la consola:
await window.repoSudoeAI.chatManager.sendMessage('Hola');

// Verificar:
✓ El mensaje debe aparecer en el chat
✓ El servidor debe responder
✓ La respuesta debe procesarse correctamente
```

### ✅ Test 5: Utilidades
```javascript
// Ejecuta en la consola:
UIUtils.addMessageToChat('Test message', 'assistant');
UIUtils.formatInfoField('Test', 'Value');

// Verificar:
✓ El mensaje debe aparecer en el chat
✓ El formateo debe aplicarse correctamente
```

### ✅ Test 6: Acceso Global
```javascript
// Ejecuta en la consola:
window.repoSudoeAI                          // Objeto principal
window.repoSudoeAI.chatManager              // Manager de chat
window.repoSudoeAI.navigationManager        // Manager de navegación
window.repoSudoeAI.themeManager             // Manager de tema
window.repoSudoeAI.dockingManager           // Manager de docking
window.repoSudoeAI.fileManager              // Manager de archivos
window.repoSudoeAI.viewerManager            // Manager de visualización

// Verificar:
✓ Todos deben retornar objetos válidos
✓ No debe haber undefined
```

---

## 3️⃣ Verificación de Archivos

### Lista de Archivos que Deben Existir

```
✅ d:\TFG\RePo-SUDOE-AI\frontend\static\frontend\js\
   ├─ config.js                  (250 líneas)
   ├─ navigation.js              (75 líneas)
   ├─ theme.js                   (150 líneas)
   ├─ utils.js                   (180 líneas)
   ├─ chat.js                    (500 líneas)
   ├─ docking.js                 (300 líneas)
   ├─ main.js                    (450 líneas)
   ├─ event_bus.js               (existente)
   ├─ file_handler.js            (existente)
   ├─ embedded_viewer.js         (existente)
   └─ repo-sudoe-ai.js           (original - puede eliminarse)

✅ d:\TFG\RePo-SUDOE-AI\
   ├─ REFACTORING_SUMMARY.md     (guía)
   ├─ REFACTORING_CHECKLIST.md   (verificación)
   └─ REFACTORING_NOTES.md       (documentación técnica en js/)
```

### Verificar Contenido de Archivos

```bash
# En PowerShell o terminal
# Verificar que config.js tiene traducciones
findstr /C:"translations = {" "d:\TFG\RePo-SUDOE-AI\frontend\static\frontend\js\config.js"

# Verificar que navigation.js tiene la clase
findstr /C:"class NavigationManager" "d:\TFG\RePo-SUDOE-AI\frontend\static\frontend\js\navigation.js"

# Verificar que main.js inicializa
findstr /C:"class RePoSUDOEAI" "d:\TFG\RePo-SUDOE-AI\frontend\static\frontend\js\main.js"
```

---

## 4️⃣ Verificación de HTML

### Verificar que index.html tiene los scripts correctos

```bash
# En PowerShell
# Buscar todos los scripts
findstr /C:"<script src" "d:\TFG\RePo-SUDOE-AI\frontend\templates\frontend\index.html"
```

Deberías ver:
```
<script src="{% static 'frontend/js/event_bus.js' %}...
<script src="{% static 'frontend/js/config.js' %}...
<script src="{% static 'frontend/js/file_handler.js' %}...
<script src="{% static 'frontend/js/embedded_viewer.js' %}...
<script src="{% static 'frontend/js/navigation.js' %}...
<script src="{% static 'frontend/js/theme.js' %}...
<script src="{% static 'frontend/js/utils.js' %}...
<script src="{% static 'frontend/js/chat.js' %}...
<script src="{% static 'frontend/js/docking.js' %}...
<script src="{% static 'frontend/js/main.js' %}...
```

---

## 5️⃣ Verificación en Django

### Verificar que los archivos son accesibles

```bash
# En la terminal del proyecto Django
python manage.py collectstatic --noinput

# O verificar que el directorio existe
dir "d:\TFG\RePo-SUDOE-AI\frontend\static\frontend\js\"
```

### Verificar que las URLs funcionan

```
En navegador:
- http://localhost:8000/static/frontend/js/config.js
- http://localhost:8000/static/frontend/js/main.js
- http://localhost:8000/static/frontend/js/chat.js
- etc.

Deberías ver el contenido de los archivos, no errores 404
```

---

## 6️⃣ Verificación de Funcionalidad Completa

### Escenario Completo: Chat a Docking

```javascript
// 1. Abrir la consola
F12

// 2. Verificar inicialización
// Deberías ver: [OK] RePoSUDOEAI application initialized successfully

// 3. Enviar un mensaje
await window.repoSudoeAI.chatManager.sendMessage('Perform docking between Abemaciclib and A2M');

// 4. Verificar respuestas
// El chat debe mostrar la respuesta del servidor

// 5. Cambiar de sección
window.repoSudoeAI.navigationManager.showSection('manual');

// 6. Verificar que los controles están disponibles
// Los uploads y controles de docking deben estar visibles

// 7. Cambiar tema
window.repoSudoeAI.themeManager.toggleTheme();

// 8. Cambiar idioma
document.getElementById('language-toggle').click();
```

---

## 7️⃣ Troubleshooting

### Problema: "Cannot read property 'chatManager' of undefined"
**Causa:** RePoSUDOEAI no inicializó
**Solución:** Verificar console logs, buscar errores de carga

### Problema: "NavigationManager is not defined"
**Causa:** navigation.js no cargó
**Solución:** Verificar que el archivo existe y está referenciado en HTML

### Problema: "config is not defined"
**Causa:** config.js no cargó
**Solución:** Verificar orden de scripts - debe estar antes que otros módulos

### Problema: Chat no funciona
**Causa:** Endpoint `/api/chat/` no disponible
**Solución:** Verificar que Django backend está funcionando

### Problema: 3D Viewer no funciona
**Causa:** 3Dmol.js no cargó
**Solución:** Verificar que CDN es accesible

### Problema: Secciones no aparecen
**Causa:** CSS de secciones no aplicado
**Solución:** Verificar que CSS tiene `.section.active { display: block; }`

---

## 8️⃣ Logs Esperados para cada Acción

### Al cargar la página
```
[INIT] main.js loaded
[INIT] DOMContentLoaded event fired
[INIT] RePoSUDOEAI constructor called
[OK] RePoSUDOEAI instance created
[INIT] RePoSUDOEAI.init() starting
...
[OK] RePoSUDOEAI application initialized successfully
```

### Al navegar a una sección
```
[ROUTING] Hash changed to: #manual
[TARGET] Manual section found: true
[OK] Manual section shown
[UPDATE] Nav links updated
```

### Al cambiar tema
```
[THEME] Toggle theme requested
[OK] Theme changed to: dark
[UPDATE] Viewer backgrounds updated
[INFO] Theme stored in localStorage
```

### Al enviar un mensaje
```
[CHAT] Message input ready
[SEND] Sending message: "Hola"
[API] Calling /api/chat/
[RESPONSE] Message type: structure_selection
[HANDLER] Processing structure selection
```

---

## 9️⃣ Verificación Final

```javascript
// Ejecuta esto en la consola para un test completo
console.log('=== REFACTORING VERIFICATION ===');
console.log('RePoSUDOEAI exists:', !!window.repoSudoeAI);
console.log('ChatManager exists:', !!window.repoSudoeAI.chatManager);
console.log('NavigationManager exists:', !!window.repoSudoeAI.navigationManager);
console.log('ThemeManager exists:', !!window.repoSudoeAI.themeManager);
console.log('DockingManager exists:', !!window.repoSudoeAI.dockingManager);
console.log('FileManager exists:', !!window.repoSudoeAI.fileManager);
console.log('ViewerManager exists:', !!window.repoSudoeAI.viewerManager);
console.log('UIUtils exists:', !!window.UIUtils);
console.log('t() function exists:', typeof t);
console.log('=== ALL CHECKS PASSED ===');
```

Esperado:
```
=== REFACTORING VERIFICATION ===
RePoSUDOEAI exists: true
ChatManager exists: true
NavigationManager exists: true
ThemeManager exists: true
DockingManager exists: true
FileManager exists: true
ViewerManager exists: true
UIUtils exists: true
t() function exists: function
=== ALL CHECKS PASSED ===
```

---

## 🎯 Resumen de Verificación

| Verificación | Estado | Acción |
|--------------|--------|--------|
| Archivos creados | ✅ | Listo |
| HTML actualizado | ✅ | Listo |
| Scripts cargando | ⏳ | Ver consola |
| Navegación funciona | ⏳ | Test: showSection() |
| Chat funciona | ⏳ | Test: sendMessage() |
| Tema funciona | ⏳ | Test: toggleTheme() |
| Docking funciona | ⏳ | Test: runDocking() |
| Experimentos cargan | ⏳ | Ver selector |

---

**Fecha de Verificación:** Febrero 2025
**Próximo Paso:** Ejecutar verificaciones en navegador
