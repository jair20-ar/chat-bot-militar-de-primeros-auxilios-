const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, './chatbotmilitar.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
    initializeTables();
  }
});

function initializeTables() {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS instructions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        video_url TEXT,
        audio_url TEXT,
        category TEXT,
        severity TEXT DEFAULT 'normal'
      )
    `, (err) => {
      if (err) console.error('Error creating instructions table:', err);
      else console.log('✅ Instructions table ready');
    });

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
    `, (err) => {
      if (err) console.error('Error creating medicos table:', err);
      else console.log('✅ Medicos table ready');
    });

    db.run("DROP TABLE IF EXISTS indicaciones_protocolo", (err) => {
      if (err) console.error('Error dropping table:', err);
    });

    db.run("DROP TABLE IF EXISTS indicaciones_procolo", (err) => {
      if (err) console.error('Error dropping table:', err);
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT
      )
    `, (err) => {
      if (err) {
        console.error('Error creating configuracion table:', err);
      } else {
        console.log('✅ Configuracion table ready');
        db.run("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('admin_password', 'UNEFA2026')");
        db.run("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES ('registro_code', '31150106')");
      }
    });
  });
}

module.exports = db;