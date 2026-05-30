# Guía de Contribución - ChatBot Militar de Primeros Auxilios

Gracias por contribuir a este proyecto. Este documento define las reglas de desarrollo, convenciones de nombres de ramas y estándares de commits.

---

## 📋 Tabla de Contenidos

1. [GitFlow Workflow](#gitflow-workflow)
2. [Estructura de Ramas](#estructura-de-ramas)
3. [Conventional Commits](#conventional-commits)
4. [Proceso de Pull Request](#proceso-de-pull-request)
5. [Configuración del Entorno](#configuración-del-entorno)

---

## GitFlow Workflow

Utilizamos **GitFlow** como modelo de ramificación. Este workflow garantiza que la rama `main` siempre contenga código estable y listo para producción.

### Ramas Principales

- **`main`** - Rama de producción. Solo se fusionan releases que han pasado todas las pruebas. **PROTEGIDA**: requiere PR y aprobación.
- **`develop`** - Rama de desarrollo. Base para nuevas características y versiones.

### Ramas Secundarias

- **`feature/*`** - Nuevas características
- **`bugfix/*`** - Corrección de bugs en desarrollo
- **`hotfix/*`** - Correcciones críticas de producción
- **`release/*`** - Preparación de nuevas versiones

---

## Estructura de Ramas

### 1. Crear una rama de Feature (nueva funcionalidad)

```bash
git checkout develop
git pull origin develop
git checkout -b feature/nombre-descriptivo
```

**Formato**: `feature/<descripción-breve>`

**Ejemplos válidos:**
- `feature/agregar-autenticacion`
- `feature/mejorar-interface-voz`
- `feature/nueva-seccion-emergencias`

### 2. Crear una rama de Bugfix

```bash
git checkout develop
git pull origin develop
git checkout -b bugfix/nombre-del-problema
```

**Formato**: `bugfix/<descripción-breve>`

**Ejemplos válidos:**
- `bugfix/corregir-error-diccionario`
- `bugfix/arreglar-sintesis-voz`

### 3. Crear una rama de Hotfix (para producción)

```bash
git checkout main
git pull origin main
git checkout -b hotfix/descripcion-critica
```

**Formato**: `hotfix/<descripción-breve>`

**Ejemplos válidos:**
- `hotfix/parche-seguridad-critico`
- `hotfix/arreglo-fallo-produccion`

### 4. Crear una rama de Release

```bash
git checkout develop
git pull origin develop
git checkout -b release/v1.0.0
```

**Formato**: `release/v<MAJOR>.<MINOR>.<PATCH>` (Semantic Versioning)

**Ejemplos válidos:**
- `release/v1.0.0`
- `release/v1.1.0`
- `release/v2.0.0`

---

## Conventional Commits

Todos los commits deben seguir el estándar **Conventional Commits**. Esto facilita la automatización de changelogs y la identificación de cambios importantes.

### Formato

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Tipos de Commits

- **`feat`** - Nueva funcionalidad
- **`fix`** - Corrección de bug
- **`docs`** - Cambios en documentación
- **`style`** - Cambios de formato (espacios, comas, etc.)
- **`refactor`** - Refactorización de código sin cambiar funcionalidad
- **`perf`** - Mejoras de rendimiento
- **`test`** - Adición o modificación de tests
- **`chore`** - Cambios en configuración, dependencias, etc.
- **`ci`** - Cambios en configuración de CI/CD

### Scope (Opcional)

Describe el área del código afectada:
- `core`
- `api`
- `ui`
- `auth`
- `voice`
- `db`

### Subject (Obligatorio)

- Usa modo imperativo ("agregar", no "agregado" o "agrega")
- No comiences con mayúscula
- No termines con punto
- Máximo 50 caracteres

### Body (Opcional)

- Explica **qué** y **por qué**, no **cómo**
- Usa modo imperativo
- Incluye motivación para el cambio

### Footer (Opcional)

- Referencia issues: `Closes #123`
- Cambios breaking: `BREAKING CHANGE: descripción`

### Ejemplos Válidos

```
feat(voice): agregar soporte para múltiples idiomas
```

```
fix(core): corregir error de sincronización en el diccionario

El diccionario no se sincronizaba correctamente cuando se 
realizaban múltiples actualizaciones simultáneamente.

Closes #45
```

```
docs: actualizar README con instrucciones de instalación
```

```
refactor(api): simplificar lógica de autenticación

BREAKING CHANGE: el endpoint /auth/login ahora retorna 
un token JWT en lugar de una sesión
```

---

## Proceso de Pull Request

### 1. Antes de hacer Push

```bash
# Asegúrate de que tu rama está actualizada
git pull origin feature/tu-rama

# Verifica que los tests pasen
npm test

# Verifica que el código cumpla con los estándares
npm run lint
```

### 2. Push a tu rama

```bash
git push origin feature/tu-rama
```

### 3. Crear Pull Request

- Ve a GitHub y abre un Pull Request desde tu rama hacia `develop`
- **Título**: Usa el mismo formato de Conventional Commits
- **Descripción**: Incluye:
  - Qué cambios realizaste
  - Por qué los hiciste
  - Cómo se pueden probar
  - Referencias a issues (e.g., `Closes #123`)

### 4. Revisión de Código (Peer Review)

- Mínimo 1 aprobación requerida
- Los cambios deben ser aprobados antes de fusionar
- Se pueden sugerir cambios antes de aprobar
- Los conflictos deben resolverse

### 5. Fusionar Pull Request

Una vez aprobado:

```bash
# En tu rama local
git checkout develop
git pull origin develop
git merge feature/tu-rama
git push origin develop
```

O usa el botón de "Squash and merge" en GitHub si lo prefieres.

### 6. Eliminar rama después de fusionar

```bash
git branch -d feature/tu-rama
git push origin --delete feature/tu-rama
```

---

## Configuración del Entorno

### Requisitos

- Node.js v14.0.0 o superior
- npm v6.0.0 o superior

### Instalación

1. **Clona el repositorio**

```bash
git clone https://github.com/jair20-ar/chat-bot-militar-de-primeros-auxilios-.git
cd chat-bot-militar-de-primeros-auxilios-
```

2. **Crea el archivo `.env`**

```bash
cp .env.example .env
# Edita .env con tus valores
```

3. **Instala las dependencias**

```bash
cd chatbot-militar/backend
npm install
```

4. **Inicia el servidor de desarrollo**

```bash
npm start
```

---

## Reglas de la Rama `main`

⚠️ **LA RAMA `main` ESTÁ PROTEGIDA**

- ❌ No se puede hacer push directo a `main`
- ✅ Todos los cambios deben venir a través de Pull Request
- ✅ Requiere mínimo 1 aprobación antes de fusionar
- ✅ Todos los checks deben pasar (CI/CD, linting, tests)

---

## Preguntas o Dudas

Si tienes preguntas sobre el flujo de trabajo, crea una issue o contacta al equipo de desarrollo.

¡Gracias por contribuir! 🎖️