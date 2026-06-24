# LICENSE + plantillas de GitHub (issues / pull requests)

## Contexto

`RePo-SUDOE-AI_v2` es una plataforma Django de docking molecular asistido por IA, en preparación para publicación pública en GitHub (`ROADMAP.md`, Fase 6 — "Preparación OpenSource", dificultad Baja).

El repositorio YA tiene gran parte de la Fase 6 resuelta:
- `.gitignore` (65 líneas) ya existe y es completo (Python/Django, entornos virtuales, Node/frontend, archivos de sistema, etc.) — **no requiere cambios** en esta tarea.
- `CONTRIBUTING.md` (202 líneas) ya existe, con secciones "Cómo reportar bugs", "Cómo proponer nuevas funcionalidades" y "Proceso de Pull Request". Hace referencia explícita a una plantilla **Bug Report**, una plantilla **Feature Request** (línea ~10 y ~20) y a "la plantilla" de Pull Request (línea ~60) — pero estas plantillas NO EXISTEN todavía (no hay directorio `.github/`).
- `README.md` ya incluye el badge `![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)` (sección de cabecera) — pero el archivo `LICENSE` con el texto legal NO existe en la raíz del repositorio.

Esta tarea rellena esos huecos: crea el archivo `LICENSE` (Apache License 2.0, recomendada por `ROADMAP.md` Fase 6 por su cláusula de patentes y compatibilidad con proyectos científicos) y el directorio `.github/` con las plantillas de Issues y Pull Requests que `CONTRIBUTING.md` ya da por existentes.

Es una tarea puramente de documentación/metadatos de repositorio: no toca código de la aplicación (`accounts/`, `core/`, `frontend/`, `config/`).

## Objetivo

Al terminar, debe existir un archivo `LICENSE` en la raíz con el texto completo de la Apache License 2.0, y un directorio `.github/` con `ISSUE_TEMPLATE/bug_report.md`, `ISSUE_TEMPLATE/feature_request.md`, `ISSUE_TEMPLATE/config.yml` y `pull_request_template.md`, de forma que las referencias ya existentes en `CONTRIBUTING.md` ("plantilla Bug Report", "plantilla Feature Request", "la plantilla" de PR) apunten a archivos reales que GitHub usa automáticamente al crear un Issue o Pull Request.

## Pre-requisitos

Ninguna. Tarea independiente — no comparte archivos con ninguna otra tarea de `agent_plans/` (no toca `.gitignore`, que ya gestiona la tarea... en realidad ninguna otra tarea modifica `.gitignore`; si en el futuro otra tarea necesitara tocarlo, coordinar para evitar conflictos, pero a fecha de esta tarea no hay conflicto). Puede desarrollarse en paralelo con cualquier otra tarea de `agent_plans/`, incluida `16_ci_github_actions.md` (no comparten archivos: esta tarea no toca `.github/workflows/`).

## Archivos a crear/modificar

- `LICENSE` (nuevo, raíz del proyecto): texto completo de Apache License 2.0.
- `.github/ISSUE_TEMPLATE/bug_report.md` (nuevo).
- `.github/ISSUE_TEMPLATE/feature_request.md` (nuevo).
- `.github/ISSUE_TEMPLATE/config.yml` (nuevo): desactiva la creación de issues "en blanco" y enlaza a Discussions/CONTRIBUTING.
- `.github/pull_request_template.md` (nuevo).

NO modifica `.gitignore`, `CONTRIBUTING.md` ni `README.md` (sus referencias a las plantillas y el badge de licencia ya son correctas una vez existan estos archivos).

## Especificación detallada

### 1. `LICENSE` (raíz del proyecto)

Copia el texto íntegro y SIN MODIFICAR de la Apache License 2.0 (disponible públicamente en `https://www.apache.org/licenses/LICENSE-2.0.txt`), sustituyendo únicamente los placeholders `[yyyy]` y `[name of copyright owner]` del bloque final ("APPENDIX: How to apply...") por el año actual y el nombre del proyecto/autores. El cuerpo legal (secciones 1-9 + `APPENDIX`) NO debe alterarse.

Estructura completa esperada (resumen — usa el texto oficial completo, no lo abrevies):

```
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.
   ... (texto oficial completo de las secciones 1 a 9) ...

   END OF TERMS AND CONDITIONS

   APPENDIX: How to apply the Apache License to your work.

      To apply the Apache License to your work, attach the following
      boilerplate notice, with the fields enclosed by brackets "[]"
      replaced with your own identifying information. (Don't include
      the brackets!)  The text should be enclosed in the appropriate
      comment syntax for the file format. We also recommend that a
      file or class name and description of purpose be included on the
      same "printed page" as the copyright notice for easier
      identification within third-party archives.

   Copyright 2025-2026 RePo-SUDOE-AI Contributors

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
```

Notas:
- El texto legal completo de las secciones "TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION" (1 a 9) debe copiarse íntegro desde `https://www.apache.org/licenses/LICENSE-2.0.txt` — es texto legal estándar, de dominio público para este uso (la propia licencia anima explícitamente a copiarlo).
- Usa "RePo-SUDOE-AI Contributors" como `[name of copyright owner]` (o el nombre que el usuario indique si lo especifica al revisar el PR) y el año `2025-2026` (coherente con el pie de `ROADMAP.md`: "TFG 2025/2026").
- No es necesario (ni recomendable) modificar el badge de licencia en `README.md`: ya dice `Apache_2.0` y es correcto.

### 2. `.github/ISSUE_TEMPLATE/bug_report.md`

Sigue el formato de "Issue Forms" clásico de GitHub (Markdown con front-matter YAML):

```markdown
---
name: "\U0001F41B Bug report"
about: Reporta un comportamiento inesperado o un error en RePo-SUDOE-AI
title: "[BUG] "
labels: bug
assignees: ''
---

## Descripción del bug

Una descripción clara y concisa de cuál es el problema.

## Pasos para reproducir

1. Ve a '...'
2. Haz clic en '...'
3. Desplázate hasta '...'
4. Observa el error

## Comportamiento esperado

Qué esperabas que ocurriera.

## Comportamiento actual

Qué ocurre realmente (incluye mensajes de error completos si los hay).

## Capturas de pantalla

Si aplica, añade capturas de pantalla para ayudar a explicar el problema.

## Entorno

- SO: [p.ej. Ubuntu 22.04, Windows 11 + WSL2]
- Versión de Docker / Docker Compose: [p.ej. Docker 24.0, Compose v2.20]
- Modo de ejecución: [Docker Compose / desarrollo local sin Docker]
- Proveedor de IA configurado: [OpenAI / Anthropic / Google / Ollama]
- Navegador (si aplica): [p.ej. Chrome 124]

## Logs relevantes

```
Pega aquí la salida de `docker compose logs web` o el traceback de Django
```

## Contexto adicional

Cualquier otra información relevante sobre el problema.
```

### 3. `.github/ISSUE_TEMPLATE/feature_request.md`

```markdown
---
name: "✨ Feature request"
about: Propón una nueva funcionalidad o mejora para RePo-SUDOE-AI
title: "[FEATURE] "
labels: enhancement
assignees: ''
---

## ¿Tu propuesta está relacionada con un problema? Descríbelo.

Una descripción clara de cuál es el problema. P.ej. "Me resulta frustrante cuando [...]"

## Describe la solución que te gustaría

Una descripción clara y concisa de qué quieres que ocurra.

## Describe alternativas que hayas considerado

Una descripción de cualquier solución o funcionalidad alternativa que hayas considerado.

## Fase del ROADMAP relacionada (si aplica)

¿Esta propuesta encaja en alguna de las fases descritas en `ROADMAP.md`? (Fase 1-6, o "fuera del roadmap actual")

## Contexto adicional

Cualquier otro contexto, mockups, o capturas de pantalla sobre la solicitud de funcionalidad.
```

### 4. `.github/ISSUE_TEMPLATE/config.yml`

```yaml
blank_issues_enabled: false
contact_links:
  - name: Preguntas y discusión general
    url: https://github.com/isecu33/RePo-SUDOE-AI/discussions
    about: Para preguntas generales o ideas que aún no son una propuesta concreta, usa Discussions en lugar de un Issue.
  - name: Guía de contribución
    url: https://github.com/isecu33/RePo-SUDOE-AI/blob/main/CONTRIBUTING.md
    about: Lee CONTRIBUTING.md antes de abrir un Issue o Pull Request.
```

Nota: `isecu33/RePo-SUDOE-AI` es el organización/repositorio referenciado en los enlaces ya existentes de `CONTRIBUTING.md` (p.ej. línea ~10, "Issues existentes"); reutiliza esa misma ruta para consistencia. Si al revisar el PR el usuario indica un nombre de repositorio distinto, ajusta esta URL y las de `CONTRIBUTING.md` de forma coherente (aunque modificar `CONTRIBUTING.md` está fuera del alcance de esta tarea salvo que sea estrictamente necesario para esta consistencia).

### 5. `.github/pull_request_template.md`

Debe alinearse con la sección "Proceso de Pull Request" de `CONTRIBUTING.md` (checklist de lint/tests/build mencionado en esa sección):

```markdown
## Descripción

Describe brevemente qué cambia este PR y por qué.

Issue relacionado: Closes #

## Tipo de cambio

- [ ] Corrección de bug (`fix/...`)
- [ ] Nueva funcionalidad (`feature/...`)
- [ ] Cambio en documentación
- [ ] Refactor / mejora interna sin cambio de comportamiento
- [ ] Otro (especifica):

## Checklist

- [ ] He leído `CONTRIBUTING.md`.
- [ ] El backend pasa lint y tests:
  ```bash
  flake8 . --max-line-length=120 --exclude=migrations,venv
  black --check . --exclude='/(migrations|venv)/'
  python manage.py test
  ```
- [ ] El frontend compila y pasa lint (si aplica):
  ```bash
  cd frontend && npm run type-check && npm run lint && npm run build
  ```
- [ ] He añadido/actualizado tests si era necesario.
- [ ] He actualizado la documentación (`README.md`, `ROADMAP.md`, `agent_plans/`, etc.) si el cambio lo requiere.
- [ ] No he incluido archivos `.env`, claves de API ni credenciales en el commit.

## Capturas de pantalla (si aplica)

Añade capturas si el cambio afecta a la interfaz de usuario.
```

## Dependencias nuevas

Ninguna.

## Criterios de aceptación / cómo verificar

1. `LICENSE` existe en la raíz del proyecto, empieza por `Apache License` / `Version 2.0, January 2004` y contiene las 9 secciones de "TERMS AND CONDITIONS" más el `APPENDIX` con un aviso de copyright (no placeholders `[yyyy]`/`[name of copyright owner]` sin rellenar).
2. `.github/ISSUE_TEMPLATE/bug_report.md`, `.github/ISSUE_TEMPLATE/feature_request.md` y `.github/ISSUE_TEMPLATE/config.yml` existen y son YAML/Markdown válidos (el front-matter entre `---` debe ser YAML válido — verifica con cualquier parser YAML, p.ej. `python -c "import yaml,sys; yaml.safe_load(open('.github/ISSUE_TEMPLATE/bug_report.md').read().split('---')[1])"`).
3. `.github/pull_request_template.md` existe.
4. Verifica con `grep -rn "plantilla\|template" CONTRIBUTING.md` que las menciones a "plantilla Bug Report" / "plantilla Feature Request" / "la plantilla" (PR) ahora corresponden a archivos existentes en `.github/`.
5. (Si el repositorio ya está conectado a GitHub) Al crear un nuevo Issue desde la interfaz web de GitHub, deben aparecer las opciones "Bug report" y "Feature request" (y, si `config.yml` tiene `blank_issues_enabled: false`, NO debe aparecer la opción de "issue en blanco"). Al abrir un Pull Request, su descripción debe rellenarse automáticamente con el contenido de `pull_request_template.md`. Esta verificación es opcional si no hay acceso al repositorio remoto en este momento — la presencia y validez sintáctica de los archivos (puntos 1-4) es suficiente para considerar la tarea completa.

## Fuera de alcance

- No modificar `.gitignore` (ya está completo y correcto; `input/*.pdb` son datos de referencia versionados intencionadamente, no excluir).
- No modificar `CONTRIBUTING.md` salvo el ajuste mínimo de URL descrito en la nota de la sección 4 (si aplica).
- No modificar `README.md` (el badge de licencia ya es correcto).
- No crear `.github/workflows/ci.yml` ni `.github/workflows/docker.yml` (tarea `16_ci_github_actions.md`).
- No crear `CODE_OF_CONDUCT.md` (no referenciado por `CONTRIBUTING.md` actual; fuera del alcance de la Fase 6 tal como está descrita).
- No tocar código de `accounts/`, `core/`, `frontend/`, `config/`.
