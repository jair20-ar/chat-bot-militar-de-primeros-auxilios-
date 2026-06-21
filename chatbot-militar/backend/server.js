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

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = 3001;
const upload = multer({ dest: 'uploads/' });


const modelpath = path.join(__dirname, 'model', 'vosk-model-small-es-0.42');
if (!fs.existsSync(modelpath)) {
  console.error('carpeta no encontrada:', modelpath);
  process.exit(1);
}

const model = new Model(modelpath);


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

app.post('/api/transcribir', upload.single('audio'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Archivo de audio no recibido' });
    }

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

    db.run(
      'INSERT INTO medicos (nombre, email, cedula, especializacion, id_medico, password) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre, email, cedula, especializacion, cedula, password],
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

// ============= RUTA PARA INICIO DE SESIÓN DE MÉDICOS =============
app.post('/medicos/login', (req, res) => {
  const { id_medico, password } = req.body;
  if (!id_medico || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }
  db.get(
    'SELECT * FROM medicos WHERE id_medico = ? AND password = ?',
    [id_medico, password],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(401).json({ error: 'Credenciales incorrectas.' });
      res.json({ ok: true, nombre: row.nombre, id_medico: row.id_medico });
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
app.listen(PORT, () => {
  console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}`);
});