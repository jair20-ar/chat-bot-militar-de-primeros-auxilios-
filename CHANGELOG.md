# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Estructura inicial del proyecto ChatBot Militar de Primeros Auxilios

### Changed

### Deprecated

### Removed

### Fixed

### Security

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