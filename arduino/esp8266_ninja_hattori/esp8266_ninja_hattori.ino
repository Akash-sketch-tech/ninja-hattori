/*
 * =========================================================================================
 * Project: Ninja_hattori - IoT Smart Environment, LCD & LED Automation
 * Designed and Developed by Akash-Parth-Suraj, Dept. of Electrical Engineering, GCOEY.
 * =========================================================================================
 * 
 * Hardware Connections (ESP8266 NodeMCU):
 * - DHT11 Data Pin    -> D5 (GPIO 14)
 * - LED Anode (+)      -> D6 (GPIO 12) [with 220Ω - 330Ω resistor to GND]
 * - I2C LCD 16x2 SCL  -> D1 (GPIO 5)
 * - I2C LCD 16x2 SDA  -> D2 (GPIO 4)
 * - I2C LCD VCC       -> 5V / Vin (or 3.3V)
 * - I2C LCD GND       -> GND
 * 
 * Required Libraries (Install via Arduino Library Manager):
 * 1. "DHT sensor library" by Adafruit
 * 2. "Adafruit Unified Sensor" by Adafruit
 * 3. "LiquidCrystal_I2C" by Frank de Brabander or Marco Schwartz
 * 4. "ArduinoJson" by Benoit Blanchon (Supports v6 and v7)
 * =========================================================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ----------------- WiFi Configuration -----------------
const char* ssid     = "COE YAVATMAL";
const char* password = "shoaib845";

// ----------------- Render Production Server -----------
// Live Deployed URL on Render:
const char* serverBaseUrl = "https://ninja-hattori.onrender.com";

// ----------------- Pin Definitions --------------------
#define DHTPIN   14    // D5 (GPIO 14)
#define DHTTYPE  DHT11 // Sensor DHT 11
#define LEDPIN   12    // D6 (GPIO 12)
#define I2C_SDA  4     // D2 (GPIO 4)
#define I2C_SCL  5     // D1 (GPIO 5)

// ----------------- Peripherals Setup ------------------
DHT dht(DHTPIN, DHTTYPE);
LiquidCrystal_I2C lcd(0x27, 16, 2); // Change address to 0x3F if 0x27 does not respond

// ----------------- Global Variables -------------------
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 10000; // 10 seconds interval

String currentLcdRow1 = "";
String currentLcdRow2 = "";
int currentLedState = 0;
bool isFirstSync = true;

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n\n===========================================");
  Serial.println("   Ninja_hattori IoT NodeMCU - Render Live  ");
  Serial.println("  Dept. of Electrical Engineering, GCOEY   ");
  Serial.println("===========================================");

  // Initialize LED Pin D6
  pinMode(LEDPIN, OUTPUT);
  digitalWrite(LEDPIN, LOW);

  // Initialize I2C Pins explicitly for ESP8266
  Wire.begin(I2C_SDA, I2C_SCL);

  // Initialize 16x2 LCD
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Ninja_hattori");
  lcd.setCursor(0, 1);
  lcd.print("Dept of EE GCOEY");
  delay(2000);

  // Initialize DHT11 Sensor
  dht.begin();

  // Connect to WiFi
  connectToWiFi();
}

void loop() {
  // Ensure WiFi remains connected
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Lost connection. Reconnecting...");
    connectToWiFi();
  }

  // Periodic sensor reading and sync every 10 seconds
  unsigned long currentMillis = millis();
  if (currentMillis - lastSendTime >= sendInterval || lastSendTime == 0) {
    lastSendTime = currentMillis;
    syncWithServer();
  }
}

void connectToWiFi() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi:");
  lcd.setCursor(0, 1);
  lcd.print(ssid);

  Serial.print("[WiFi] Connecting to: ");
  Serial.println(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected Successfully!");
    Serial.print("[WiFi] Local IP: ");
    Serial.println(WiFi.localIP());

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(2000);

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Ninja_hattori");
    lcd.setCursor(0, 1);
    lcd.print("Connecting Cloud");
  } else {
    Serial.println("\n[WiFi] Connection Failed. Will retry in loop.");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Failed!");
    lcd.setCursor(0, 1);
    lcd.print("Retrying...");
  }
}

void syncWithServer() {
  // 1. Read DHT11 Sensor
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();

  // Check if reading is valid
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("[DHT11] Warning: Failed to read from sensor!");
    temperature = 0.0;
    humidity = 0.0;
  } else {
    Serial.printf("[DHT11] Temp: %.1f C | Hum: %.1f %%\n", temperature, humidity);
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Sync] Skipped: WiFi not connected.");
    return;
  }

  // 2. Prepare HTTPS Request to Render Cloud
  WiFiClientSecure secureClient;
  // Bypass SSL certificate check (Render uses Let's Encrypt / Cloudflare SSL)
  secureClient.setInsecure();
  // Optimize TLS buffer size for ESP8266 memory
  secureClient.setBufferSizes(1024, 1024);

  HTTPClient http;
  String syncEndpoint = String(serverBaseUrl) + "/api/device/sync?temp=" + String(temperature, 1) + "&hum=" + String(humidity, 1);

  Serial.println("\n[Sync] Sending request to Render:");
  Serial.println("       " + syncEndpoint);

  // Begin HTTPS connection
  http.begin(secureClient, syncEndpoint);
  http.addHeader("Content-Type", "application/json");
  http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
  http.setTimeout(15000); // 15 seconds to accommodate any Render cold starts

  int httpCode = http.GET();

  if (httpCode > 0) {
    String payload = http.getString();
    Serial.printf("[Sync] HTTP Code: %d\n", httpCode);

    if (httpCode == HTTP_CODE_OK || httpCode == 201) {
      Serial.println("[Sync] Response: " + payload);

      // Parse JSON response (Supports both ArduinoJson v6 and v7)
      #if ARDUINOJSON_VERSION_MAJOR >= 7
        JsonDocument doc;
      #else
        DynamicJsonDocument doc(1024);
      #endif

      DeserializationError error = deserializeJson(doc, payload);

      if (!error) {
        // --- Process LED State (Pin D6) ---
        int ledState = doc["led"] | 0;
        currentLedState = ledState;
        if (ledState == 1) {
          digitalWrite(LEDPIN, HIGH);
          Serial.println("[LED D6] State: HIGH (ON)");
        } else {
          digitalWrite(LEDPIN, LOW);
          Serial.println("[LED D6] State: LOW (OFF)");
        }

        // --- Process LCD Content (16x2 I2C) ---
        const char* r1 = doc["lcd"]["row1"] | "Ninja_hattori";
        const char* r2 = doc["lcd"]["row2"] | "IoT Active!";

        String newRow1 = String(r1);
        String newRow2 = String(r2);

        // Update LCD when text changes or on first successful cloud sync
        if (isFirstSync || newRow1 != currentLcdRow1 || newRow2 != currentLcdRow2) {
          isFirstSync = false;
          currentLcdRow1 = newRow1;
          currentLcdRow2 = newRow2;
          updateLcd(newRow1, newRow2);
        }
      } else {
        Serial.print("[JSON] Parsing error: ");
        Serial.println(error.c_str());
      }
    } else {
      Serial.printf("[HTTP] Non-OK status code received: %d\n", httpCode);
    }
  } else {
    Serial.printf("[HTTP] Request failed, error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

void updateLcd(String line1, String line2) {
  // Pad or truncate to 16 characters for clean display without ghost characters
  while (line1.length() < 16) line1 += " ";
  if (line1.length() > 16) line1 = line1.substring(0, 16);

  while (line2.length() < 16) line2 += " ";
  if (line2.length() > 16) line2 = line2.substring(0, 16);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);

  Serial.println("[LCD] Display updated:");
  Serial.println("  Line 1: [" + line1 + "]");
  Serial.println("  Line 2: [" + line2 + "]");
}
