const DB_NAME = 'ChatbotMilitar';
const DB_VERSION = 1;
const STORE_INSTRUCCIONES = 'instrucciones';
const STORE_PENDING = 'pendingChanges';
const STORE_META = 'syncMeta';

let dbInstance = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) { resolve(dbInstance); return; }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_INSTRUCCIONES)) {
        db.createObjectStore(STORE_INSTRUCCIONES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        db.createObjectStore(STORE_PENDING, { keyPath: 'tempId', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'clave' });
      }
    };
    request.onsuccess = (e) => { dbInstance = e.target.result; resolve(dbInstance); };
    request.onerror = (e) => reject(e.target.error);
  });
}

function dbPut(storeName, data) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(data);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  }));
}

function dbGetAll(storeName) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  }));
}

function dbGet(storeName, key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  }));
}

function dbDelete(storeName, key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  }));
}

function dbClear(storeName) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  }));
}

const LocalDB = {
  async guardarInstrucciones(instrucciones) {
    const db = await openDB();
    const tx = db.transaction(STORE_INSTRUCCIONES, 'readwrite');
    const store = tx.objectStore(STORE_INSTRUCCIONES);
    store.clear();
    for (const inst of instrucciones) {
      store.put(inst);
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  },

  async obtenerInstrucciones() {
    return dbGetAll(STORE_INSTRUCCIONES);
  },

  async obtenerInstruccionPorId(id) {
    return dbGet(STORE_INSTRUCCIONES, Number(id));
  },

  async agregarCambioPendiente(cambio) {
    return dbPut(STORE_PENDING, { ...cambio, timestamp: new Date().toISOString() });
  },

  async obtenerCambiosPendientes() {
    return dbGetAll(STORE_PENDING);
  },

  async limpiarCambiosPendientes() {
    return dbClear(STORE_PENDING);
  },

  async guardarUltimoSync(timestamp) {
    return dbPut(STORE_META, { clave: 'ultimoSync', valor: timestamp });
  },

  async obtenerUltimoSync() {
    const meta = await dbGet(STORE_META, 'ultimoSync');
    return meta ? meta.valor : null;
  },

  async tieneDatos() {
    const instrucciones = await dbGetAll(STORE_INSTRUCCIONES);
    return instrucciones.length > 0;
  }
};
