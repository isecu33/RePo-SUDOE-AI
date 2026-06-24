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
