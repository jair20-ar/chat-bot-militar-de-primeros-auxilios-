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
const bcrypt = require('bcrypt');
const { Queue } = require('bullmq');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const { Server } = require('socket.io');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = 3001;
const upload = multer({ dest: 'uploads/' });

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

const modelpath = path.join(__dirname, 'model', 'vosk-model-small-es-0.42');
if (!fs.existsSync(modelpath)) {
  console.error('carpeta no encontrada:', modelpath);
  process.exit(1);
}

const model = new Model(modelpath);

const Redis = require('ioredis');

// Configure Redis with connection recovery and error silencing
const redisConfig = {
  host: '127.0.0.1',
  port: 6379,
  maxRetriesPerRequest: null,
  retryStrategy(times) {
    if (times === 1) {
      console.warn('⚠️ Servidor Redis offline (127.0.0.1:6379). La cola de transcripción se ejecutará en modo síncrono de respaldo.');
    }
    // Reintentar conexión cada 15 segundos en segundo plano, evitando inundar la consola
    return 15000;
  }
};

let redisClient;
try {
  redisClient = new Redis(redisConfig);
  redisClient.on('error', () => {
    // Silenciar errores repetitivos de conexión para no inundar el log de la consola
  });
} catch (err) {
  console.error('Error al instanciar el cliente Redis:', err.message);
}

// Import background worker
const { initWorker } = require('./worker');
initWorker(model, io);

// Initialize BullMQ Queue for transcription
let chatQueue;
if (redisClient) {
  try {
    chatQueue = new Queue('chat', { 
      connection: redisClient,
      defaultJobOptions: { removeOnComplete: true, removeOnFail: true }
    });
  } catch (err) {
    console.error('Failed to initialize Queue:', err.message);
  }
}


// =================== MIDDLEWARE ===================
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// =================== Crear tabla medicos si NO existe ===================
db.run(`
  CREATE TABLE IF NOT EXISTS medicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    email TEXT NOT NULL,
    cedula TEXT NOT NULL,
    especializacion TEXT NOT NULL,
    id_medico TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  )
`);

// =================== Crear tabla instrucciones (ACTUALIZADA) ===================
db.run(`
  CREATE TABLE IF NOT EXISTS instrucciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    categoria TEXT,
    severidad TEXT,
    parte_cuerpo TEXT NOT NULL,
    tiempo_estimado TEXT,
    pasos TEXT NOT NULL,
    fecha TEXT NOT NULL,
    id_medico TEXT NOT NULL,
    FOREIGN KEY(id_medico) REFERENCES medicos(id_medico)
  )
`);

// =============== Servir frontend estático ===============
app.use(express.static(path.join(__dirname, '../frontend/html')));
app.use('/imagenes', express.static(path.join(__dirname, '../frontend/imagenes')));
app.use('/js', express.static(path.join(__dirname, '../frontend/js')));
app.use('/styles', express.static(path.join(__dirname, '../frontend/styles')));

// ======================= API =========================

app.post('/api/transcribir', upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Archivo de audio no recibido' });
    }

    const requestId = uuidv4();
    const socketId = req.body.socketId;

    // Attempt to queue the job
    let queued = false;
    if (chatQueue) {
      try {
        await chatQueue.add('process', { requestId, filePath: req.file.path, socketId });
        queued = true;
      } catch (err) {
        console.warn('Queue addition failed (Redis might be offline). Falling back to sync transcription...', err.message);
      }
    }

    if (queued) {
      db.run(
        'INSERT INTO requests (id, status, created_at) VALUES (?,?,datetime("now"))',
        [requestId, 'queued'],
        (err) => {
          if (err) console.error('Error inserting request into DB:', err.message);
        }
      );
      return res.status(202).json({ 
        requestId, 
        message: 'Procesando, recibirás notificación cuando esté listo.' 
      });
    }

    // Fallback: Synchronous processing (if Redis is not running)
    console.log('🔄 Executing transcription synchronously...');
    const inputPath = path.join(__dirname, req.file.path);
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

// Get status of a transcription request (for polling fallback)
app.get('/api/transcribir/status/:requestId', (req, res) => {
  db.get('SELECT * FROM requests WHERE id = ?', [req.params.requestId], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Petición no encontrada.' });
    res.json({ id: row.id, status: row.status, result: row.result });
  });
});

// ================ RUTAS DIAGNÓSTICO (SNAPSHOTS & TRANSACCIONES) ================
app.post('/api/diagnostico', (req, res) => {
  const { query, medicoId } = req.body;
  const requestId = uuidv4();
  
  if (!query) {
    return res.status(400).json({ error: 'La consulta es requerida.' });
  }

  // 1. Insert query into consultas table
  db.run('INSERT INTO consultas (texto, medico_id) VALUES (?, ?)', [query, medicoId || null], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    const consultaId = this.lastID;

    // 2. Search instructions table for matching protocols
    db.all(
      `SELECT * FROM instrucciones WHERE titulo LIKE ? OR categoria LIKE ? OR severidad LIKE ?`,
      [`%${query}%`, `%${query}%`, `%${query}%`],
      (errSearch, rows) => {
        if (errSearch) return res.status(500).json({ error: errSearch.message });

        let matchingProtocolId = null;
        let responseText = `No se encontraron protocolos específicos para "${query}". Por favor, mantenga la calma y espere asistencia médica.`;

        if (rows && rows.length > 0) {
          const matched = rows[0];
          matchingProtocolId = matched.id;
          responseText = `Protocolo encontrado: ${matched.titulo}. Categoría: ${matched.categoria}. Pasos: ${matched.pasos}`;
        }

        // Get the latest protocol version ID if found
        const getVersionId = (callback) => {
          if (!matchingProtocolId) return callback(null, null);
          db.get(
            `SELECT id FROM protocol_versions WHERE protocol_id = ? ORDER BY version DESC LIMIT 1`,
            [matchingProtocolId],
            (errVer, rowVer) => {
              if (errVer || !rowVer) callback(null, null);
              else callback(null, rowVer.id);
            }
          );
        };

        getVersionId((_, versionId) => {
          // 3. Create response and interaction in an atomic transaction
          db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            db.run(
              'INSERT INTO respuestas (request_id, medico_id, protocol_version_id, content_snapshot) VALUES (?,?,?,?)',
              [requestId, medicoId || null, versionId, responseText],
              function(errResp) {
                if (errResp) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ error: errResp.message });
                }
                const respuestaId = this.lastID;
                
                db.run(
                  'INSERT INTO interacciones (consulta_id, respuesta_id) VALUES (?,?)',
                  [consultaId, respuestaId],
                  function(err2) {
                    if (err2) {
                      db.run('ROLLBACK');
                      return res.status(500).json({ error: err2.message });
                    }
                    db.run('COMMIT');
                    
                    // Create audit event
                    db.run(
                      'INSERT INTO audit_events (event_type, payload) VALUES (?, ?)',
                      ['DIAGNOSTICO_GENERADO', JSON.stringify({ requestId, consultaId, respuestaId, protocolId: matchingProtocolId })],
                      (errAudit) => {
                        if (errAudit) console.error('Error creating audit event:', errAudit.message);
                      }
                    );

                    res.json({
                      success: true,
                      requestId,
                      respuestaId,
                      responseText,
                      protocol: rows && rows.length > 0 ? rows[0] : null
                    });
                  }
                );
              }
            );
          });
        });
      }
    );
  });
});

// Alias route
app.post('/chat/message', (req, res) => {
  res.redirect(307, '/api/diagnostico');
});

// ================ RUTA PARA REGISTRO DE MÉDICOS ================
app.post('/medicos/registro', (req, res) => {
  const { nombre, email, cedula, especializacion, password, codigo_registro } = req.body;
  if (!nombre || !email || !cedula || !especializacion || !password || !codigo_registro) {
    return res.status(400).json({ error: 'Todos los campos, incluyendo el código de registro, son obligatorios.' });
  }

  // Verificar código de registro
  db.get("SELECT valor FROM configuracion WHERE clave = 'registro_code'", [], (err, row) => {
    if (err) return res.status(500).json({ error: 'Error al verificar el código de registro.' });
    const correctCode = row ? row.valor : 'FANB2026';
    if (codigo_registro !== correctCode) {
      return res.status(403).json({ error: 'Código de registro inválido o no autorizado.' });
    }

        bcrypt.hash(password, 10, (errHash, hash) => {
          if (errHash) return res.status(500).json({ error: 'Error al hashear password' });
          db.run(
            'INSERT INTO medicos (nombre, email, cedula, especializacion, id_medico, password) VALUES (?, ?, ?, ?, ?, ?)',
            [nombre, email, cedula, especializacion, cedula, hash],
            function (err) {
              if (err) {
                if (err.message && err.message.includes('UNIQUE constraint failed')) {
                  return res.status(409).json({ error: 'El usuario/cédula ya está registrado.' });
                }
                return res.status(500).json({ error: err.message });
              }
              res.json({ ok: true, id: this.lastID });
            }
          );
        });
  });
});

// ============= RUTA PARA INICIO DE SESIÓN DE MÉDICOS =============
app.post('/medicos/login', (req, res) => {
  const { id_medico, password } = req.body;
  if (!id_medico || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }
  db.get(
    'SELECT * FROM medicos WHERE id_medico = ?',
    [id_medico],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(401).json({ error: 'Credenciales incorrectas.' });
      
      bcrypt.compare(password, row.password, (errCmp, same) => {
        if (errCmp) return res.status(500).json({ error: errCmp.message });
        if (!same) return res.status(401).json({ error: 'Credenciales incorrectas.' });
        res.json({ ok: true, nombre: row.nombre, id_medico: row.id_medico });
      });
    }
  );
});

// ============ RUTAS PARA INSTRUCCIONES ===========

// Crear nueva instrucción
app.post('/api/instrucciones', (req, res) => {
  const { titulo, categoria, severidad, parte_cuerpo, tiempo_estimado, pasos, id_medico } = req.body;
  
  if (!titulo || !pasos || !id_medico || !parte_cuerpo) {
    return res.status(400).json({ success: false, error: 'Título, pasos, parte del cuerpo e id_medico son obligatorios.' });
  }

  const fecha = new Date().toISOString();
  
  db.run(
    `INSERT INTO instrucciones (titulo, categoria, severidad, parte_cuerpo, tiempo_estimado, pasos, fecha, id_medico) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [titulo, categoria || null, severidad || null, parte_cuerpo, tiempo_estimado || null, JSON.stringify(pasos), fecha, id_medico],
    function (err) {
      if (err) {
        return res.status(500).json({ success: false, error: err.message });
      }
      const protocolId = this.lastID;

      // Guardar versión inicial en protocol_versions
      db.run(
        `INSERT INTO protocol_versions (protocol_id, version, content, author_id) VALUES (?, 1, ?, ?)`,
        [protocolId, JSON.stringify(pasos), id_medico],
        (errVer) => {
          if (errVer) console.error('Error saving initial protocol version:', errVer.message);
        }
      );

      res.json({ success: true, id: protocolId });
    }
  );
});

// Obtener todas las instrucciones
app.get('/api/instrucciones', (req, res) => {
  db.all(
    `SELECT * FROM instrucciones ORDER BY fecha DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
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
      if (err) return res.status(500).json({ success: false, error: err.message });
      if (!row) return res.status(404).json({ success: false, error: 'Instrucción no encontrada.' });
      res.json({ success: true, data: row });
    }
  );
});

// Actualizar instrucción (VALIDAR DUEÑO)
app.put('/api/instrucciones/:id', (req, res) => {
  const { titulo, categoria, severidad, parte_cuerpo, tiempo_estimado, pasos, id_medico } = req.body;
  
  if (!titulo || !pasos || !id_medico || !parte_cuerpo) {
    return res.status(400).json({ success: false, error: 'Título, pasos, parte del cuerpo e id_medico son obligatorios.' });
  }

  const updateFn = () => {
    db.run(
      `UPDATE instrucciones SET titulo = ?, categoria = ?, severidad = ?, parte_cuerpo = ?, tiempo_estimado = ?, pasos = ? WHERE id = ?`,
      [titulo, categoria || null, severidad || null, parte_cuerpo, tiempo_estimado || null, JSON.stringify(pasos), req.params.id],
      function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        
        // Incrementar versión en protocol_versions
        db.get(
          `SELECT MAX(version) as max_ver FROM protocol_versions WHERE protocol_id = ?`,
          [req.params.id],
          (errVer, rowVer) => {
            const nextVer = (rowVer && rowVer.max_ver) ? rowVer.max_ver + 1 : 1;
            db.run(
              `INSERT INTO protocol_versions (protocol_id, version, content, author_id) VALUES (?, ?, ?, ?)`,
              [req.params.id, nextVer, JSON.stringify(pasos), id_medico],
              (errIns) => {
                if (errIns) console.error('Error saving updated protocol version:', errIns.message);
              }
            );
          }
        );

        res.json({ success: true });
      }
    );
  };

  if (id_medico === 'admin') {
    updateFn();
  } else {
    // Verificar que el médico es el dueño
    db.get(
      `SELECT * FROM instrucciones WHERE id = ? AND id_medico = ?`,
      [req.params.id, id_medico],
      (err, row) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (!row) return res.status(403).json({ success: false, error: 'No tienes permiso para editar esta instrucción.' });
        updateFn();
      }
    );
  }
});

// Eliminar instrucción (VALIDAR DUEÑO)
app.delete('/api/instrucciones/:id', (req, res) => {
  const { id_medico } = req.body;
  
  if (!id_medico) {
    return res.status(400).json({ success: false, error: 'id_medico es obligatorio.' });
  }

  const deleteFn = () => {
    db.run(
      `DELETE FROM instrucciones WHERE id = ?`,
      [req.params.id],
      function (err) {
        if (err) return res.status(500).json({ success: false, error: err.message });
        res.json({ success: true });
      }
    );
  };

  if (id_medico === 'admin') {
    deleteFn();
  } else {
    // Verificar que el médico es el dueño
    db.get(
      `SELECT * FROM instrucciones WHERE id = ? AND id_medico = ?`,
      [req.params.id, id_medico],
      (err, row) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        if (!row) return res.status(403).json({ success: false, error: 'No tienes permiso para eliminar esta instrucción.' });
        deleteFn();
      }
    );
  }
});

// ======================= RUTAS DE ADMINISTRACIÓN =========================

// Login del Administrador
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, error: 'Contraseña requerida.' });
  }
  db.get("SELECT valor FROM configuracion WHERE clave = 'admin_password'", [], (err, row) => {
    if (err) return res.status(500).json({ success: false, error: 'Error de base de datos.' });
    const correctPassword = row ? row.valor : 'UNEFA2026';
    if (password === correctPassword) {
      res.json({ success: true, token: 'admin-session-token' });
    } else {
      res.status(401).json({ success: false, error: 'Contraseña incorrecta.' });
    }
  });
});

// Listar médicos registrados
app.get('/api/admin/medicos', (req, res) => {
  db.all('SELECT nombre, email, cedula, especializacion, id_medico FROM medicos ORDER BY nombre ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, error: err.message });
    res.json({ success: true, data: rows });
  });
});

// Eliminar médico y sus instrucciones
app.delete('/api/admin/medicos/:id_medico', (req, res) => {
  const { id_medico } = req.params;
  
  db.serialize(() => {
    db.run('DELETE FROM instrucciones WHERE id_medico = ?', [id_medico]);
    db.run('DELETE FROM medicos WHERE id_medico = ?', [id_medico], function (err) {
      if (err) return res.status(500).json({ success: false, error: 'Error al eliminar al médico.' });
      res.json({ success: true });
    });
  });
});

// Obtener códigos de configuración e info de administración
app.get('/api/admin/config', (req, res) => {
  db.get("SELECT valor FROM configuracion WHERE clave = 'registro_code'", [], (err, codeRow) => {
    if (err) return res.status(500).json({ success: false, error: 'Error de base de datos.' });
    
    const regCode = codeRow ? codeRow.valor : 'FANB2026';

    db.get('SELECT COUNT(*) as count FROM medicos', [], (err, medicosRow) => {
      if (err) return res.status(500).json({ success: false, error: err.message });
      
      db.get('SELECT COUNT(*) as count FROM instrucciones', [], (err, instRow) => {
        if (err) return res.status(500).json({ success: false, error: err.message });
        
        db.get("SELECT COUNT(*) as count FROM instrucciones WHERE severidad = 'critico'", [], (err, critRow) => {
          if (err) return res.status(500).json({ success: false, error: err.message });
          
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

// Actualizar configuración
app.post('/api/admin/config', (req, res) => {
  const { registro_code, admin_password } = req.body;
  
  db.serialize(() => {
    let errOccurred = false;
    
    if (registro_code !== undefined) {
      db.run("INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('registro_code', ?)", [registro_code], (err) => {
        if (err) errOccurred = true;
      });
    }
    
    if (admin_password !== undefined) {
      db.run("INSERT OR REPLACE INTO configuracion (clave, valor) VALUES ('admin_password', ?)", [admin_password], (err) => {
        if (err) errOccurred = true;
      });
    }
    
    db.get("SELECT 1", (err) => {
      if (errOccurred || err) {
        return res.status(500).json({ success: false, error: 'Error al actualizar configuraciones.' });
      }
      res.json({ success: true });
    });
  });
});

// =================== INICIA EL SERVIDOR ====================
server.listen(PORT, () => {
  console.log(`🚀 Servidor backend con WebSockets escuchando en http://localhost:${PORT}`);
});