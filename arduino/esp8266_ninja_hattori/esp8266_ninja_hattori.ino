/*
 * =========================================================================================
 * Project: Ninja_hattori - IoT Smart Environment, LCD & LED Automation
 * Designed and Developed by Akash-Parth-Suraj, Dept. of Electrical Engineering, GCOEY.
 * =========================================================================================
 * 
 * Hardware Connections (ESP8266 NodeMCU):
 * - DHT11 Data Pin   -> D5 (GPIO 14)
 * - LED Anode (+)     -> D6 (GPIO 12) [with 220Ω resistor to GND]
 * - I2C LCD 16x2 SCL -> D1 (GPIO 5)
 * - I2C LCD 16x2 SDA -> D2 (GPIO 4)
 * - I2C LCD VCC      -> 5V / Vin (or 3.3V depending on module)
 * - I2C LCD GND      -> GND
 * 
 * Required Libraries (Install via Arduino Library Manager):
 * 1. "DHT sensor library" by Adafruit
 * 2. "Adafruit Unified Sensor" by Adafruit
 * 3. "LiquidCrystal_I2C" by Frank de Brabander or Marco Schwartz
 * 4. "ArduinoJson" by Benoit Blanchon (Version 6 or 7)
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

// ----------------- Server Configuration ---------------
// IMPORTANT:
// When testing locally: Use your laptop's local IP, e.g. "http://192.168.1.100:3000"
// When deployed on Render: Use your Render URL, e.g. "https://ninja-hattori.onrender.com"
const char* serverBaseUrl = "http://192.168.1.100:3000"; 
// Example for Render: const char* serverBaseUrl = "https://ninja-hattori.onrender.com";

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

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n\n===========================================");
  Serial.println("  Ninja_hattori IoT NodeMCU Initializing   ");
  Serial.println("===========================================");

  // Initialize LED Pin
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

  // Initialize DHT Sensor
  dht.begin();

  // Connect to WiFi
  connectToWiFi();
}

void loop() {
  // Ensure WiFi is connected
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

  Serial.print("Connecting to WiFi: ");
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
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());

    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Connected!");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(2000);
    lcd.clear();
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

  // Check if readings failed
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("[DHT11] Warning: Failed to read from DHT sensor!");
    temperature = 0.0;
    humidity = 0.0;
  } else {
    Serial.printf("[DHT11] Temp: %.1f C, Hum: %.1f %%\n", temperature, humidity);
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Sync] Skipped, WiFi not connected.");
    return;
  }

  // 2. Prepare HTTP Request to the Unified Sync endpoint
  HTTPClient http;
  WiFiClient client;
  WiFiClientSecure secureClient;

  String syncEndpoint = String(serverBaseUrl) + "/api/device/sync?temp=" + String(temperature, 1) + "&hum=" + String(humidity, 1);

  bool isHttps = String(serverBaseUrl).startsWith("https");
  if (isHttps) {
    secureClient.setInsecure(); // Bypass SSL fingerprint check for Render
    http.begin(secureClient, syncEndpoint);
  } else {
    http.begin(client, syncEndpoint);
  }

  http.addHeader("Content-Type", "application/json");
  http.setTimeout(8000);

  Serial.println("[Sync] Contacting server: " + syncEndpoint);
  int httpCode = http.GET();

  if (httpCode > 0) {
    String payload = http.getString();
    Serial.printf("[Sync] Response code: %d\n", httpCode);
    Serial.println("[Sync] Payload: " + payload);

    if (httpCode == HTTP_CODE_OK || httpCode == 201) {
      // Parse JSON response
      DynamicJsonDocument doc(1024);
      DeserializationError error = deserializeJson(doc, payload);

      if (!error) {
        // --- Process LED State ---
        int ledState = doc["led"] | 0;
        currentLedState = ledState;
        if (ledState == 1) {
          digitalWrite(LEDPIN, HIGH);
          Serial.println("[LED] State -> HIGH (ON)");
        } else {
          digitalWrite(LEDPIN, LOW);
          Serial.println("[LED] State -> LOW (OFF)");
        }

        // --- Process LCD Content ---
        const char* r1 = doc["lcd"]["row1"] | "Ninja_hattori";
        const char* r2 = doc["lcd"]["row2"] | "IoT Active!";

        String newRow1 = String(r1);
        String newRow2 = String(r2);

        // Update LCD only if text changed to reduce flickering
        if (newRow1 != currentLcdRow1 || newRow2 != currentLcdRow2) {
          currentLcdRow1 = newRow1;
          currentLcdRow2 = newRow2;
          updateLcd(newRow1, newRow2);
        }
      } else {
        Serial.print("[JSON] Deserialization error: ");
        Serial.println(error.c_str());
      }
    }
  } else {
    Serial.printf("[HTTP] GET failed, error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

void updateLcd(String line1, String line2) {
  // Pad or truncate to 16 characters for clean display
  while (line1.length() < 16) line1 += " ";
  if (line1.length() > 16) line1 = line1.substring(0, 16);

  while (line2.length() < 16) line2 += " ";
  if (line2.length() > 16) line2 = line2.substring(0, 16);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);

  Serial.println("[LCD] Updated display:");
  Serial.println("  Line 1: [" + line1 + "]");
  Serial.println("  Line 2: [" + line2 + "]");
}
