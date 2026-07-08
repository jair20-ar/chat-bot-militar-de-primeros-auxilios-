const express = require('express');
const multer = require('multer');
const fs = require('fs');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db');
const path = require('path');
const { Model, Recognizer } = require('vosk');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const bcrypt = require('bcryptjs');
const { signToken, verifyToken, requireAdmin } = require('./middleware/auth');
const { registroMedico, loginMedico, loginAdmin, instruccion, logBusqueda, configUpdate } = require('./middleware/validate');
const { correlationMiddleware } = require('./middleware/correlation');
const { logEvent, logError } = require('./middleware/logger');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = process.env.PORT || 3001;
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const upload = multer({ dest: uploadsDir, limits: { fileSize: 10 * 1024 * 1024 } });


const modelpath = path.join(__dirname, 'model', 'vosk-model-small-es-0.42');
if (!fs.existsSync(modelpath)) {
  logError('MODEL_PATH_ERROR', new Error('Model folder not found'), { path: modelpath });
  process.exit(1);
}

const model = new Model(modelpath);


// =================== MIDDLEWARE ===================
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(bodyParser.json({ limit: '1mb' }));
app.use(bodyParser.urlencoded({ limit: '1mb', extended: true }));

// Rate limiting: login (5 intentos/minuto)
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos. Intenta de nuevo en 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting: general (100 peticiones/minuto)
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Demasiadas peticiones. Intenta de nuevo en 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(correlationMiddleware);

app.use('/api/', generalLimiter);

// Rate limit estricto en rutas de login
app.use('/medicos/login', loginLimiter);
app.use('/api/admin/login', loginLimiter);

// =============== Servir frontend estático ===============
app.use(express.static(path.join(__dirname, '../frontend/html')));
app.use('/imagenes', express.static(path.join(__dirname, '../frontend/imagenes')));
app.use('/js', express.static(path.join(__dirname, '../frontend/js')));
app.use('/styles', express.static(path.join(__dirname, '../frontend/styles')));

// ======================= API =========================

app.post('/api/transcribir', upload.single('audio'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Archivo de audio no recibido' });
    }

    const inputPath = req.file.path;
    const outputPath = inputPath + '.wav';

    ffmpeg(inputPath)
        .toFormat('wav')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('end', () => {
            const fileStream = fs.createReadStream(outputPath, { highWaterMark: 4096 });
            const rec = new Recognizer({ model: model, sampleRate: 16000 });

            fileStream.on('data', (chunk) => {
                rec.acceptWaveform(chunk);
            });

            fileStream.on('end', () => {
                const result = rec.finalResult();
                rec.free();

                if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
                if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

                res.json({ text: result.text });
            });
        })
        .on('error', (err) => {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            res.status(500).json({ error: 'Error en la conversion de audio' });
        })
        .save(outputPath);
});

// ================ RUTA PARA REGISTRO DE MÉDICOS ================
app.post('/medicos/registro', registroMedico, async (req, res) => {
  const { nombre, email, cedula, especializacion, password, codigo_registro } = req.body;

  // Verificar código de registro
  db.get("SELECT valor FROM configuracion WHERE clave = 'registro_code'", [], async (err, row) => {
    if (err) return res.status(500).json({ error: 'Error al verificar el código de registro.' });
    const correctCode = row ? row.valor : 'FANB2026';
    if (codigo_registro !== correctCode) {
      return res.status(403).json({ error: 'Código de registro inválido o no autorizado.' });
    }

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      db.run(
        'INSERT INTO medicos (nombre, email, cedula, especializacion, id_medico, password) VALUES (?, ?, ?, ?, ?, ?)',
        [nombre, email, cedula, especializacion, cedula, hashedPassword],
        function (err) {
          if (err) {
            if (err.message && err.message.includes('UNIQUE')) {
              return res.status(409).json({ error: 'El usuario/cédula ya está registrado.' });
            }
            return res.status(500).json({ error: "Error interno del servidor." });
          }
          res.json({ ok: true, id: this.lastID });
        }
      );
    } catch (err) {
      return res.status(500).json({ error: 'Error al procesar la contraseña.' });
    }
  });
});

// ============= RUTA PARA INICIO DE SESIÓN DE MÉDICOS =============
app.post('/medicos/login', loginMedico, async (req, res) => {
  const { id_medico, password } = req.body;
  db.get('SELECT * FROM medicos WHERE id_medico = ?', [id_medico], async (err, row) => {
    if (err) return res.status(500).json({ error: "Error interno del servidor." });
    if (!row) return res.status(401).json({ error: 'Credenciales incorrectas.' });

    let match = false;

    if (row.password.startsWith('$2b$') || row.password.startsWith('$2a$')) {
      match = await bcrypt.compare(password, row.password);
    } else {
      match = (password === row.password);
      if (match) {
        const hashed = await bcrypt.hash(password, 10);
        db.run('UPDATE medicos SET password = ? WHERE id = ?', [hashed, row.id]);
      }
    }

    if (!match) return res.status(401).json({ error: 'Credenciales incorrectas.' });
    const token = signToken({ id: row.id, id_medico: row.id_medico, nombre: row.nombre, rol: 'medico' });
    res.json({ ok: true, token, nombre: row.nombre, id_medico: row.id_medico });
  });
});

// ============ RUTAS PARA INSTRUCCIONES ===========

// Crear nueva instrucción (requiere token)
app.post('/api/instrucciones', verifyToken, instruccion, (req, res) => {
  const { titulo, categoria, severidad, parte_cuerpo, tiempo_estimado, pasos, descripcion } = req.body;

  const fecha = new Date().toISOString();
  const id_medico = req.user.id_medico;
  
  db.run(
    `INSERT INTO instrucciones (titulo, categoria, severidad, parte_cuerpo, tiempo_estimado, pasos, fecha, id_medico, descripcion) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [titulo, categoria || null, severidad || null, parte_cuerpo, tiempo_estimado || null, JSON.stringify(pasos), fecha, id_medico, descripcion || null],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, error: "Error interno del servidor." });
      }
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Obtener todas las instrucciones
app.get('/api/instrucciones', (req, res) => {
  db.all(
    `SELECT * FROM instrucciones ORDER BY fecha DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: "Error interno del servidor." });
      res.json({ success: true, data: rows });
    }
  );
});

// Obtener instrucción por ID
app.get('/api/instrucciones/:id', (req, res) => {
  db.get(
    `SELECT * FROM instrucciones WHERE id = ?`,
    [req.params.id],
    (err, row) => {
      if (err) return res.status(500).json({ success: false, error: "Error interno del servidor." });
      if (!row) return res.status(404).json({ success: false, error: 'Instrucción no encontrada.' });
      res.json({ success: true, data: row });
    }
  );
});

// Actualizar instrucción (requiere token)
app.put('/api/instrucciones/:id', verifyToken, instruccion, (req, res) => {
  const { titulo, categoria, severidad, parte_cuerpo, tiempo_estimado, pasos, descripcion } = req.body;

  const id_medico = req.user.id_medico;
  const isAdmin = req.user.rol === 'admin';

  const updateFn = () => {
    db.run(
      `UPDATE instrucciones SET titulo = ?, categoria = ?, severidad = ?, parte_cuerpo = ?, tiempo_estimado = ?, pasos = ?, descripcion = ? WHERE id = ?`,
      [titulo, categoria || null, severidad || null, parte_cuerpo, tiempo_estimado || null, JSON.stringify(pasos), descripcion || null, req.params.id],
      function (err) {
        if (err) return res.status(500).json({ success: false, error: "Error interno del servidor." });
        res.json({ success: true });
      }
    );
  };

  if (isAdmin) {
    updateFn();
  } else {
    db.get(
      `SELECT * FROM instrucciones WHERE id = ? AND id_medico = ?`,
      [req.params.id, id_medico],
      (err, row) => {
        if (err) return res.status(500).json({ success: false, error: "Error interno del servidor." });
        if (!row) return res.status(403).json({ success: false, error: 'No tienes permiso para editar esta instrucción.' });
        updateFn();
      }
    );
  }
});

// Eliminar instrucción (requiere token)
app.delete('/api/instrucciones/:id', verifyToken, (req, res) => {
  const id_medico = req.user.id_medico;
  const isAdmin = req.user.rol === 'admin';

  const deleteFn = () => {
    db.run(
      `DELETE FROM instrucciones WHERE id = ?`,
      [req.params.id],
      function (err) {
        if (err) return res.status(500).json({ success: false, error: "Error interno del servidor." });
        res.json({ success: true });
      }
    );
  };

  if (isAdmin) {
    deleteFn();
  } else {
    db.get(
      `SELECT * FROM instrucciones WHERE id = ? AND id_medico = ?`,
      [req.params.id, id_medico],
      (err, row) => {
        if (err) return res.status(500).json({ success: false, error: "Error interno del servidor." });
        if (!row) return res.status(403).json({ success: false, error: 'No tienes permiso para eliminar esta instrucción.' });
        deleteFn();
      }
    );
  }
});

// ======================= RUTAS DE ADMINISTRACIÓN =========================

// ======================= RUTAS DE ADMINISTRACIÓN =========================

// Login del Administrador (retorna JWT)
app.post('/api/admin/login', loginAdmin, async (req, res) => {
  const { password } = req.body;
  db.get("SELECT valor FROM configuracion WHERE clave = 'admin_password'", [], async (err, row) => {
    if (err) return res.status(500).json({ success: false, error: 'Error de base de datos.' });
    const storedPassword = row ? row.valor : 'UNEFA2026';

    let match = false;
    if (storedPassword.startsWith('$2b$') || storedPassword.startsWith('$2a$')) {
      match = await bcrypt.compare(password, storedPassword);
    } else {
      match = (password === storedPassword);
      if (match) {
        const hashed = await bcrypt.hash(password, 10);
        db.run("INSERT INTO configuracion (clave, valor) VALUES ('admin_password', ?) ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor", [hashed]);
      }
    }

    if (!match) return res.status(401).json({ success: false, error: 'Contraseña incorrecta.' });
    const token = signToken({ rol: 'admin' });
    res.json({ success: true, token });
  });
});

// Listar médicos registrados (requiere admin)
app.get('/api/admin/medicos', verifyToken, requireAdmin, (req, res) => {
  db.all('SELECT nombre, email, cedula, especializacion, id_medico FROM medicos ORDER BY nombre ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: "Error interno del servidor." });
    res.json({ success: true, data: rows });
  });
});

// Eliminar médico y sus instrucciones (requiere admin)
app.delete('/api/admin/medicos/:id_medico', verifyToken, requireAdmin, (req, res) => {
  const { id_medico } = req.params;
  
  db.run('DELETE FROM instrucciones WHERE id_medico = ?', [id_medico], () => {
    db.run('DELETE FROM medicos WHERE id_medico = ?', [id_medico], function (err) {
      if (err) return res.status(500).json({ success: false, error: 'Error al eliminar al médico.' });
      res.json({ success: true });
    });
  });
});

// Obtener códigos de configuración e info (requiere admin)
app.get('/api/admin/config', verifyToken, requireAdmin, (req, res) => {
  db.get("SELECT valor FROM configuracion WHERE clave = 'registro_code'", [], (err, codeRow) => {
    if (err) return res.status(500).json({ success: false, error: 'Error de base de datos.' });
    
    const regCode = codeRow ? codeRow.valor : 'FANB2026';

    db.get('SELECT COUNT(*) as count FROM medicos', [], (err, medicosRow) => {
      if (err) return res.status(500).json({ success: false, error: "Error interno del servidor." });
      
      db.get('SELECT COUNT(*) as count FROM instrucciones', [], (err, instRow) => {
        if (err) return res.status(500).json({ success: false, error: "Error interno del servidor." });
        
        db.get("SELECT COUNT(*) as count FROM instrucciones WHERE severidad = 'critico'", [], (err, critRow) => {
          if (err) return res.status(500).json({ success: false, error: "Error interno del servidor." });
          
          res.json({
            success: true,
            config: { registro_code: regCode },
            stats: {
              medicos: medicosRow ? medicosRow.count : 0,
              instrucciones: instRow ? instRow.count : 0,
              criticos: critRow ? critRow.count : 0
            }
          });
        });
      });
    });
  });
});

// Actualizar configuración (requiere admin)
app.post('/api/admin/config', verifyToken, requireAdmin, configUpdate, async (req, res) => {
  let { registro_code, admin_password } = req.body;
  let errOccurred = false;
  let completed = 0;
  let total = 0;

  if (admin_password !== undefined) {
    admin_password = await bcrypt.hash(admin_password, 10);
  }

  const checkDone = () => {
    completed++;
    if (completed >= total) {
      if (errOccurred) return res.status(500).json({ success: false, error: 'Error al actualizar configuraciones.' });
      res.json({ success: true });
    }
  };

  if (registro_code !== undefined) {
    total++;
    db.run(
      "INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor",
      ['registro_code', registro_code],
      (err) => { if (err) errOccurred = true; checkDone(); }
    );
  }

  if (admin_password !== undefined) {
    total++;
    db.run(
      "INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor",
      ['admin_password', admin_password],
      (err) => { if (err) errOccurred = true; checkDone(); }
    );
  }

  if (total === 0) {
    res.json({ success: true });
  }
});

// ============ REGISTRO DE BÚSQUEDAS (SOLDIER VIEWS) ============

// Log cuando un soldado ve una instrucción
app.post('/api/log-busqueda', logBusqueda, (req, res) => {
  const { instruccion_id } = req.body;

  db.get(`SELECT titulo, id_medico FROM instrucciones WHERE id = ?`, [instruccion_id], (err, inst) => {
    if (err || !inst) return res.status(404).json({ success: false, error: 'Instrucción no encontrada.' });

    db.get(`SELECT nombre FROM medicos WHERE id_medico = ?`, [inst.id_medico], (err, med) => {
      const nombreMedico = med ? med.nombre : 'Desconocido';
      db.run(
        `INSERT INTO busquedas_log (instruccion_id, titulo, id_medico_creador, nombre_medico_creador) VALUES (?, ?, ?, ?)`,
        [instruccion_id, inst.titulo, inst.id_medico, nombreMedico],
        (err) => {
          if (err) return res.status(500).json({ success: false, error: "Error interno del servidor." });
          res.json({ success: true });
        }
      );
    });
  });
});

// Obtener logs de búsquedas (requiere admin)
app.get('/api/admin/busquedas', verifyToken, requireAdmin, (req, res) => {
  const { periodo, search } = req.query;
  let fechaLimite = '';
  const now = new Date();

  if (periodo === 'dia') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    fechaLimite = start.toISOString();
  } else if (periodo === 'semana') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    fechaLimite = start.toISOString();
  } else if (periodo === 'mes') {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 1);
    fechaLimite = start.toISOString();
  }

  let query = 'SELECT * FROM busquedas_log';
  const params = [];
  const conditions = [];

  if (fechaLimite) {
    conditions.push('fecha >= ?');
    params.push(fechaLimite);
  }

  if (search && search.trim()) {
    conditions.push('titulo LIKE ?');
    params.push(`%${search.trim()}%`);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY fecha DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: "Error interno del servidor." });
    res.json({ success: true, data: rows });
  });
});

// =================== MIDDLEWARE DE ERRORES ====================

// 404 - Ruta no encontrada
app.use((req, res) => {
  logEvent('ROUTE_404', { method: req.method, path: req.path, correlationId: req.correlationId });
  res.status(404).json({ error: 'Ruta no encontrada.', correlationId: req.correlationId });
});

// Middleware global de errores Express (evita filtrar información interna)
app.use((err, req, res, next) => {
  logError('EXPRESS_ERROR', err, { correlationId: req.correlationId, method: req.method, path: req.path });
  res.status(500).json({ error: 'Error interno del servidor.', correlationId: req.correlationId });
});

// Manejadores de errores no capturados (protegen el proceso)
process.on('uncaughtException', (err) => {
  logError('UNCAUGHT_EXCEPTION', err);
});

process.on('unhandledRejection', (err) => {
  logError('UNHANDLED_REJECTION', err);
});

// =================== HEALTH CHECK (para Render) ====================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// =================== INICIA EL SERVIDOR ====================
app.listen(PORT, () => {
  logEvent('SERVER_START', { puerto: PORT });
});