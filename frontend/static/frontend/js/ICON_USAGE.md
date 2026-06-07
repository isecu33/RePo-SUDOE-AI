# 📦 Guía de Uso de Iconos SVG

## 🎯 Resumen

Se han reemplazado todos los textos tipo `[OK]`, `[ERROR]`, etc. por iconos SVG usando las funciones `icon()` y `getIcon()` definidas en [utils.js](utils.js).

## 🔧 Funciones Disponibles

### `icon(iconName)`
Función simplificada para usar iconos con configuración por defecto.

```javascript
// Ejemplo de uso:
console.log(icon('success') + ' Operación completada');
message = `${icon('error')} Ha ocurrido un error`;
```

### `getIcon(iconName, className, size)`
Función completa con opciones personalizables.

**Parámetros:**
- `iconName` (string): Nombre del icono o alias
- `className` (string, opcional): Clase CSS personalizada
- `size` (number, opcional): Tamaño en píxeles (default: 16)

```javascript
// Ejemplos:
getIcon('check', 'my-custom-class', 24);  // Icono de 24px con clase personalizada
getIcon('error', '', 20);                  // Icono de 20px sin clase
```

## 🗺️ Mapeo de Iconos

La función incluye un mapeo de aliases para facilitar el uso:

| Alias | Archivo SVG | Uso Común |
|-------|-------------|-----------|
| `check`, `success`, `ok` | `check_box.svg` | Confirmaciones, éxitos |
| `error`, `cancel` | `close.svg` | Errores, cancelaciones |
| `info`, `warning` | `info.svg` | Información, advertencias |
| `search` | `search.svg` | Búsquedas |
| `download` | `download.svg` | Descargas |
| `save` | `save.svg` | Guardado de archivos |
| `settings`, `config` | `settings.svg` | Configuración |
| `play`, `run` | `play.svg` | Ejecución |
| `genetics` | `genetics.svg` | Genética |
| `gene` | `genes.svg` | Genes |
| `mix` | `mix.svg` | Mezclas |
| `pill`, `drug` | `pill.svg` | Medicamentos |
| `lightbulb`, `idea` | `lightbulb.svg` | Ideas, sugerencias |
| `build` | `build_circle.svg` | Construcción, compilación |

## 📁 Ubicación de Iconos

Los iconos SVG se encuentran en:
```
/static/frontend/img/icons/
```

Iconos disponibles:
- `check_box.svg`
- `close.svg`
- `info.svg`
- `search.svg`
- `download.svg`
- `save.svg`
- `settings.svg`
- `play.svg`
- `genetics.svg`
- `genes.svg`
- `mix.svg`
- `pill.svg`
- `lightbulb.svg`
- `build_circle.svg`

## ✅ Archivos Modificados

Se han reemplazado los textos por iconos en los siguientes archivos:

### [chat.js](chat.js)
- ✅ `[ERROR]` → `icon('error')`
- ✅ `[OK]` → `icon('check')`
- ✅ `[SEARCH]` → `icon('search')`
- ✅ `💾` → `icon('save')`

### [chat_complete.js](chat_complete.js)
- ✅ Mismos cambios que chat.js

### [main.js](main.js)
- ✅ `[ERROR]` → `icon('error')`
- ✅ `[OK]` → `icon('success')`
- ✅ `[INFO]` → `icon('info')`

### [navigation.js](navigation.js)
- ✅ `[WARNING]` → `icon('warning')`

### [docking.js](docking.js)
- ✅ `[ERROR]` → `icon('error')`

## 🎨 Personalización de Iconos

### Agregar un Nuevo Icono

1. **Añadir el archivo SVG**:
   ```bash
   # Guardar el nuevo icono en:
   /static/frontend/img/icons/mi_nuevo_icono.svg
   ```

2. **Actualizar el mapeo en utils.js** (opcional):
   ```javascript
   const iconMap = {
       // ... iconos existentes ...
       'mi-alias': 'mi_nuevo_icono',
   };
   ```

3. **Usar el icono**:
   ```javascript
   icon('mi-alias')
   // o directamente:
   getIcon('mi_nuevo_icono')
   ```

### Cambiar el Tamaño por Defecto

Editar [utils.js](utils.js) línea 11:
```javascript
function getIcon(iconName, className = '', size = 16) {
    // Cambiar 16 por el tamaño deseado
}
```

### Cambiar el Estilo

Los iconos se generan con este estilo inline:
```javascript
style="display: inline-block; vertical-align: middle; margin-right: 4px;"
```

Para personalizarlo, editar [utils.js](utils.js) línea 41.

## 🔍 Ejemplos de Uso

### En Mensajes de Chat
```javascript
this.addMessageToChat(`${icon('error')} Error al procesar`, 'assistant');
this.addMessageToChat(`${icon('success')} Operación exitosa`, 'assistant');
```

### En Console Logs
```javascript
console.log(icon('info') + ' Información relevante');
console.error(icon('error') + ' Error crítico');
console.log(icon('success') + ' Proceso completado');
```

### En Botones HTML
```javascript
const button = `
    <button>
        ${icon('play')} Ejecutar
    </button>
`;
```

### Con Tamaño Personalizado
```javascript
const bigIcon = getIcon('check', '', 32);  // Icono de 32px
const smallIcon = getIcon('error', '', 12); // Icono de 12px
```

## 🛠️ Troubleshooting

### El icono no se muestra

1. **Verificar que el archivo SVG existe**:
   ```bash
   ls /static/frontend/img/icons/
   ```

2. **Verificar la consola del navegador** para errores 404

3. **Verificar que utils.js se carga primero** en [index.html](../../templates/frontend/index.html)

### El icono se ve mal alineado

Ajustar el estilo inline en [utils.js](utils.js) línea 41:
```javascript
style="display: inline-block; vertical-align: middle; margin-right: 4px;"
```

## 📚 Referencia Rápida

```javascript
// ✅ Correcto
icon('success')
icon('error')
getIcon('check', 'my-class', 20)

// ❌ Incorrecto
icon('[OK]')           // No usar corchetes
getIcon('success.svg') // No incluir extensión
```

---

**Nota**: Esta función solo funciona en navegadores con soporte para HTML en strings. Todos los navegadores modernos lo soportan.
