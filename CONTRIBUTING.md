# Guía de Contribución — RePo-SUDOE-AI

¡Gracias por tu interés en contribuir a RePo-SUDOE-AI! Esta guía explica cómo participar de forma efectiva.

---

## Cómo reportar bugs

1. **Busca primero** en [Issues existentes](https://github.com/isecu33/RePo-SUDOE-AI/issues) — puede que el bug ya esté reportado.
2. Si no existe, abre un nuevo Issue usando la plantilla **Bug Report**.
3. Incluye siempre:
   - Versión del sistema operativo y versión de Docker
   - Pasos exactos para reproducir el bug
   - Comportamiento esperado vs. comportamiento real
   - Logs relevantes (de `docker compose logs web` o el traceback de Django)
   - Captura de pantalla si el bug es visual

## Cómo proponer nuevas funcionalidades

1. Abre un Issue con la plantilla **Feature Request** antes de empezar a codificar.
2. Describe el problema que resuelve la feature y por qué sería útil.
3. Espera feedback del maintainer antes de invertir tiempo en la implementación.
4. Para features grandes, considera abrir una discusión primero en la pestaña **Discussions**.

---

## Proceso de Pull Request

1. Haz un fork del repositorio y crea una rama desde `main`:
   ```bash
   git checkout -b feature/nombre-descriptivo
   # o para bugs:
   git checkout -b fix/descripcion-del-bug
   ```

2. Implementa los cambios siguiendo las convenciones de código (ver abajo).

3. Escribe o actualiza los tests correspondientes.

4. Asegúrate de que el CI pasa localmente:
   ```bash
   # Backend
   flake8 . --max-line-length=120 --exclude=migrations,venv
   black --check . --exclude='/(migrations|venv)/'
   python manage.py test

   # Frontend
   cd frontend && npm run type-check && npm run lint && npm run build
   ```

5. Haz commit con mensajes descriptivos siguiendo el formato:
   ```
   tipo(ámbito): descripción corta en imperativo

   Descripción más detallada si es necesario.
   Closes #123
   ```
   Tipos válidos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

6. Abre el Pull Request contra la rama `main` usando la plantilla.

7. Responde a los comentarios de revisión y actualiza la rama si es necesario.

---

## Estilo de código

### Python — black + flake8

```bash
# Instalar herramientas de desarrollo
pip install black flake8 isort

# Formatear código
black . --exclude='/(migrations|venv)/'

# Ordenar imports
isort . --skip migrations --skip venv

# Verificar estilo
flake8 . --max-line-length=120 --exclude=migrations,venv
```

Configuración en `setup.cfg` o `pyproject.toml`:

```ini
[flake8]
max-line-length = 120
exclude = migrations, venv, .venv, __pycache__
ignore = E203, W503
```

Convenciones principales:
- Docstrings en español para funciones públicas
- Type hints en todos los métodos (Python 3.11+)
- No usar `print()` en código de producción — usar `logging`
- Máximo 120 caracteres por línea

### TypeScript — ESLint

```bash
# Verificar
cd frontend && npm run lint

# Corregir automáticamente
cd frontend && npm run lint:fix
```

Convenciones principales:
- `strict: true` en `tsconfig.json` — no desactivar
- Interfaces sobre `type` para objetos
- No usar `any` — si es necesario, documentar por qué con un comentario `// eslint-disable-next-line`
- Nombres de interfaces en PascalCase, eventos en `modulo:accion`
- Funciones privadas con prefijo `_` o modificador `private`

---

## Configurar el entorno de desarrollo local

### Requisitos previos

- Python 3.11+
- Node.js 20+ y npm 10+
- Docker Engine 24+
- PostgreSQL 15+ (o usar Docker)
- Git

### Pasos

```bash
# 1. Fork y clonar
git clone https://github.com/TU_USUARIO/RePo-SUDOE-AI.git
cd RePo-SUDOE-AI

# 2. Entorno virtual Python
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
pip install black flake8 isort  # herramientas de dev

# 3. Variables de entorno
cp .env.example .env
# Editar .env con tus credenciales locales

# 4. Base de datos (opción A: Docker)
docker compose up db -d
# Opción B: PostgreSQL local — ajustar DB_* en .env

# 5. Migraciones y datos iniciales
python manage.py migrate
python manage.py createsuperuser

# 6. Frontend
cd frontend
npm install
npm run dev   # servidor de desarrollo con HMR
cd ..

# 7. Arrancar Django
python manage.py runserver

# 8. (Opcional) Celery para jobs asíncronos
docker compose up redis -d
celery -A config worker --loglevel=info
```

### Ejecutar los tests

```bash
# Tests de backend
python manage.py test

# Tests con coverage
pip install coverage
coverage run manage.py test
coverage report

# Tests de frontend
cd frontend && npm run type-check
```

### Pre-commit hooks (recomendado)

```bash
pip install pre-commit
pre-commit install
```

Esto ejecutará automáticamente black, flake8 e isort antes de cada commit.

---

## Preguntas frecuentes

**¿Necesito una API key de OpenAI para desarrollar?**  
No necesariamente. Puedes usar Ollama localmente (ver Fase 5 en ROADMAP.md) o mockear las respuestas de IA en los tests.

**¿Puedo contribuir solo con documentación o traducciones?**  
¡Sí! Las mejoras de documentación son muy bienvenidas. Abre un PR normal con los cambios en los archivos `.md`.

**¿Dónde pido ayuda?**  
Abre un Issue con la etiqueta `question` o escribe en la sección Discussions del repositorio.
