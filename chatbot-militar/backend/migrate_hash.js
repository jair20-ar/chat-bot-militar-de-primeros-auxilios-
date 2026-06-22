// migrate_hash.js
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const DB_PATH = path.join(__dirname, 'chatbotmilitar.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database. Running migration...');
  runMigration();
});

function runMigration() {
  db.all('SELECT id, id_medico, password FROM medicos', [], (err, rows) => {
    if (err) {
      console.error('❌ Error fetching medicos:', err.message);
      db.close();
      process.exit(1);
    }
    
    let pending = rows.length;
    if (pending === 0) {
      console.log('No medicos found to migrate.');
      db.close();
      process.exit(0);
    }
    
    let migratedCount = 0;
    
    rows.forEach(row => {
      // Check if password looks like a bcrypt hash (starts with $2 and has length 60)
      const isHashed = row.password && (row.password.startsWith('$2a$') || row.password.startsWith('$2b$')) && row.password.length === 60;
      
      if (!isHashed) {
        console.log(`Hashing password for medico: ${row.id_medico}...`);
        bcrypt.hash(row.password, 10, (errHash, hash) => {
          if (errHash) {
            console.error(`❌ Error hashing for ${row.id_medico}:`, errHash.message);
            checkDone();
          } else {
            db.run('UPDATE medicos SET password = ? WHERE id = ?', [hash, row.id], (errUpdate) => {
              if (errUpdate) {
                console.error(`❌ Error updating ${row.id_medico}:`, errUpdate.message);
              } else {
                console.log(`✅ Successfully migrated password for ${row.id_medico}`);
                migratedCount++;
              }
              checkDone();
            });
          }
        });
      } else {
        console.log(`Medico ${row.id_medico} already has a hashed password.`);
        checkDone();
      }
    });

    function checkDone() {
      pending--;
      if (pending === 0) {
        console.log(`Migration completed! Migrated ${migratedCount} passwords.`);
        db.close();
      }
    }
  });
}
