const path = require('path');

let db;

if (process.env.DATABASE_URL) {
  // =================== POSTGRESQL (Render/Producción) ===================
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  function convertSql(sql) {
    let idx = 0;
    sql = sql.replace(/\?/g, () => `$${++idx}`);
    sql = sql.replace(/INSERT\s+OR\s+REPLACE\s+INTO/i, 'INSERT INTO');
    const trimmed = sql.trimStart();
    if (/^INSERT\s/i.test(trimmed) && !/RETURNING\s/i.test(sql)) {
      sql += ' RETURNING id';
    }
    return sql;
  }

  function normalizeError(err) {
    if (err && err.code === '23505') {
      err.message = 'UNIQUE constraint failed: ' + (err.constraint || err.detail || '');
    }
    return err;
  }

  db = {
    get: (sql, params, cb) => {
      pool.query(convertSql(sql), params)
        .then(r => cb(null, r.rows[0]))
        .catch(e => cb(normalizeError(e)));
    },
    run: (sql, params, cb) => {
      pool.query(convertSql(sql), params)
        .then(r => { if (cb) cb.call({ lastID: r.rows[0]?.id }, null); })
        .catch(e => { if (cb) cb(normalizeError(e)); });
    },
    all: (sql, params, cb) => {
      pool.query(convertSql(sql), params)
        .then(r => cb(null, r.rows))
        .catch(e => cb(normalizeError(e)));
    },
    serialize: (fn) => fn(),
  };

  initializePgTables(pool);

} else {
  // =================== SQLITE (desarrollo local) ===================
  const sqlite3 = require('sqlite3').verbose();
  db = new sqlite3.Database(path.join(__dirname, './chatbotmilitar.db'), (err) => {
    if (err) {
      console.error('Error opening database:', err.message);
    } else {
      console.log('Connected to SQLite database');
      initializeSqliteTables();
    }
  });
}

function initializePgTables(pool) {
  const init = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS medicos (
        id SERIAL PRIMARY KEY,
        nombre TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        cedula TEXT NOT NULL UNIQUE,
        especializacion TEXT NOT NULL,
        id_medico TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS instrucciones (
        id SERIAL PRIMARY KEY,
        titulo TEXT NOT NULL,
        categoria TEXT,
        severidad TEXT,
        parte_cuerpo TEXT NOT NULL,
        tiempo_estimado TEXT,
        pasos TEXT NOT NULL,
        fecha TEXT NOT NULL,
        id_medico TEXT NOT NULL REFERENCES medicos(id_medico)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS busquedas_log (
        id SERIAL PRIMARY KEY,
        instruccion_id INTEGER NOT NULL REFERENCES instrucciones(id),
        titulo TEXT NOT NULL,
        id_medico_creador TEXT NOT NULL,
        nombre_medico_creador TEXT NOT NULL,
        fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS configuracion (
        clave TEXT PRIMARY KEY,
        valor TEXT
      )
    `);
    await pool.query(`
      INSERT INTO configuracion (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO NOTHING
    `, ['admin_password', 'UNEFA2026']);
    await pool.query(`
      INSERT INTO configuracion (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO NOTHING
    `, ['registro_code', '31150106']);
    await pool.query('DROP TABLE IF EXISTS indicaciones_protocolo');
    await pool.query('DROP TABLE IF EXISTS indicaciones_procolo');
    await pool.query('DROP TABLE IF EXISTS instructions');
    console.log('PostgreSQL tables ready');
  };
  init().catch(err => console.error('Error initializing PostgreSQL:', err.message));
}

function initializeSqliteTables() {
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
        FOREIGN KEY(id_medico) REFERENCES medicos(id_medico)
      )
    `);
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
    db.run("DROP TABLE IF EXISTS indicaciones_protocolo");
    db.run("DROP TABLE IF EXISTS indicaciones_procolo");
    db.run("DROP TABLE IF EXISTS instructions");
  });
}

module.exports = db;
