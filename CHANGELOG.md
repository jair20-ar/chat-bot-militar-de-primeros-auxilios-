# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Modo offline-first con IndexedDB, Service Worker y PWA
- Motor de sincronización (sync.js) para descargar/subir datos offline
- Endpoints de sync: GET /api/sync/full y POST /api/sync/upload
- Indicador visual ONLINE/OFFLINE en tiempo real
- Pipeline CI/CD con GitHub Actions (lint + tests)
- ESLint configurado con reglas mínimas
- Instrucciones de Docker en README
- Diagrama de arquitectura offline-first en README (Mermaid)

### Changed
- Proyecto renombrado de "TACMED FANB" a "X-60"
- README.md reescrito con documentación completa (Docker, PWA, API, estructura)
- .env.example actualizado con variables reales (JWT_SECRET, FRONTEND_URL, DATABASE_URL)
- docker-compose.yml con restart: always para auto-recuperación
- Mensaje de error 500: "Ocurrió un error. Reporte el código: [UUID]"
- RUNBOOK.md movido a raíz del proyecto con niveles L1/L2/L3 + regla 3-2-1

### Fixed
- Health check route estaba después del handler 404 (siempre retornaba 404)
- Variables unused en catch blocks (lint warnings)

### Security
- Sanitización XSS con .escape() y customSanitizer en validate.js
- Validación de archivos de audio en POST /api/transcribir (fileFilter multer)
- Graceful shutdown en uncaughtException/unhandledRejection
- Correlation ID en todos los endpoints para trazabilidad

---

## [1.0.0] - 2026-05-30

### Added
- Inicialización del repositorio
- Configuración de GitFlow
- Documentación de contribución
- Archivos de configuración (.gitignore, .env.example)
- Estándares de Conventional Commits

---

## Notas sobre Versionado

Este proyecto sigue [Semantic Versioning](https://semver.org/):

- **MAJOR** - Cambios incompatibles (v1.0.0 → v2.0.0)
- **MINOR** - Nuevas características compatibles (v1.0.0 → v1.1.0)
- **PATCH** - Correcciones de bugs (v1.0.0 → v1.0.1)

### Ejemplos de cambios en CHANGELOG:

#### Nueva Característica (MINOR)
```
### Added
- feat(voice): agregar soporte para múltiples idiomas
```

#### Corrección de Bug (PATCH)
```
### Fixed
- fix(core): corregir error de sincronización en diccionario
```

#### Cambio Breaking (MAJOR)
```
### Changed
- BREAKING CHANGE: cambio de estructura de API
- refactor(api): rediseño completo de endpoints
```

---

## Cómo Actualizar este Archivo

Cuando hagas un release, actualiza este archivo con los cambios de la sección `[Unreleased]`:

1. Crea una nueva sección con el número de versión y la fecha
2. Mueve los cambios de `[Unreleased]` a la nueva sección
3. Crea un nuevo `[Unreleased]` vacío arriba
4. Haz commit con: `chore: actualizar CHANGELOG para v1.0.0`

---

## Referencias

- [Keep a Changelog](https://keepachangelog.com/)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)