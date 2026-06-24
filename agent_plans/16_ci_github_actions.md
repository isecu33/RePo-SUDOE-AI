# CI con GitHub Actions (lint + tests + build)

## Contexto

`RePo-SUDOE-AI_v2` es una plataforma Django de docking molecular asistido por IA. `ROADMAP.md`, Fase 6 ("Preparación OpenSource"), propone un workflow `.github/workflows/ci.yml` que ejecute en cada push/PR: lint y tests del backend (Python/Django) y type-check, lint y build del frontend (TypeScript/Vite).

Investigación previa sobre el estado actual del repositorio (importante para esta tarea):

- `CONTRIBUTING.md` (ya existe) **ya documenta** los comandos de lint/test que el CI debe ejecutar: `flake8 . --max-line-length=120 --exclude=migrations,venv`, `black --check . --exclude='/(migrations|venv)/'`, `python manage.py test`, y en frontend `npm run type-check`, `npm run lint`, `npm run build`. También dice que la configuración de flake8 debe estar "en `setup.cfg` o `pyproject.toml`" — pero **ese archivo no existe todavía**.
- `requirements-dev.txt` existe pero solo incluye `pytest`, `pytest-django`, `coverage` — **no incluye `flake8`, `black` ni `isort`**, aunque `CONTRIBUTING.md` los menciona como herramientas de desarrollo (`pip install black flake8 isort`).
- `frontend/package.json` tiene los scripts `dev`, `build`, `build:fast`, `preview`, `type-check` — pero **no tiene `lint` ni `lint:fix`**, aunque `CONTRIBUTING.md` los referencia (`cd frontend && npm run lint`). No existe ningún archivo de configuración de ESLint en `frontend/`. El frontend es TypeScript puro (Vite), sin React (no hay `react`/`react-dom` en `package.json`).
- `config/settings.py` (líneas 69-78) define `DATABASES` usando `os.getenv('DB_NAME', 'repo_sudoe_ai')`, `DB_USER` (default `admin`), `DB_PASSWORD` (default `admin`), `DB_HOST` (default `localhost`), `DB_PORT` (default `5432`) — **NO usa `DATABASE_URL`** como sugiere el ejemplo de `ROADMAP.md`. El workflow de CI debe usar estas variables (`DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT`), no `DATABASE_URL`.
- `SECRET_KEY` (línea 15) y `DEBUG` (línea 18) tienen valores por defecto (`'your-secret-key-here'` y `True`), por lo que `manage.py test` puede ejecutarse sin definir estas variables, aunque es buena práctica fijarlas explícitamente en el workflow.
- `requirements.txt` declara `Django>=5.1.0`. Usa Python 3.11 (coherente con `ROADMAP.md` y con el resto de tareas de `agent_plans/`).

Esta tarea por tanto no es solo "copiar el YAML del ROADMAP": requiere también crear el archivo de configuración de flake8/isort que falta, añadir las dependencias de lint que faltan en `requirements-dev.txt`, y dar de alta ESLint en el frontend (config + scripts `lint`/`lint:fix`) para que los comandos que el propio CI ejecuta existan y funcionen. El objetivo final es que, tras esta tarea, `git push` dispare el workflow y el job termine en verde (o, si hay errores de lint preexistentes en el código, que esta tarea los corrija de forma mínima — solo formateo/imports, sin cambios de lógica).

## Objetivo

Al terminar, debe existir `.github/workflows/ci.yml` que, en cada `push` a `main`/`develop` y en cada Pull Request contra `main`, ejecute dos jobs — `backend` (flake8, black --check, `manage.py test` con PostgreSQL de servicio) y `frontend` (`npm ci`, `type-check`, `lint`, `build`) — y ambos jobs deben terminar correctamente (exit code 0) sobre el estado actual del repositorio tras esta tarea.

## Pre-requisitos

Ninguna tarea de `agent_plans/` es estrictamente necesaria antes de esta. Es independiente de `01`-`14`. Puede solaparse en el tiempo con `15_licencia_y_plantillas_github.md` (no comparten archivos: `15` solo toca `LICENSE` y `.github/ISSUE_TEMPLATE/`+`.github/pull_request_template.md`; esta tarea toca `.github/workflows/`, `setup.cfg`, `requirements-dev.txt` y `frontend/`). Recomendado ejecutarla en último lugar (o casi), ya que el job `backend` de `manage.py test` puede revelar fallos introducidos por otras tareas que toquen `core/`/`accounts/` (tareas `01`-`13`); si se ejecuta en paralelo con esas tareas, puede que el CI falle hasta que todas se integren — esto es esperable y no es un fallo de esta tarea en sí.

## Archivos a crear/modificar

- `.github/workflows/ci.yml` (nuevo): workflow de GitHub Actions con jobs `backend` y `frontend`.
- `setup.cfg` (nuevo, raíz del proyecto): sección `[flake8]` (y opcionalmente `[isort]`), tal y como `CONTRIBUTING.md` ya indica que debe existir.
- `requirements-dev.txt` (modificar): añadir `flake8`, `black`, `isort`.
- `frontend/eslint.config.js` (nuevo): configuración de ESLint 9 (flat config) para TypeScript.
- `frontend/package.json` (modificar): añadir scripts `lint` y `lint:fix`, y añadir `eslint`, `typescript-eslint`, `@eslint/js`, `globals` a `devDependencies`.
- Cualquier archivo Python/TypeScript existente con errores de formateo/lint detectados por `black`/`isort`/`flake8`/`eslint` tras añadir esta configuración: corregir SOLO problemas de formato/imports/estilo (aplicar `black .`, `isort .`, eliminar imports no usados, etc.), **sin cambiar lógica de negocio**. Si algún error de `flake8`/`eslint` requiere un cambio de lógica no trivial, no lo corrijas: añade una excepción puntual documentada (`# noqa: <code>` en Python con un comentario explicando por qué, o `// eslint-disable-next-line <regla>` en TS) y anótalo en el resumen final del PR para que se revise en una tarea futura.

## Especificación detallada

### 1. `setup.cfg` (raíz del proyecto)

```ini
[flake8]
max-line-length = 120
exclude = migrations, venv, .venv, __pycache__, node_modules, frontend/static
ignore = E203, W503

[isort]
profile = black
line_length = 120
skip = migrations, venv, .venv, node_modules
```

Esto coincide exactamente con la configuración que `CONTRIBUTING.md` (sección "Python — black + flake8") ya describe como existente — esta tarea simplemente crea el archivo.

### 2. `requirements-dev.txt`

Estado actual:

```
-r requirements.txt

# Development dependencies
pytest>=7.4.4
pytest-django>=4.7.0
coverage>=7.4.1
```

Añade, tras `coverage>=7.4.1`:

```

# Lint / format (ver CONTRIBUTING.md)
flake8>=7.1.0
black>=24.4.0
isort>=5.13.0
```

### 3. `.github/workflows/ci.yml`

Adapta el ejemplo de `ROADMAP.md` (sección "GitHub Actions CI") a las variables de entorno REALES de `config/settings.py` (`DB_NAME`/`DB_USER`/`DB_PASSWORD`/`DB_HOST`/`DB_PORT`, NO `DATABASE_URL`):

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  backend:
    name: Backend (Python)
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    env:
      SECRET_KEY: ci-secret-key-not-for-production
      DEBUG: "True"
      ALLOWED_HOSTS: localhost,127.0.0.1
      DB_ENGINE: django.db.backends.postgresql
      DB_NAME: test_db
      DB_USER: test_user
      DB_PASSWORD: test_pass
      DB_HOST: localhost
      DB_PORT: "5432"

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dependencies
        run: pip install -r requirements-dev.txt

      - name: Lint (flake8)
        run: flake8 .

      - name: Format check (black)
        run: black --check .

      - name: Import order check (isort)
        run: isort --check-only .

      - name: Run migrations
        run: python manage.py migrate --noinput

      - name: Run tests
        run: python manage.py test

  frontend:
    name: Frontend (TypeScript)
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run type-check

      - name: Lint (ESLint)
        run: npm run lint

      - name: Build
        run: npm run build
```

Notas importantes:
- `flake8`/`black`/`isort` se invocan SIN argumentos extra de exclusión/longitud porque esa configuración ya vive en `setup.cfg` (paso 1) — así el comportamiento es idéntico en local (`flake8 .`) y en CI.
- El job `backend` añade un paso `python manage.py migrate --noinput` antes de `manage.py test`. Esto NO está en el ejemplo de `ROADMAP.md`, pero es necesario porque `manage.py test` crea su propia base de datos de test a partir de las migraciones — si alguna migración tiene un problema, este paso lo detecta de forma temprana y con un mensaje de error más claro que el de `manage.py test`. Si por algún motivo `manage.py test` ya falla sin este paso por timeouts, puedes simplificar y quitarlo, documentándolo.
- `pip install -r requirements-dev.txt` ya instala `requirements.txt` (vía `-r requirements.txt` dentro de `requirements-dev.txt`) más `pytest`/`coverage`/`flake8`/`black`/`isort` — no hace falta un segundo `pip install`.

### 4. `frontend/eslint.config.js` (ESLint 9, flat config)

El proyecto usa ESLint 9+ (flat config, `eslint.config.js`, no `.eslintrc`). El frontend es TypeScript puro sin framework de UI (no hay React), así que basta con `@eslint/js` + `typescript-eslint`:

```javascript
// frontend/eslint.config.js
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['dist/', 'static/frontend/dist/', 'node_modules/', '*.timestamp-*.mjs'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // Permite variables/argumentos sin usar si empiezan por "_"
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // El uso de `any` ya existente se mantiene como warning, no error,
      // para no bloquear el CI por deuda técnica preexistente.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
```

Notas:
- Usa reglas `recommended` (no `recommended-type-checked`) para evitar tener que configurar `parserOptions.project` (que ralentiza mucho el lint y requiere mantener sincronizado con `tsconfig.json`'s `include`). Si en el futuro se quiere lint con información de tipos, puede añadirse en una tarea separada.
- `no-unused-vars` y `no-explicit-any` se dejan como `warn` (no `error`) para que el job `frontend` del CI (`npm run lint`) no falle por avisos — solo falla por `error`. Si tras ejecutar `npx eslint .` aparecen errores (no warnings) de otras reglas `recommended` (p.ej. `no-case-declarations`, `no-prototype-builtins`), corrígelos si son triviales (renombrar variable, añadir bloque `{}` en un `case`, etc.) o, si el cambio no es trivial, añade `// eslint-disable-next-line <regla>` con un comentario y anótalo en el resumen final.

### 5. `frontend/package.json`

Añade a `devDependencies` (versiones compatibles con ESLint 9 flat config y TypeScript 5.5):

```json
"@eslint/js": "^9.9.0",
"eslint": "^9.9.0",
"globals": "^15.9.0",
"typescript-eslint": "^8.3.0"
```

Añade a `scripts`:

```json
"lint": "eslint .",
"lint:fix": "eslint . --fix"
```

`package.json` resultante (orden de claves no importa, pero mantén el resto igual):

```json
{
  "name": "repo-sudoe-ai-frontend",
  "version": "2.0.0",
  "description": "Frontend moderno (Vite + TypeScript + Tailwind) para RePo-SUDOE-AI",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "build:fast": "vite build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "devDependencies": {
    "@eslint/js": "^9.9.0",
    "@types/node": "^25.9.1",
    "autoprefixer": "^10.4.19",
    "eslint": "^9.9.0",
    "globals": "^15.9.0",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.5.3",
    "typescript-eslint": "^8.3.0",
    "vite": "^5.3.1"
  },
  "type": "module"
}
```

Tras editar `package.json`, ejecuta `npm install` dentro de `frontend/` para regenerar `package-lock.json` con las nuevas dependencias (el CI usa `npm ci`, que requiere que `package-lock.json` esté sincronizado con `package.json`).

### 6. Limpieza de formato/lint preexistente

Tras crear los archivos de configuración anteriores, ejecuta localmente:

```bash
# Backend
pip install -r requirements-dev.txt
black .
isort .
flake8 .
python manage.py test

# Frontend
cd frontend
npm install
npm run lint:fix
npm run type-check
npm run lint
npm run build
```

- `black .` e `isort .` reformatean automáticamente el código — revisa el diff resultante: debe ser solo cambios de formato (espacios, comillas, orden de imports), nunca cambios de lógica. Haz commit de estos cambios como parte de esta tarea.
- `flake8 .` no debería reportar errores tras el formateo automático (la mayoría de violaciones típicas de flake8 — líneas largas, imports sin usar — las corrige `black`/`isort` o son fáciles de arreglar a mano). Si queda algún error que requiera tocar lógica, usa `# noqa: <código>` puntual con comentario explicativo y anótalo en el resumen final del PR.
- `npm run lint:fix` corrige automáticamente lo que ESLint pueda arreglar (formato de imports, etc.). Revisa los errores restantes (no warnings) y corrige los triviales; para el resto usa `// eslint-disable-next-line <regla>` documentado.
- `python manage.py test` debe pasar sin errores (si algún test ya fallaba antes de esta tarea por motivos no relacionados con lint/CI, NO lo arregles aquí — repórtalo en el resumen final como hallazgo separado, fuera de alcance de esta tarea).

## Dependencias nuevas

- Python (`requirements-dev.txt`): `flake8>=7.1.0`, `black>=24.4.0`, `isort>=5.13.0`.
- npm (`frontend/package.json`, `devDependencies`): `eslint@^9.9.0`, `@eslint/js@^9.9.0`, `typescript-eslint@^8.3.0`, `globals@^15.9.0`.

## Criterios de aceptación / cómo verificar

1. `cat .github/workflows/ci.yml` existe y `actions/checkout`, job `backend` y job `frontend` aparecen definidos; valida la sintaxis YAML con `python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"`.
2. `cat setup.cfg` contiene una sección `[flake8]` con `max-line-length = 120`.
3. Localmente, en la raíz del proyecto: `pip install -r requirements-dev.txt && flake8 . && black --check . && isort --check-only .` termina con exit code 0.
4. `python manage.py migrate --noinput && python manage.py test` termina con exit code 0 (usando una base de datos de test — puede ser sqlite si `DB_ENGINE`/`DB_*` no se sobrescriben para apuntar a un Postgres local, o levantando un Postgres con las credenciales `test_user`/`test_pass`/`test_db` igual que en el workflow).
5. En `frontend/`: `npm install && npm run type-check && npm run lint && npm run build` termina con exit code 0 (los tres comandos).
6. `cat frontend/package.json` contiene los scripts `lint` y `lint:fix`, y `frontend/package-lock.json` ha sido regenerado (su fecha de modificación es posterior a la edición de `package.json`).
7. (Si el repositorio está conectado a GitHub y se hace push de una rama) la pestaña "Actions" muestra el workflow "CI" ejecutándose y ambos jobs (`backend`, `frontend`) terminan en verde. Esta verificación es opcional si no hay acceso al remoto — los puntos 1-6 (ejecución local de los mismos comandos que usa el CI) son suficientes para considerar la tarea completa.

## Fuera de alcance

- No crear `.github/workflows/docker.yml` (build/push de imagen a GHCR) — `ROADMAP.md` lo marca como opcional y no forma parte de esta tarea.
- No crear `.github/ISSUE_TEMPLATE/`, `.github/pull_request_template.md` ni `LICENSE` (tarea `15_licencia_y_plantillas_github.md`).
- No añadir badges al `README.md` (el badge de CI `![CI](.../ci.yml/badge.svg)` puede añadirse en una tarea futura una vez el workflow esté funcionando y el repo sea público; esta tarea no modifica `README.md`).
- No corregir fallos de tests preexistentes que NO estén relacionados con lint/formato (repórtalos en el resumen final, no los arregles aquí).
- No migrar el frontend a React ni añadir reglas de ESLint específicas de React/JSX (el frontend actual es TypeScript puro).
- No configurar `parserOptions.project` / reglas `recommended-type-checked` de `typescript-eslint` (lint con información de tipos) — se deja para una tarea futura si se considera necesario.
- No modificar `docker-compose.yml`, `Dockerfile`, ni ningún archivo de `accounts/`, `core/`, `config/` salvo los cambios de formato (`black`/`isort`) descritos en el punto 6 de la especificación.
