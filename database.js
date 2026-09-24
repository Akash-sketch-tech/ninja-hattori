const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure data folder exists if specified or store in root directory
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'ninja_hattori.db');
console.log(`Connecting to SQLite database at: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database successfully.');
  }
});

// Promisified database helper methods
const queryGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const queryAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const queryRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

// Initialize Database Tables
const initDatabase = async () => {
  try {
    // 1. Users table
    await queryRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Sensor Records table
    await queryRun(`
      CREATE TABLE IF NOT EXISTS sensor_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        temperature REAL NOT NULL,
        humidity REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Index on timestamp for faster ordering and pagination
    await queryRun(`
      CREATE INDEX IF NOT EXISTS idx_sensor_timestamp ON sensor_records(timestamp DESC)
    `);

    // 3. LCD State table (Single record id = 1)
    await queryRun(`
      CREATE TABLE IF NOT EXISTS lcd_state (
        id INTEGER PRIMARY KEY,
        row1 TEXT DEFAULT 'Ninja_hattori',
        row2 TEXT DEFAULT 'IoT Active!',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default LCD row if not exists
    const existingLcd = await queryGet(`SELECT id FROM lcd_state WHERE id = 1`);
    if (!existingLcd) {
      await queryRun(`
        INSERT INTO lcd_state (id, row1, row2, updated_at) 
        VALUES (1, 'Ninja_hattori', 'IoT Active!', CURRENT_TIMESTAMP)
      `);
    }

    // 4. LED State table (Single record id = 1)
    await queryRun(`
      CREATE TABLE IF NOT EXISTS led_state (
        id INTEGER PRIMARY KEY,
        state INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default LED row if not exists
    const existingLed = await queryGet(`SELECT id FROM led_state WHERE id = 1`);
    if (!existingLed) {
      await queryRun(`
        INSERT INTO led_state (id, state, updated_at) 
        VALUES (1, 0, CURRENT_TIMESTAMP)
      `);
    }

    // Insert sample initial sensor record if table is empty
    const recordCount = await queryGet(`SELECT COUNT(*) as count FROM sensor_records`);
    if (recordCount && recordCount.count === 0) {
      await queryRun(`
        INSERT INTO sensor_records (temperature, humidity, timestamp)
        VALUES (27.5, 62.0, CURRENT_TIMESTAMP)
      `);
      console.log('Sample initial sensor record inserted.');
    }

    console.log('Database initialized successfully.');
  } catch (error) {
    console.error('Error during database initialization:', error);
  }
};

initDatabase();

module.exports = {
  db,
  queryGet,
  queryAll,
  queryRun
};
