const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, './chatbotmilitar.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeTables();
  }
});

function initializeTables() {
  db.serialize(() => {

    // =================== Tabla de médicos ===================
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

    // =================== Tabla de instrucciones ===================
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

    // =================== Tabla de búsquedas log ===================
    db.run(`
      CREATE TABLE IF NOT EXISTS busquedas_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instruccion_id INTEGER NOT NULL,
        titulo TEXT NOT NULL,
        id_medico_creador TEXT NOT NULL,
        nombre_medico_creador TEXT NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(instruccion_id) REFERENCES instrucciones(id)
      )
    `);

    // =================== Tabla de configuración ===================
    db.run(`
      CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT
      )
    `, (err) => {
      if (err) {
        console.error('Error creating configuracion table:', err);
      } else {
        console.log('Configuracion table ready');
        db.run("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('admin_password', 'UNEFA2026')");
        db.run("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('registro_code', '31150106')");
      }
    });

    // =================== Limpieza de tablas viejas ===================
    db.run("DROP TABLE IF EXISTS indicaciones_protocolo");
    db.run("DROP TABLE IF EXISTS indicaciones_procolo");
    db.run("DROP TABLE IF EXISTS instructions");

  });
}

module.exports = db;
