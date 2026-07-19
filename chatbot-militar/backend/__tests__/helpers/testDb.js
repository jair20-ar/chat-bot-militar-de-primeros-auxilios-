const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS medicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      cedula TEXT NOT NULL UNIQUE,
      especializacion TEXT NOT NULL,
      id_medico TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `);

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
      descripcion TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS busquedas_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instruccion_id INTEGER NOT NULL,
      titulo TEXT NOT NULL,
      id_medico_creador TEXT NOT NULL,
      nombre_medico_creador TEXT NOT NULL,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT
    )
  `);

  db.run("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('admin_password', 'UNEFA2026')");
  db.run("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('registro_code', '31150106')");
});

module.exports = db;
