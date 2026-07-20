# RUNBOOK — Sistema de Instrucciones Médicas Tácticas (FANB)

## Fase #1: Diagnóstico (L1 — Operador)

### Health Check
```bash
curl http://localhost:3001/api/health
# → { "status": "ok" }
```
Si responde distinto a 200, el servicio está caído.

### Logs
```bash
# Todos los eventos
cat backend/logs/combined.log | tail -50

# Solo errores
cat backend/logs/error.log | tail -20

# Live tail (Linux/Mac)
tail -f backend/logs/combined.log

# Live tail (Windows PowerShell)
Get-Content -Path backend/logs/combined.log -Wait
```

### Verificar servidor activo
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001
# → 200 (o 302 si redirige)
```

### Verificar conexión BD
```bash
# SQLite: el archivo existe
ls -la backend/chatbotmilitar.db

# PostgreSQL: conectar directo
psql $DATABASE_URL -c "SELECT 1;"
```

### Verificar modelo Vosk
```bash
Test-Path backend/model/vosk-model-small-es-0.42
# → True
```

---

## Fase #2: Protocolo ante Caídas

### Nivel L1 — Operador (0–5 min)

**Síntomas:**
- Health check responde 5xx o timeout
- Logs de error con eventos `EXPRESS_ERROR`, `UNCAUGHT_EXCEPTION`, `UNHANDLED_REJECTION`
- Usuarios reportan "Ocurrió un error. Reporte el código: [UUID]"

**Acciones:**
```bash
# 1. ¿El proceso existe?
Get-Process -Name "node" -ErrorAction SilentlyContinue

# 2. Últimos errores
Get-Content backend/logs/error.log -Tail 20

# 3. ¿Puerto ocupado?
netstat -ano | findstr ":3001"

# 4. ¿BD responde?
# SQLite: verificar integridad
sqlite3 backend/chatbotmilitar.db "PRAGMA integrity_check;"

# 5. ¿Espacio en disco?
Get-PSDrive C | Select-Object Used, Free
```

**Reinicio controlado:**
```bash
# 1. Matar proceso actual
Get-Process -Name "node" | Stop-Process -Force

# 2. Limpiar archivos temporales
Remove-Item -Path backend/uploads/* -Force -ErrorAction SilentlyContinue

# 3. Verificar que el puerto esté libre
$portCheck = netstat -ano | findstr ":3001"
if (-not $portCheck) { "Puerto 3001 libre" }

# 4. Iniciar
Set-Location -LiteralPath "backend"
node server.js

# 5. Verificar
curl http://localhost:3001/api/health
```

### Nivel L2 — Especialista (5–15 min)

Si tras 2 reinicios el error persiste:

1. **Revisar variables de entorno:**
   ```bash
   echo $env:JWT_SECRET
   echo $env:FRONTEND_URL
   echo $env:DATABASE_URL
   ```

2. **Verificar modelo Vosk:** `Test-Path backend/model/vosk-model-small-es-0.42`

3. **Analizar logs completos** en busca del evento que precedió al crash:
   ```bash
   Select-String -Path backend/logs/combined.log -Pattern "UNCAUGHT_EXCEPTION|UNHANDLED_REJECTION" -Context 2,5
   ```

4. **Probar conexión a base de datos:**
   ```bash
   node -e "const db = require('./db'); db.get('SELECT 1', [], (e,r) => console.log(e || r));"
   ```

5. **Verificar integridad de tablas:**
   ```bash
   node -e "const db = require('./db'); db.all(\"SELECT name FROM sqlite_master WHERE type='table'\", [], (e,r) => console.log(e || r));"
   ```

### Nivel L3 — Ingeniero de Desarrollo (15 min+)

Si el error no se resuelve en L2:

1. **Restaurar versión anterior:**
   ```bash
   git log --oneline -10
   git revert HEAD
   # o git reset --hard <commit-hash-anterior>
   ```

2. **Restaurar base de datos desde backup** (ver Fase #3)

3. **Reproducir el error en entorno local** usando los correlationId del incidente:
   ```bash
   Select-String -Path backend/logs/combined.log -Pattern "<CORRELATION_ID>"
   ```

4. **Escalar al equipo de desarrollo** con:
   - Correlation ID del error
   - Logs completos (error.log + combined.log)
   - Pasos para reproducir
   - Variables de entorno (sanitizadas, sin secretos)

---

## Fase #3: Recuperación ante Desastres

### Regla 3-2-1 de Respaldos
| Concepto | Implementación |
|----------|---------------|
| **3** copias de los datos | Producción + Backup local + Backup externo (Render) |
| **2** medios diferentes | Disco local + PostgreSQL dump |
| **1** copia fuera del sitio | Backup en Render / almacenamiento externo |

### Backup de Base de Datos

**SQLite (desarrollo):**
```bash
# Backup manual (copia #2 — disco local)
Copy-Item backend/chatbotmilitar.db backend/backups/chatbotmilitar-$(Get-Date -Format "yyyyMMdd_HHmmss").db

# Restaurar
Copy-Item backend/backups/chatbotmilitar-20260101_120000.db backend/chatbotmilitar.db
```

**PostgreSQL (producción/Render):**
```bash
# Backup (copia #2 — dump SQL)
pg_dump $DATABASE_URL > backend/backups/dump-$(date +%Y%m%d_%H%M%S).sql

# Restaurar
psql $DATABASE_URL < backend/backups/dump-20260101_120000.sql
```

### Restaurar desde Cero (aplica regla 3-2-1)

```bash
# 1. Clonar repositorio (copia #1: código fuente)
git clone <repo-url>
cd chatbot-militar

# 2. Restaurar dump más reciente (copia #2: backup SQL)
psql $DATABASE_URL < backend/backups/dump-20260101_120000.sql

# 3. Instalar dependencias
cd backend; npm install

# 4. Descargar modelo Vosk si no existe
# (manual: descargar vosk-model-small-es-0.42 en backend/model/)

# 5. Configurar variables de entorno (.env o Render dashboard)
#  JWT_SECRET=<clave-secreta>
#  FRONTEND_URL=https://<frontend-url>
#  DATABASE_URL=<postgres-url>

# 6. Iniciar
node server.js

# 7. Verificar
curl http://localhost:3001/api/health
```

### Rollback de Código
```bash
# Deshacer último commit (manteniendo cambios locales)
git revert HEAD

# O volver a un commit específico
git reset --hard <commit-hash>
```

### Tokens JWT — Rotación de Secreto
Si el `JWT_SECRET` se compromete:
1. Cambiar `JWT_SECRET` en variables de entorno
2. Todos los usuarios existentes deben volver a iniciar sesión
3. Verificar `POST /medicos/login` y `POST /api/admin/login`

---

## Monitoreo Preventivo

### Cada hora (automático en producción)
- Health check responde 200
- Logs de error no crecen desmedidamente

### Cada deploy
```bash
# Verificar health
curl http://localhost:3001/api/health

# Login admin:
curl -X POST http://localhost:3001/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"UNEFA2026"}'

# Login médico:
curl -X POST http://localhost:3001/medicos/login \
  -H "Content-Type: application/json" \
  -d '{"id_medico":"DOC001","password":"..."}'
```

### Backup automático (recomendado)
```bash
# Cron job: ejecutar diario a las 3 AM
0 3 * * * cd /ruta/chatbot-militar/backend && pg_dump $DATABASE_URL > backups/dump-$(date +\%Y\%m\%d).sql
```

---

## Referencias Rápidas

| Recurso | Ruta |
|---------|------|
| Log de eventos | `backend/logs/combined.log` |
| Log de errores | `backend/logs/error.log` |
| Base de datos | `backend/chatbotmilitar.db` (SQLite) / `$DATABASE_URL` (PostgreSQL) |
| Modelo Vosk | `backend/model/vosk-model-small-es-0.42` |
| Uploads temp | `backend/uploads/` |
| Frontend | `frontend/html/` |
| Middleware auth | `backend/middleware/auth.js` |
| Logger | `backend/middleware/logger.js` |
| Validación | `backend/middleware/validate.js` |
| Correlation ID | `backend/middleware/correlation.js` |
| Tests | `backend/__tests__/` |

### Comandos Útiles
```bash
# Buscar un correlationId en logs
Select-String -Path backend/logs/combined.log -Pattern "CORRELATION_ID"

# Ver últimas 10 peticiones exitosas
Select-String -Path backend/logs/combined.log -Pattern "SERVER_START|DB_CONNECTED"

# Contar errores por tipo en el último día
Select-String -Path backend/logs/error.log -Pattern '"event":"' | Group-Object

# Ejecutar tests
cd backend; npm test
```
