const express = require('express');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
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

const allowedMimeTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/webm', 'audio/x-wav', 'audio/wave'];
const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de audio no soportado. Use WAV, MP3, OGG o WEBM.'));
    }
  }
});


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

/**
 * POST /api/transcribir - Transcribe un archivo de audio usando Vosk.
 * Recibe un archivo multipart, lo convierte a WAV (16kHz mono) y lo transcribe.
 * @param {import('express').Request} req - Request con archivo 'audio'
 * @param {import('express').Response} res - Respuesta JSON con el texto transcrito
 * @returns {void}
 * @throws {400} Si no se recibe archivo de audio
 * @throws {500} Si falla la conversión o transcripción
 */
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
/**
 * POST /medicos/registro - Registra un nuevo médico en el sistema.
 * Valida código de registro, hash de contraseña y crea el usuario.
 * @param {import('express').Request} req - Body con nombre, email, cedula, especializacion, password, codigo_registro
 * @param {import('express').Response} res - Respuesta JSON con ok e id del nuevo médico
 * @returns {void}
 * @throws {403} Si el código de registro es inválido
 * @throws {409} Si el usuario/cédula ya existe
 * @throws {500} Si hay error interno
 */
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
/**
 * POST /medicos/login - Inicia sesión un médico y devuelve un JWT.
 * Verifica contraseña (con soporte para migración de hash plano a bcrypt).
 * @param {import('express').Request} req - Body con id_medico y password
 * @param {import('express').Response} res - Respuesta JSON con token, nombre e id_medico
 * @returns {void}
 * @throws {401} Si las credenciales son incorrectas
 * @throws {500} Si hay error interno
 */
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

/**
 * POST /api/instrucciones - Crea una nueva instrucción médica.
 * Requiere autenticación JWT de médico.
 * @param {import('express').Request} req - Body con titulo, categoria, severidad, parte_cuerpo, tiempo_estimado, pasos, descripcion
 * @param {import('express').Response} res - Respuesta JSON con success e id de la instrucción
 * @returns {void}
 * @throws {401} Si no hay token válido
 * @throws {500} Si hay error interno
 */
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

/**
 * GET /api/instrucciones - Obtiene todas las instrucciones médicas ordenadas por fecha descendente.
 * No requiere autenticación (acceso público para soldados).
 * @param {import('express').Request} req - Request sin parámetros
 * @param {import('express').Response} res - Respuesta JSON con array de instrucciones
 * @returns {void}
 * @throws {500} Si hay error interno
 */
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

/**
 * GET /api/instrucciones/:id - Obtiene una instrucción médica por su ID.
 * Acceso público.
 * @param {import('express').Request} req - params con id de la instrucción
 * @param {import('express').Response} res - Respuesta JSON con la instrucción
 * @returns {void}
 * @throws {404} Si la instrucción no existe
 * @throws {500} Si hay error interno
 */
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

/**
 * PUT /api/instrucciones/:id - Actualiza una instrucción existente.
 * El médico propietario o un admin pueden editarla.
 * @param {import('express').Request} req - params con id, body con campos a actualizar
 * @param {import('express').Response} res - Respuesta JSON con success
 * @returns {void}
 * @throws {401} Si no hay token válido
 * @throws {403} Si no es el propietario ni admin
 * @throws {500} Si hay error interno
 */
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

/**
 * DELETE /api/instrucciones/:id - Elimina una instrucción.
 * El médico propietario o un admin pueden eliminarla.
 * @param {import('express').Request} req - params con id de la instrucción
 * @param {import('express').Response} res - Respuesta JSON con success
 * @returns {void}
 * @throws {401} Si no hay token válido
 * @throws {403} Si no es el propietario ni admin
 * @throws {500} Si hay error interno
 */
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

/**
 * POST /api/admin/login - Inicia sesión como administrador.
 * Verifica contra la contraseña almacenada en la tabla configuracion.
 * @param {import('express').Request} req - Body con password
 * @param {import('express').Response} res - Respuesta JSON con token de admin
 * @returns {void}
 * @throws {401} Si la contraseña es incorrecta
 * @throws {500} Si hay error de base de datos
 */
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

/**
 * GET /api/admin/medicos - Lista todos los médicos registrados.
 * Requiere autenticación de administrador.
 * @param {import('express').Request} req - Request autenticado como admin
 * @param {import('express').Response} res - Respuesta JSON con array de médicos
 * @returns {void}
 * @throws {401} Si no hay token
 * @throws {403} Si no es admin
 * @throws {500} Si hay error interno
 */
app.get('/api/admin/medicos', verifyToken, requireAdmin, (req, res) => {
  db.all('SELECT nombre, email, cedula, especializacion, id_medico FROM medicos ORDER BY nombre ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: "Error interno del servidor." });
    res.json({ success: true, data: rows });
  });
});

/**
 * DELETE /api/admin/medicos/:id_medico - Elimina un médico y todas sus instrucciones.
 * Requiere autenticación de administrador.
 * @param {import('express').Request} req - params con id_medico
 * @param {import('express').Response} res - Respuesta JSON con success
 * @returns {void}
 * @throws {401} Si no hay token
 * @throws {403} Si no es admin
 * @throws {500} Si hay error al eliminar
 */
app.delete('/api/admin/medicos/:id_medico', verifyToken, requireAdmin, (req, res) => {
  const { id_medico } = req.params;
  
  db.run('DELETE FROM instrucciones WHERE id_medico = ?', [id_medico], () => {
    db.run('DELETE FROM medicos WHERE id_medico = ?', [id_medico], function (err) {
      if (err) return res.status(500).json({ success: false, error: 'Error al eliminar al médico.' });
      res.json({ success: true });
    });
  });
});

/**
 * GET /api/admin/config - Obtiene configuración y estadísticas del sistema.
 * Requiere autenticación de administrador.
 * @param {import('express').Request} req - Request autenticado como admin
 * @param {import('express').Response} res - Respuesta JSON con config y stats
 * @returns {void}
 * @throws {401} Si no hay token
 * @throws {403} Si no es admin
 * @throws {500} Si hay error interno
 */
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

/**
 * POST /api/admin/config - Actualiza configuración del sistema (código de registro y/o contraseña admin).
 * Requiere autenticación de administrador.
 * @param {import('express').Request} req - Body con registro_code y/o admin_password
 * @param {import('express').Response} res - Respuesta JSON con success
 * @returns {void}
 * @throws {401} Si no hay token
 * @throws {403} Si no es admin
 * @throws {500} Si hay error al actualizar
 */
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

/**
 * POST /api/log-busqueda - Registra cuando un soldado visualiza una instrucción.
 * No requiere autenticación.
 * @param {import('express').Request} req - Body con instruccion_id
 * @param {import('express').Response} res - Respuesta JSON con success
 * @returns {void}
 * @throws {404} Si la instrucción no existe
 * @throws {500} Si hay error interno
 */
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

/**
 * GET /api/admin/busquedas - Obtiene logs de búsquedas con filtro opcional por periodo y texto.
 * Requiere autenticación de administrador.
 * @param {import('express').Request} req - Query params: periodo (dia|semana|mes), search (texto a buscar)
 * @param {import('express').Response} res - Respuesta JSON con array de logs
 * @returns {void}
 * @throws {401} Si no hay token
 * @throws {403} Si no es admin
 * @throws {500} Si hay error interno
 */
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

// =================== HEALTH CHECK (para Render) ====================
/**
 * GET /api/health - Health check para el balanceador de Render.
 * @param {import('express').Request} req - Objeto de solicitud Express
 * @param {import('express').Response} res - Respuesta JSON con status 'ok'
 * @returns {void}
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// =================== MIDDLEWARE DE ERRORES ====================

/**
 * Middleware 404 - Ruta no encontrada.
 * Se ejecuta cuando ninguna ruta coincide.
 * @param {import('express').Request} req - Objeto de solicitud Express
 * @param {import('express').Response} res - Objeto de respuesta Express
 * @returns {void}
 */
app.use((req, res) => {
  logEvent('ROUTE_404', { method: req.method, path: req.path, correlationId: req.correlationId });
  res.status(404).json({ error: 'Ruta no encontrada.', correlationId: req.correlationId });
});

/**
 * Middleware global de errores Express.
 * Captura errores no manejados y responde sin filtrar información interna.
 * @param {Error} err - Error capturado
 * @param {import('express').Request} req - Objeto de solicitud Express
 * @param {import('express').Response} res - Objeto de respuesta Express
 * @param {import('express').NextFunction} next - Función next
 * @returns {void}
 */
app.use((err, req, res, next) => {
  logError('EXPRESS_ERROR', err, { correlationId: req.correlationId, method: req.method, path: req.path });
  const code = req.correlationId || crypto.randomUUID();
  res.status(500).json({ error: 'Ocurrió un error. Reporte el código: ' + code });
});

let server;

// Manejadores de errores no capturados — shutdown graceful
process.on('uncaughtException', (err) => {
  logError('UNCAUGHT_EXCEPTION', err);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  } else {
    process.exit(1);
  }
});

process.on('unhandledRejection', (err) => {
  logError('UNHANDLED_REJECTION', err);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  } else {
    process.exit(1);
  }
});

// =================== INICIA EL SERVIDOR ====================
if (require.main === module) {
  server = app.listen(PORT, () => {
    logEvent('SERVER_START', { puerto: PORT });
  });
}
module.exports = app;