# RUNBOOK — Sistema de Instrucciones Médicas Tácticas (FANB)

## 1. Diagnóstico

### Health Check
```bash
curl http://localhost:3001/api/health
# → { "status": "ok" }
```

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

---

## 2. Protocolo de Caída (Crash)

### Síntomas
- Health check responde 5xx o timeout
- Logs de error con eventos `EXPRESS_ERROR`, `UNCAUGHT_EXCEPTION`, `UNHANDLED_REJECTION`
- Usuarios reportan "Error interno del servidor" con `correlationId`

### Diagnóstico Rápido (5 min)

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

### Reinicio Controlado
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
```

### Escalación
Si el error persiste después de 2 reinicios:
1. Revisar variables de entorno: `$env:JWT_SECRET`, `$env:FRONTEND_URL`, `$env:DATABASE_URL`
2. Verificar modelo Vosk: `Test-Path backend/model/vosk-model-small-es-0.42`
3. Revisar `combined.log` completo en busca del evento que precedió al crash
4. Contactar al equipo de desarrollo con el correlationId del último error

---

## 3. Recuperación ante Desastres

### Backup de Base de Datos

**SQLite (desarrollo):**
```bash
# Backup manual
Copy-Item backend/chatbotmilitar.db backend/backups/chatbotmilitar-$(Get-Date -Format "yyyyMMdd_HHmmss").db

# Restaurar
Copy-Item backend/backups/chatbotmilitar-20260101_120000.db backend/chatbotmilitar.db
```

**PostgreSQL (producción/Render):**
```bash
# Backup
pg_dump $DATABASE_URL > backend/backups/dump-$(date +%Y%m%d_%H%M%S).sql

# Restaurar
psql $DATABASE_URL < backend/backups/dump-20260101_120000.sql
```

### Restaurar desde Cero

```bash
# 1. Clonar repositorio
git clone <repo-url>
cd proyecto

# 2. Instalar dependencias
cd backend; npm install

# 3. Descargar modelo Vosk
# (manual: descargar vosk-model-small-es-0.42 en backend/model/)

# 4. Configurar variables de entorno (.env o Render dashboard)
#  JWT_SECRET=<clave-secreta>
#  FRONTEND_URL=https://<frontend-url>
#  DATABASE_URL=<postgres-url>  # solo producción

# 5. Iniciar
node server.js

# 6. Verificar
curl http://localhost:3001/api/health
```

### Rollback de Código

```bash
# Deshacer último commit (manteniendo cambios locales)
git revert HEAD

# O volver a un commit específico
git reset --hard <commit-hash>

# Commits de referencia:
# 666f16d — tema verde militar + carta náutica
# 9978d29 — fix edit redirect + vista soldado
```

### Tokens JWT — Rotación de Secreto

Si el `JWT_SECRET` se compromete:
1. Cambiar `JWT_SECRET` en variables de entorno
2. Todos los usuarios existentes deben volver a iniciar sesión (sus tokens serán inválidos)
3. Verificar que `POST /medicos/login` y `POST /api/admin/login` siguen funcionando

---

## 4. Monitoreo Preventivo

### Cada hora (automático en producción)
- Health check responde 200
- Logs de error no crecen desmedidamente

### Cada deploy
```bash
# Verificar que los tokens funcionan
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
Agregar cron job / scheduled task:
```
# Ejecutar diario a las 3 AM
0 3 * * * cd /ruta/proyecto/backend && pg_dump $DATABASE_URL > backups/dump-$(date +\%Y\%m\%d).sql
```

---

## 5. Referencias Rápidas

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

### Comandos Útiles
```bash
# Buscar un correlationId en logs
Select-String -Path backend/logs/combined.log -Pattern "CORRELATION_ID"

# Ver últimas 10 peticiones exitosas
Select-String -Path backend/logs/combined.log -Pattern "SERVER_START|DB_CONNECTED"

# Contar errores por tipo en el último día
Select-String -Path backend/logs/error.log -Pattern '"event":"' | Group-Object
```
