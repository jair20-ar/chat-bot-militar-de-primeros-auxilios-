const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const db = require('./db');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

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

// =================== Crear tabla protocolos ===================
db.run(`
  CREATE TABLE IF NOT EXISTS indicaciones_protocolo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    pasos TEXT NOT NULL,
    fecha TEXT NOT NULL,
    id_medico TEXT NOT NULL,
    FOREIGN KEY(id_medico) REFERENCES medicos(id_medico)
  )
`);

// =============== Servir frontend estático ===============
app.use(express.static(path.join(__dirname, '../frontend/html')));
app.use('/imagenes', express.static(path.join(__dirname, '../frontend/imagenes')));
app.use('/js', express.static(path.join(__dirname, '../frontend')));
app.use('/css', express.static(path.join(__dirname, '../frontend')));

// ======================= API =========================

// ================ Ruta para registro de médicos ================
app.post('/medicos/registro', (req, res) => {
  const { nombre, email, cedula, especializacion, password } = req.body;
  if (!nombre || !email || !cedula || !especializacion || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
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

// ============= Ruta para inicio de sesión de médicos =============
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

// ============ RUTAS PARA GUARDAR/EDITAR/ELIMINAR PROTOCOLOS ===========
app.post('/indicaciones/protocolos', (req, res) => {
  const { titulo, pasos, id_medico } = req.body;
  if (!titulo || !pasos || !id_medico) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }
  const fecha = new Date().toISOString();
  db.run(
    `INSERT INTO indicaciones_protocolo (titulo, pasos, fecha, id_medico) VALUES (?, ?, ?, ?)`,
    [titulo, JSON.stringify(pasos), fecha, id_medico],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true, id: this.lastID });
    }
  );
});

// Obtener todos los protocolos de un médico
app.get('/indicaciones/protocolos/:id_medico', (req, res) => {
  db.all(
    `SELECT * FROM indicaciones_protocolo WHERE id_medico = ? ORDER BY fecha DESC`,
    [req.params.id_medico],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Obtener TODOS los protocolos/instrucciones de TODOS los médicos (para resultados.html)
app.get('/indicaciones/protocolos', (req, res) => {
  db.all(
    `SELECT * FROM indicaciones_protocolo ORDER BY fecha DESC`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Editar un protocolo
app.put('/indicaciones/protocolos/:id', (req, res) => {
  const { titulo, pasos } = req.body;
  db.run(
    `UPDATE indicaciones_protocolo SET titulo = ?, pasos = ? WHERE id = ?`,
    [titulo, JSON.stringify(pasos), req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    }
  );
});

// Eliminar un protocolo
app.delete('/indicaciones/protocolos/:id', (req, res) => {
  db.run(
    `DELETE FROM indicaciones_protocolo WHERE id = ?`,
    [req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ok: true });
    }
  );
});

// =================== Inicia el servidor ====================
app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en http://localhost:${PORT}`);
});