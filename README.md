# Ninja_hattori - Smart IoT Telemetry & Automation Platform

> **Designed and Developed by Akash-Parth-Suraj, Dept. of Electrical Engineering, GCOEY.**

A full-stack IoT web application and microcontroller firmware engineered for real-time environment monitoring (DHT11), remote 16x2 I2C LCD control, and LED automation. Built with Node.js, Express, SQLite, HTML5, and Tailwind CSS in a light green (aurora) aesthetic.

---

## 🌟 Features

- **Application Theme**: Light Green (Aurora) glassmorphism aesthetic with responsive layouts and Lucide icons.
- **Tab 1: Environment Monitoring**:
  - Live DHT11 telemetry auto-synchronized every 10 seconds.
  - **Innovative Visualization**: Dual circular radial gauges and dynamic seek-bars for ambient temperature and relative humidity.
  - **Real-Time Trends**: Chart.js dynamic dual-curve graph with aurora gradients.
  - **Saved Records Log**: Paginated table showing 20 records at a time, sorted latest first.
  - **Timezone**: Configured to **Asia/Kolkata (+05:30)** for precise local Indian Standard Time (IST).
  - **Record Deletion**: Authenticated deletion capability with UI confirmation.
  - **Built-in Telemetry Simulator**: Allows testing telemetry ingestion right from the web dashboard without needing the physical board plugged in.
- **Tab 2: Smart LCD Controller**:
  - Controls a physical 16x2 character I2C LCD connected to ESP8266.
  - Real-time virtual 16x2 LCD dot-matrix preview screen.
  - Row 1 & Row 2 input text fields (up to 16 characters each) with character counters and quick presets.
- **Tab 3: LED Automation**:
  - Remote power control of an LED on pin **D6**.
  - Animated glowing virtual bulb indicator and state switch.
- **Security & Authentication**:
  - User Registration and Login with JWT tokens and bcrypt password encryption.
- **Hardware Integration**:
  - Highly optimized `/api/device/sync` endpoint that handles sensor push and state retrieval in a single network round-trip.

---

## 🔌 Hardware Connections (ESP8266 NodeMCU)

| Component | ESP8266 Pin | GPIO Pin | Hardware Details |
| :--- | :--- | :--- | :--- |
| **DHT11 Data** | **D5** | GPIO 14 | Digital signal with pull-up resistor |
| **LED Anode (+)** | **D6** | GPIO 12 | In series with 220Ω / 330Ω resistor to GND |
| **LCD 16x2 SCL** | **D1** | GPIO 5 | I2C Clock line |
| **LCD 16x2 SDA** | **D2** | GPIO 4 | I2C Data line |
| **LCD VCC** | **5V / Vin** | — | 5V Power supply |
| **GND** | **GND** | — | Common ground |

---

## 💻 Local Quickstart

### Prerequisites
Node.js (v18+) is installed on your system.

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Application
```bash
npm start
```
The server will start at: `http://localhost:3000`

---

## 🚀 Deployment on Render

This project is pre-configured for one-click deployment on [Render](https://render.com).

### Step-by-Step Deployment:
1. **Push your code to GitHub / GitLab**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Ninja_hattori IoT platform"
   git branch -M main
   git remote add origin <your-github-repo-url>
   git push -u origin main
   ```
2. **Log into Render**:
   - Go to [dashboard.render.com](https://dashboard.render.com).
   - Click **New +** -> **Web Service**.
   - Connect your GitHub repository.
3. **Configure the Service**:
   - **Name**: `ninja-hattori` (or your preferred name)
   - **Environment**: `Node`
   - **Region**: Closest to you (e.g., Singapore or Frankfurt)
   - **Branch**: `main`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Plan**: `Free`
4. **Environment Variables**:
   Under the **Environment Variables** section, ensure the following are added:
   - `NODE_VERSION` = `20.12.0`
   - `PORT` = `10000` (Render automatically routes this)
   - `JWT_SECRET` = (A secure random secret string)
5. **Click "Create Web Service"**:
   - Render will build and deploy the app.
   - Once deployed, your app will be live at `https://<your-service-name>.onrender.com`.

---

## 🤖 Arduino ESP8266 Setup

The complete firmware code is located in [`arduino/esp8266_ninja_hattori/esp8266_ninja_hattori.ino`](file:///c:/Users/akash/OneDrive/Desktop/Iot_Project/arduino/esp8266_ninja_hattori/esp8266_ninja_hattori.ino).

### Required Arduino Libraries:
Install these via **Arduino IDE -> Tools -> Manage Libraries...**:
1. **DHT sensor library** (by Adafruit)
2. **Adafruit Unified Sensor** (by Adafruit)
3. **LiquidCrystal_I2C** (by Frank de Brabander or Marco Schwartz)
4. **ArduinoJson** (by Benoit Blanchon - v6 or v7)

### Configuring the Sketch:
1. Open [`esp8266_ninja_hattori.ino`](file:///c:/Users/akash/OneDrive/Desktop/Iot_Project/arduino/esp8266_ninja_hattori/esp8266_ninja_hattori.ino) in Arduino IDE.
2. Verify the WiFi credentials:
   ```cpp
   const char* ssid     = "COE YAVATMAL";
   const char* password = "shoaib845";
   ```
3. Update `serverBaseUrl`:
   - For local network testing: `const char* serverBaseUrl = "http://<YOUR_PC_LOCAL_IP>:3000";`
   - For Render deployment: `const char* serverBaseUrl = "https://ninja-hattori.onrender.com";`
4. Select your board: **Tools -> Board -> ESP8266 Boards -> NodeMCU 1.0 (ESP-12E Module)**.
5. Select the correct COM port and click **Upload**.

---

## 📡 API Reference

| Endpoint | Method | Access | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/register` | `POST` | Public | Create new user account (`name`, `email`, `password`) |
| `/api/auth/login` | `POST` | Public | Sign in and retrieve JWT token |
| `/api/sensor/latest` | `GET` | Public | Fetches latest temperature & humidity record |
| `/api/sensor/history` | `GET` | Public | Fetches recent records for Chart.js graphing |
| `/api/sensor/records` | `GET` | Public | Paginated records (`page=1&limit=20`) |
| `/api/sensor/records/:id` | `DELETE` | Authenticated | Deletes record by ID |
| `/api/sensor/data` | `POST` | Public | Ingests telemetry reading (`temperature`, `humidity`) |
| `/api/lcd` | `GET` | Public | Reads current 16x2 LCD rows |
| `/api/lcd` | `POST` | Authenticated | Updates 16x2 LCD text (`row1`, `row2`) |
| `/api/led` | `GET` | Public | Reads current LED state (0 or 1) |
| `/api/led` | `POST` | Authenticated | Toggles LED state (`state: 1` or `0`) |
| `/api/device/sync` | `GET/POST` | Public | Single roundtrip sync for ESP8266 (sends telemetry, gets LCD & LED) |

---

## 👨‍💻 Project Credits
**Designed and Developed by Akash-Parth-Suraj , Dept. of Electrical Engineering, GCOEY.**
