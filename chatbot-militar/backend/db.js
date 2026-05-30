const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./chatbotmilitar.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS instructions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    video_url TEXT,
    audio_url TEXT
  )`);
});

module.exports = db;