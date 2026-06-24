# Servicio Docker para Ollama (IA local, Fase 5)

## Contexto

`RePo-SUDOE-AI_v2` es una plataforma Django de docking molecular asistido por IA. `ROADMAP.md`, Fase 5 ("Soporte Ollama"), propone añadir Ollama como proveedor de IA local (sin API key, sin coste por uso), útil para desarrollo, demos sin conexión, o entornos con restricciones de privacidad.

La tarea `02_abstraccion_ai_provider.md` (Fase 1) define `OllamaProvider` (en `core/services/ai_provider.py`, pendiente de implementación) que se conecta a `settings.OLLAMA_BASE_URL` (por defecto `os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')`) y usa `settings.OLLAMA_MODEL` (por defecto `os.getenv('OLLAMA_MODEL', 'llama3.1:8b')`). `.env.example` ya define ambas variables (líneas 86-94):

```
# --- Ollama (IA local, sin key, sin coste) ---
# URL del servidor Ollama.
...
OLLAMA_BASE_URL=http://localhost:11434

# Modelo de Ollama a usar por defecto (debe estar descargado previamente)
OLLAMA_MODEL=llama3.1:8b
```

Esta tarea es **de infraestructura y documentación**, de dificultad baja (según el ROADMAP): añade el servicio `ollama` a `docker-compose.yml`, corrige el valor por defecto de `OLLAMA_BASE_URL` para que funcione DENTRO de la red Docker del proyecto (`http://localhost:11434` desde dentro del contenedor `web`/`celery_worker` apuntaría al propio contenedor, no al servicio `ollama`), y documenta en `README.md` los modelos recomendados y cómo descargarlos.

No depende de que `core/services/ai_provider.py` (tarea `02`) ya exista — `OllamaProvider` ya está diseñado para leer `settings.OLLAMA_BASE_URL`/`OLLAMA_MODEL`, por lo que esta tarea solo necesita asegurar que esas variables apunten al sitio correcto en el entorno Docker. Es independiente de las tareas `05`-`13` (no comparte archivos).

## Objetivo

Al terminar, `docker compose up` debe levantar también un contenedor `repo-sudoe-ollama` (imagen `ollama/ollama:latest`, puerto `11434`, con un volumen persistente para los modelos descargados); `OLLAMA_BASE_URL` en `.env.example` debe apuntar por defecto a `http://ollama:11434` (resoluble por nombre de servicio dentro de la red `repo-sudoe-network`); y `README.md` debe documentar qué modelos de Ollama están soportados/recomendados y el comando para descargarlos.

## Pre-requisitos

Ninguna. Tarea independiente — no comparte archivos con `05`-`13`. Para que el proveedor `ollama` sea seleccionable de extremo a extremo desde el perfil de usuario hace falta `01_modelo_userprofile_apikey.md` y `02_abstraccion_ai_provider.md` (Fase 1), pero esta tarea (infraestructura Docker + documentación) puede completarse y verificarse de forma independiente.

## Archivos a crear/modificar

- `docker-compose.yml`: añadir el servicio `ollama` y el volumen `ollama_models`.
- `.env.example`: cambiar el valor por defecto de `OLLAMA_BASE_URL` de `http://localhost:11434` a `http://ollama:11434`, con un comentario explicando ambos casos (Docker vs. desarrollo local sin Docker).
- `README.md`: añadir una subsección "Ollama (IA local)" con la tabla de modelos recomendados y los comandos de descarga/prueba (en las secciones en español e inglés).

## Especificación detallada

### 1. `docker-compose.yml` — servicio `ollama`

Añade un nuevo servicio, al mismo nivel que `db`, `web` y `nginx` (por ejemplo, justo después de `db` o antes de `nginx`):

```yaml
  # Ollama - IA local (Fase 5, opcional)
  ollama:
    image: ollama/ollama:latest
    container_name: repo-sudoe-ollama
    ports:
      - "${OLLAMA_PORT:-11434}:11434"
    volumes:
      - ollama_models:/root/.ollama
    networks:
      - repo-sudoe-network
    restart: unless-stopped
    # Para usar GPU NVIDIA (requiere nvidia-container-toolkit instalado en el host):
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: all
    #           capabilities: [gpu]
```

Añade `ollama_models` a la sección `volumes:` de nivel superior (junto a `postgres_data`, `static_volume`, `media_volume`):

```yaml
volumes:
  postgres_data:
  static_volume:
  media_volume:
  ollama_models:
```

Notas:
- El servicio `ollama` es **opcional**: los usuarios que usen OpenAI/Anthropic/Google como proveedor de IA no necesitan este contenedor. No lo añadas a `depends_on` de `web`/`celery_worker` — debe poder omitirse (p.ej. con `docker compose up --scale ollama=0` o simplemente no usándolo) sin romper el resto de la aplicación, ya que `OllamaProvider` solo se invoca si el usuario elige `ollama` como proveedor de IA.
- `${OLLAMA_PORT:-11434}`: variable opcional, no es necesario añadirla a `.env.example` (el valor por defecto `11434` es el estándar de Ollama); puedes documentarla como variable opcional si lo prefieres, pero no es obligatorio.
- No es necesario añadir un `healthcheck` (fuera de alcance), aunque puede añadirse opcionalmente con `test: ["CMD", "ollama", "list"]` si se desea.

### 2. `.env.example` — `OLLAMA_BASE_URL`

Localiza el bloque actual (líneas ~86-94):

```
# --- Ollama (IA local, sin key, sin coste) ---
# URL del servidor Ollama.
# ...
OLLAMA_BASE_URL=http://localhost:11434

# Modelo de Ollama a usar por defecto (debe estar descargado previamente)
OLLAMA_MODEL=llama3.1:8b
```

Sustitúyelo por:

```
# --- Ollama (IA local, sin key, sin coste) ---
# URL del servidor Ollama.
# - Si usas docker-compose (este proyecto incluye un servicio "ollama"),
#   usa el nombre del servicio en la red Docker: http://ollama:11434
# - Si ejecutas Ollama manualmente en tu máquina (fuera de Docker) y
#   `web`/`celery_worker` también corren fuera de Docker (entorno de
#   desarrollo local sin contenedores), usa http://localhost:11434
OLLAMA_BASE_URL=http://ollama:11434

# Modelo de Ollama a usar por defecto (debe estar descargado previamente
# con: docker exec repo-sudoe-ollama ollama pull <modelo>)
OLLAMA_MODEL=llama3.1:8b
```

Importante: revisa el resto de `.env.example` por si existe una nota equivalente para `REDIS_URL`/`REDIS_CHANNELS_URL` (que ya usan `redis` como hostname, consistente con este cambio) — el patrón "nombre del servicio Docker como hostname" ya se usa en otras variables del archivo; este cambio simplemente lo aplica también a `OLLAMA_BASE_URL`. Si el desarrollador usa el flujo "Backend nativo + Docker solo para `db`" descrito en `README.md` (sección "Instalación" -> desarrollo sin Docker para `web`), deberá cambiar manualmente esta variable a `http://localhost:11434` en su `.env` local — esto se documenta en el paso 3.

### 3. `README.md` — sección "Ollama (IA local)"

Añade una nueva subsección después de "### Configuración" (línea ~139, justo antes de "### Ejecución en desarrollo", línea 141) en la sección en español:

```markdown
### Ollama (IA local, opcional)

El proyecto incluye un servicio Docker `ollama` (`docker-compose.yml`) que permite usar modelos de IA locales, sin API key ni coste por uso.

1. Levanta el servicio (incluido en `docker compose up`):
   ```bash
   docker compose up -d ollama
   ```
2. Descarga un modelo (solo la primera vez; se almacena en el volumen `ollama_models`):
   ```bash
   docker exec repo-sudoe-ollama ollama pull llama3.1:8b
   ```
3. En tu perfil de usuario (`/accounts/profile/` o equivalente, ver `01_modelo_userprofile_apikey.md`), selecciona `ollama` como proveedor de IA — no se requiere API key.
4. Si ejecutas el backend (`web`/`celery_worker`) FUERA de Docker (entorno de desarrollo nativo), cambia `OLLAMA_BASE_URL` en tu `.env` a `http://localhost:11434`.

Modelos recomendados:

| Modelo | Tamaño aprox. | Calidad | Velocidad | Uso recomendado |
|--------|--------------|---------|-----------|------------------|
| `llama3.2:3b` | ~2 GB | ★★★☆☆ | Muy rápida | Desarrollo / pruebas |
| `llama3.1:8b` | ~5 GB | ★★★★☆ | Rápida | Uso general (por defecto) |
| `qwen2.5:7b` | ~5 GB | ★★★★☆ | Rápida | Análisis científico |
| `mistral:7b` | ~4 GB | ★★★★☆ | Rápida | Código + análisis |
| `llama3.1:70b` | ~40 GB | ★★★★★ | Lenta (requiere GPU) | Producción con GPU |

Para usar un modelo distinto al de por defecto, descárgalo con `docker exec repo-sudoe-ollama ollama pull <modelo>` y configúralo como `OLLAMA_MODEL` en `.env` (o por usuario, en su perfil — campo `ai_model`).
```

Añade el equivalente en inglés en la sección "## 🇬🇧 English" (cerca de "### Quick Start", línea ~252), con el mismo contenido traducido (tabla de modelos puede mantenerse igual, solo traduce el texto descriptivo). Usa un encabezado como `### Ollama (local AI, optional)`.

## Dependencias nuevas

Ninguna.

## Criterios de aceptación / cómo verificar

1. `docker compose config` valida `docker-compose.yml` sin errores de sintaxis tras añadir el servicio `ollama` y el volumen `ollama_models`.
2. `docker compose up -d ollama` levanta el contenedor `repo-sudoe-ollama` y `curl http://localhost:11434/api/tags` (desde el host) responde (puede devolver una lista vacía de modelos si aún no se ha descargado ninguno).
3. `docker exec repo-sudoe-ollama ollama pull llama3.2:3b` descarga el modelo correctamente (puede tardar varios minutos según la conexión).
4. Tras descargar un modelo, `curl http://localhost:11434/api/generate -d '{"model": "llama3.2:3b", "prompt": "hola", "stream": false}'` devuelve una respuesta JSON con un campo `"response"`.
5. Desde dentro del contenedor `web` (`docker compose exec web sh` o equivalente — si el servicio `web` ya existe y está levantado), `curl http://ollama:11434/api/tags` responde correctamente (confirma que el hostname `ollama` es resoluble en la red `repo-sudoe-network` y que `OLLAMA_BASE_URL=http://ollama:11434` es la URL correcta para `OllamaProvider` en este entorno).
6. `grep OLLAMA_BASE_URL .env.example` muestra `OLLAMA_BASE_URL=http://ollama:11434`.
7. `README.md` contiene la nueva sección "Ollama" (en español e inglés) con la tabla de modelos recomendados.

## Fuera de alcance

- No implementar/modificar `core/services/ai_provider.py` ni `OllamaProvider` (tarea `02_abstraccion_ai_provider.md`).
- No modificar `accounts/models.py` ni `UserProfile`/`ollama_base_url` (tarea `01_modelo_userprofile_apikey.md`).
- No añadir `depends_on: ollama` a `web`/`celery_worker` (el servicio es opcional).
- No descargar modelos automáticamente al iniciar el contenedor (p.ej. con un `entrypoint` personalizado) — la descarga es un paso manual documentado (`docker exec ... ollama pull ...`).
- No configurar soporte GPU activo (se documenta como bloque comentado, sin activarlo).
- No modificar `docker-compose.yml` en lo relativo a `redis`, `celery_worker`, `web` (Daphne) ni el socket Docker (tareas `05`, `11`, `12`).
