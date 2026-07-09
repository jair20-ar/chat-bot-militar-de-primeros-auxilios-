const Database = require('better-sqlite3');
const path = require('path');

let db;

function initDatabase() {
  const dbPath = path.join(__dirname, '..', 'data', 'inventario.db');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      stock REAL NOT NULL DEFAULT 0,
      serial TEXT,
      category_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS client_products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      price_at_time REAL NOT NULL,
      taken_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id),
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS category_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      change_type TEXT NOT NULL,
      previous_name TEXT,
      new_name TEXT,
      changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS exchange_rates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rate REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try { db.exec("ALTER TABLE payments ADD COLUMN currency TEXT DEFAULT 'USD'"); } catch (e) {}
  try { db.exec("ALTER TABLE payments ADD COLUMN rate_at_time REAL"); } catch (e) {}

  migrateFloats();

  try { db.exec("ALTER TABLE products ADD COLUMN active INTEGER DEFAULT 1"); } catch (e) {}
  return db;
}

function migrateFloats() {
  const productsInfo = db.prepare("PRAGMA table_info('products')").all();
  const cpInfo = db.prepare("PRAGMA table_info('client_products')").all();
  const needsMigrate = (infos, name) => infos.find(c => c.name === name && c.type !== 'REAL');
  if (!needsMigrate(productsInfo, 'stock') && !needsMigrate(cpInfo, 'quantity')) return;

  db.pragma('foreign_keys = OFF');
  db.transaction(() => {
    if (needsMigrate(cpInfo, 'quantity')) {
      db.exec("ALTER TABLE client_products RENAME TO client_products_old");
      db.exec("CREATE TABLE client_products (id INTEGER PRIMARY KEY AUTOINCREMENT, client_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity REAL NOT NULL DEFAULT 1, price_at_time REAL NOT NULL, taken_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (client_id) REFERENCES clients(id), FOREIGN KEY (product_id) REFERENCES products(id))");
      db.exec("INSERT INTO client_products SELECT * FROM client_products_old");
      db.exec("DROP TABLE client_products_old");
    }
    if (needsMigrate(productsInfo, 'stock')) {
      db.exec("ALTER TABLE products RENAME TO products_old");
      db.exec("CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, price REAL NOT NULL, stock REAL NOT NULL DEFAULT 0, serial TEXT, category_id INTEGER, active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (category_id) REFERENCES categories(id))");
      db.exec("INSERT INTO products SELECT * FROM products_old");
      db.exec("DROP TABLE products_old");
    }
  })();
  db.pragma('foreign_keys = ON');
}

function getDatabase() {
  return db;
}

function queryAll(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return { success: true, data: stmt.all(...params) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function queryGet(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    return { success: true, data: stmt.get(...params) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function queryRun(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function deleteClientProduct(id) {
  try {
    const info = db.prepare('SELECT product_id, quantity FROM client_products WHERE id = ?').get(id);
    if (!info) return { success: false, error: 'Registro no encontrado' };
    db.transaction(() => {
      db.prepare('DELETE FROM client_products WHERE id = ?').run(id);
      db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(info.quantity, info.product_id);
    })();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function updateClientProductQuantity(id, newQuantity) {
  try {
    const info = db.prepare('SELECT product_id, quantity FROM client_products WHERE id = ?').get(id);
    if (!info) return { success: false, error: 'Registro no encontrado' };
    const diff = info.quantity - newQuantity;
    db.transaction(() => {
      const result = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(diff, info.product_id);
      if (diff < 0 && result.changes === 0) throw new Error('Stock insuficiente');
      db.prepare('UPDATE client_products SET quantity = ? WHERE id = ?').run(newQuantity, id);
    })();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function deleteProduct(id, deleteClientProductIds = []) {
  try {
    try { db.exec("ALTER TABLE products ADD COLUMN active INTEGER DEFAULT 1"); } catch (e) {}

    const clientProducts = db.prepare(
      'SELECT cp.id, c.name as client_name FROM client_products cp JOIN clients c ON cp.client_id = c.id WHERE cp.product_id = ?'
    ).all(id);

    db.transaction(() => {
      db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(id);
      if (deleteClientProductIds.length > 0) {
        const placeholders = deleteClientProductIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM client_products WHERE id IN (${placeholders})`).run(...deleteClientProductIds);
      }
    })();

    return { success: true, clientProducts };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

module.exports = { initDatabase, getDatabase, queryAll, queryGet, queryRun, deleteClientProduct, updateClientProductQuantity, deleteProduct };
