const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { queryGet, queryAll, queryRun } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'ninja_hattori_super_secret_jwt_key_2026';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Authentication Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Format: Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired session. Please log in again.' });
    }
    req.user = user;
    next();
  });
};

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields (Name, Email, Password) are required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Check if user already exists
    const existingUser = await queryGet('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Save user
    const result = await queryRun(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), hashedPassword]
    );

    const token = jwt.sign(
      { id: result.lastID, name: name.trim(), email: email.trim().toLowerCase() },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful!',
      token,
      user: { id: result.lastID, name: name.trim(), email: email.trim().toLowerCase() }
    });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === 'SQLITE_CONSTRAINT' || (err.message && err.message.includes('UNIQUE constraint failed'))) {
      return res.status(400).json({ error: 'An account with this email already exists. Please sign in.' });
    }
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await queryGet('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// Check current user session
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ==========================================
// 2. SENSOR DATA & ENVIRONMENT MONITORING
// ==========================================

// Ingest sensor data (Used by ESP8266 or dashboard test simulator)
app.post('/api/sensor/data', async (req, res) => {
  try {
    let { temperature, humidity } = req.body;

    // Also support query parameters for easy testing from browsers or microcontrollers
    if (temperature === undefined && req.query.temp !== undefined) {
      temperature = req.query.temp;
    }
    if (humidity === undefined && req.query.hum !== undefined) {
      humidity = req.query.hum;
    }

    const tempNum = parseFloat(temperature);
    const humNum = parseFloat(humidity);

    if (isNaN(tempNum) || isNaN(humNum)) {
      return res.status(400).json({ error: 'Valid numerical temperature and humidity values are required.' });
    }

    const result = await queryRun(
      'INSERT INTO sensor_records (temperature, humidity, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [tempNum, humNum]
    );

    const inserted = await queryGet('SELECT * FROM sensor_records WHERE id = ?', [result.lastID]);

    res.status(201).json({
      success: true,
      message: 'Sensor record logged successfully',
      data: inserted
    });
  } catch (err) {
    console.error('Error logging sensor data:', err);
    res.status(500).json({ error: 'Failed to record sensor data.' });
  }
});

// Get latest sensor record
app.get('/api/sensor/latest', async (req, res) => {
  try {
    const latest = await queryGet('SELECT * FROM sensor_records ORDER BY id DESC LIMIT 1');
    if (!latest) {
      return res.json({
        temperature: 0,
        humidity: 0,
        timestamp: new Date().toISOString()
      });
    }
    res.json(latest);
  } catch (err) {
    console.error('Error getting latest sensor data:', err);
    res.status(500).json({ error: 'Failed to retrieve latest sensor data.' });
  }
});

// Get recent history for graph visualization (chronological order)
app.get('/api/sensor/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    // Get last N records and reverse them so they flow left-to-right chronologically
    const rows = await queryAll(
      'SELECT id, temperature, humidity, timestamp FROM sensor_records ORDER BY id DESC LIMIT ?',
      [limit]
    );
    res.json(rows.reverse());
  } catch (err) {
    console.error('Error fetching sensor history:', err);
    res.status(500).json({ error: 'Failed to fetch sensor history.' });
  }
});

// Get paginated records (20 per page, latest first)
app.get('/api/sensor/records', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const countRow = await queryGet('SELECT COUNT(*) as total FROM sensor_records');
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const records = await queryAll(
      'SELECT id, temperature, humidity, timestamp FROM sensor_records ORDER BY id DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );

    res.json({
      records,
      pagination: {
        page,
        limit,
        total,
        totalPages
      }
    });
  } catch (err) {
    console.error('Error fetching records:', err);
    res.status(500).json({ error: 'Failed to fetch sensor records.' });
  }
});

// Delete a sensor record by ID
app.delete('/api/sensor/records/:id', authenticateToken, async (req, res) => {
  try {
    const recordId = parseInt(req.params.id);
    if (!recordId) {
      return res.status(400).json({ error: 'Invalid record ID.' });
    }

    const check = await queryGet('SELECT id FROM sensor_records WHERE id = ?', [recordId]);
    if (!check) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    await queryRun('DELETE FROM sensor_records WHERE id = ?', [recordId]);
    res.json({ success: true, message: `Record #${recordId} deleted successfully.` });
  } catch (err) {
    console.error('Error deleting sensor record:', err);
    res.status(500).json({ error: 'Failed to delete record.' });
  }
});

// ==========================================
// 3. SMART LCD 16x2 CONTROLLER
// ==========================================

// Get current LCD state
app.get('/api/lcd', async (req, res) => {
  try {
    const lcd = await queryGet('SELECT row1, row2, updated_at FROM lcd_state WHERE id = 1');
    res.json(lcd || { row1: 'Ninja_hattori', row2: 'IoT Active!', updated_at: new Date().toISOString() });
  } catch (err) {
    console.error('Error getting LCD state:', err);
    res.status(500).json({ error: 'Failed to get LCD content.' });
  }
});

// Update LCD state (max 16 chars per row)
app.post('/api/lcd', authenticateToken, async (req, res) => {
  try {
    let { row1 = '', row2 = '' } = req.body;

    // Truncate to maximum 16 characters for 16x2 LCD
    row1 = String(row1).substring(0, 16);
    row2 = String(row2).substring(0, 16);

    await queryRun(
      'UPDATE lcd_state SET row1 = ?, row2 = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
      [row1, row2]
    );

    res.json({
      success: true,
      message: 'LCD text updated successfully!',
      lcd: { row1, row2, updated_at: new Date().toISOString() }
    });
  } catch (err) {
    console.error('Error updating LCD:', err);
    res.status(500).json({ error: 'Failed to update LCD content.' });
  }
});

// ==========================================
// 4. LED AUTOMATION CONTROLLER
// ==========================================

// Get current LED state (0 = OFF, 1 = ON)
app.get('/api/led', async (req, res) => {
  try {
    const led = await queryGet('SELECT state, updated_at FROM led_state WHERE id = 1');
    res.json({
      state: led ? led.state : 0,
      updated_at: led ? led.updated_at : new Date().toISOString()
    });
  } catch (err) {
    console.error('Error getting LED state:', err);
    res.status(500).json({ error: 'Failed to fetch LED status.' });
  }
});

// Toggle / set LED state
app.post('/api/led', authenticateToken, async (req, res) => {
  try {
    const { state } = req.body;
    const newState = (state === 1 || state === true || state === '1' || state === 'on') ? 1 : 0;

    await queryRun(
      'UPDATE led_state SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
      [newState]
    );

    res.json({
      success: true,
      state: newState,
      statusText: newState === 1 ? 'ON' : 'OFF',
      message: `LED switched ${newState === 1 ? 'ON' : 'OFF'}`
    });
  } catch (err) {
    console.error('Error toggling LED:', err);
    res.status(500).json({ error: 'Failed to toggle LED.' });
  }
});

// ==========================================
// 5. HARDWARE UNIFIED SYNC (FOR ESP8266)
// ==========================================
// High-efficiency single-request endpoint for ESP8266:
// Ingests sensor reading and responds with current LED & LCD state in one roundtrip!
app.all('/api/device/sync', async (req, res) => {
  try {
    // 1. Process incoming sensor data if available
    const temp = req.query.temp || (req.body && req.body.temp);
    const hum = req.query.hum || (req.body && req.body.hum);

    if (temp !== undefined && hum !== undefined) {
      const tempVal = parseFloat(temp);
      const humVal = parseFloat(hum);
      if (!isNaN(tempVal) && !isNaN(humVal)) {
        await queryRun(
          'INSERT INTO sensor_records (temperature, humidity, timestamp) VALUES (?, ?, CURRENT_TIMESTAMP)',
          [tempVal, humVal]
        );
      }
    }

    // 2. Fetch current LED and LCD states for the device
    const ledRow = await queryGet('SELECT state FROM led_state WHERE id = 1');
    const lcdRow = await queryGet('SELECT row1, row2 FROM lcd_state WHERE id = 1');

    res.json({
      success: true,
      led: ledRow ? ledRow.state : 0,
      lcd: {
        row1: lcdRow ? lcdRow.row1 : 'Ninja_hattori',
        row2: lcdRow ? lcdRow.row2 : 'IoT Active!'
      },
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    console.error('Device sync error:', err);
    res.status(500).json({ error: 'Device sync failed' });
  }
});

// Serve frontend for all remaining unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` Ninja_hattori IoT Server Running on Port ${PORT}`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(` Timezone: Asia/Kolkata (+05:30)`);
  console.log(`===============================================`);
});
