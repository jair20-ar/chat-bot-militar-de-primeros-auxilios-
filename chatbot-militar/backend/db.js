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
    `, (err) => {
      if (err) console.error('Error creating instrucciones table:', err);
      else console.log('✅ Table instrucciones ready');
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
      CREATE TABLE IF NOT EXISTS requests (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        result TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `, (err) => {
      if (err) console.error('Error creating requests table:', err);
      else console.log('✅ Table requests ready');
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS consultas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        texto TEXT NOT NULL,
        medico_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `, (err) => {
      if (err) console.error('Error creating consultas table:', err);
      else console.log('✅ Table consultas ready');
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS protocol_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        protocol_id INTEGER,
        version INTEGER,
        content TEXT NOT NULL,
        author_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `, (err) => {
      if (err) console.error('Error creating protocol_versions table:', err);
      else console.log('✅ Table protocol_versions ready');
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS respuestas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id TEXT NOT NULL,
        medico_id TEXT,
        protocol_version_id INTEGER,
        content_snapshot TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY(protocol_version_id) REFERENCES protocol_versions(id)
      )
    `, (err) => {
      if (err) console.error('Error creating respuestas table:', err);
      else console.log('✅ Table respuestas ready');
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS interacciones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        consulta_id INTEGER NOT NULL,
        respuesta_id INTEGER NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(consulta_id, respuesta_id),
        FOREIGN KEY(consulta_id) REFERENCES consultas(id),
        FOREIGN KEY(respuesta_id) REFERENCES respuestas(id)
      )
    `, (err) => {
      if (err) console.error('Error creating interacciones table:', err);
      else console.log('✅ Table interacciones ready');
    });

    db.run(`
      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `, (err) => {
      if (err) console.error('Error creating audit_events table:', err);
      else console.log('✅ Table audit_events ready');
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

    // Seed existing instructions into protocol_versions if empty
    db.get("SELECT COUNT(*) as count FROM protocol_versions", [], (errCount, rowCount) => {
      if (!errCount && rowCount && rowCount.count === 0) {
        db.all("SELECT id, pasos, id_medico FROM instrucciones", [], (errAll, rowsAll) => {
          if (!errAll && rowsAll) {
            rowsAll.forEach(r => {
              db.run(
                "INSERT INTO protocol_versions (protocol_id, version, content, author_id) VALUES (?, 1, ?, ?)",
                [r.id, r.pasos, r.id_medico]
              );
            });
            console.log(`✅ Seeded ${rowsAll.length} existing protocols into protocol_versions`);
          }
        });
      }
    });
  });
}

module.exports = db;