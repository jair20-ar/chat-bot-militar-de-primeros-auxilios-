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

    db.run(`
      CREATE TABLE IF NOT EXISTS indicaciones_protocolo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo TEXT NOT NULL,
        pasos TEXT NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        id_medico TEXT NOT NULL,
        categoria TEXT,
        tags TEXT,
        estado TEXT DEFAULT 'activo',
        FOREIGN KEY(id_medico) REFERENCES medicos(id_medico) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) console.error('Error creating indicaciones_protocolo table:', err);
      else console.log('✅ Indicaciones protocolo table ready');
    });
  });
}

module.exports = db;