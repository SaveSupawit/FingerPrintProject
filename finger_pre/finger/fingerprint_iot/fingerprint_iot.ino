#include <WiFi.h>
#include <HTTPClient.h>
#include <Adafruit_Fingerprint.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>

// ================= Config =================
const char* ssid = "N";
const char* password = "12345678"; // Replace with actual password if needed or keep existing
const String SERVER_IP = "172.20.10.3";
const String SERVER_PORT = "3000";

// Pins
#define RX_PIN 16
#define TX_PIN 17

// OLED Config
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Fingerprint Config
HardwareSerial mySerial(2);
Adafruit_Fingerprint finger = Adafruit_Fingerprint(&mySerial);

// Globals
enum Mode { MODE_IDLE, MODE_SCAN, MODE_ENROLL };
Mode currentMode = MODE_IDLE;
Mode lastMode = MODE_IDLE;

int currentSessionId = 0;
int enrollFingerId = 0;
int enrollCommandId = 0;
int currentFingerprintId = 0;

unsigned long lastPollTime = 0;
const unsigned long POLL_INTERVAL = 1500; // Check mode every 1.5s

// Forward declarations
void syncTemplates();
void writeTemplateToSensor(int id, String hexStr);
void sendRawPacket(uint8_t packetType, uint8_t *payload, uint16_t length);
void checkModeFromServer();
void sendAttendance(int fid);
void sendEnrollDone(String templateHex);
void handleScan();
void handleEnroll();
int getFingerprintID();
void displayStatus(String title, String sub);
void displayResult(String name, String status);

void setup() {
  Serial.begin(115200);

  // Init OLED
  if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { 
    Serial.println(F("SSD1306 allocation failed"));
    for(;;);
  }
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0,0);
  display.println("Booting...");
  display.display();

  // Init Fingerprint
  mySerial.begin(57600, SERIAL_8N1, RX_PIN, TX_PIN);
  finger.begin(57600);
  if (finger.verifyPassword()) {
    Serial.println("Fingerprint sensor found!");
  } else {
    Serial.println("Fingerprint sensor NOT found :(");
    display.clearDisplay();
    display.setCursor(0,0);
    display.println("No Fingerprint Sensor!");
    display.display();
    while (1) { delay(1); }
  }

  // Connect WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting");
  display.clearDisplay();
  display.setCursor(0,0);
  display.println("Connecting WiFi...");
  display.display();
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected!");
  Serial.println(WiFi.localIP());
  
  display.clearDisplay();
  display.setCursor(0,0);
  display.println("WiFi Connected");
  display.display();
  delay(1000);

  // Sync templates on boot
  syncTemplates();
}

void loop() {
  // 1. Poll Mode
  if (millis() - lastPollTime > POLL_INTERVAL) {
    checkModeFromServer();
    lastPollTime = millis();
  }

  // 2. Handle Logic
  if (currentMode != lastMode) {
     lastMode = currentMode;
     if (currentMode == MODE_IDLE) displayStatus("Ready", "Waiting...");
  }

  if (currentMode == MODE_SCAN) {
    handleScan();
  } else if (currentMode == MODE_ENROLL) {
    handleEnroll();
  }
}

// ================= UI Helper =================
void displayStatus(String title, String sub) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println(title);
  display.setTextSize(2);
  display.setCursor(0, 20);
  display.println(sub);
  display.display();
}

void displayResult(String name, String status) {
  display.clearDisplay();
  display.setTextSize(2);
  display.setCursor(0, 0);
  display.println(status); // "Present" or "Late"
  display.setTextSize(1);
  display.setCursor(0, 30);
  display.println(name);
  display.display();
}

// ================= Network =================
void checkModeFromServer() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String("http://") + SERVER_IP + ":" + SERVER_PORT + "/api/iot/mode";
  http.begin(url);
  
  int httpCode = http.GET();
  if (httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<512> doc;
    deserializeJson(doc, payload);

    String mode = doc["mode"]; // "idle", "scan", "enroll"
    
    if (mode == "scan") {
      currentMode = MODE_SCAN;
      currentSessionId = doc["session_id"];
    } else if (mode == "enroll") {
      currentMode = MODE_ENROLL;
      enrollCommandId = doc["command_id"];
      enrollFingerId = doc["fingerprint_id"];
    } else {
      currentMode = MODE_IDLE;
    }
  }
  http.end();
}

void sendAttendance(int fid) {
  if (WiFi.status() != WL_CONNECTED) return;
  displayStatus("Sending...", "Please wait");

  HTTPClient http;
  String url = String("http://") + SERVER_IP + ":" + SERVER_PORT + "/api/attendance";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<200> doc;
  doc["fingerprint_id"] = fid;
  doc["session_id"] = currentSessionId;
  doc["device_id"] = "ESP32-OLED";

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);
  if (httpCode == 200) {
    String resp = http.getString();
    // Parse response
    StaticJsonDocument<512> resDoc;
    deserializeJson(resDoc, resp);

    const char* name = resDoc["name"];
    const char* status = resDoc["status"]; // Present/Late/etc

    if (name && status) {
        displayResult(String(name), String(status));
    } else {
        displayStatus("Success", "Scan OK");
    }
  } else {
    displayStatus("Error!", "Send Failed");
  }
  http.end();
  delay(2000); 
  displayStatus("Scan Mode", "Place Finger...");
}

void sendEnrollDone(String templateHex) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String("http://") + SERVER_IP + ":" + SERVER_PORT + "/api/iot/enroll/done";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  // Use Dynamic as hex string is large
  DynamicJsonDocument doc(2048);
  doc["command_id"] = enrollCommandId;
  if(templateHex.length() > 0) {
    doc["template_data"] = templateHex;
  }
  String body;
  serializeJson(doc, body);

  http.POST(body);
  http.end();
  
  displayStatus("Success!", "Enroll Done");
  delay(1500);
  currentMode = MODE_IDLE; 
}


// ================= Logic =================
void handleScan() {
  int fid = getFingerprintID();
  if (fid >= 0) {
    Serial.print("Found ID: "); Serial.println(fid);
    sendAttendance(fid);
  }
}

void handleEnroll() {
  displayStatus("Enroll Mode", "ID: " + String(enrollFingerId));
  
  int p = -1;
  // Step 1
  Serial.println("Waiting for valid finger to enroll as #"); Serial.println(enrollFingerId);
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    if (millis() % 1000 == 0) checkModeFromServer();
    if (currentMode != MODE_ENROLL) return;
  }

  finger.image2Tz(1);
  displayStatus("Remove", "Finger");
  delay(2000);
  
  p = 0;
  while (p != FINGERPRINT_NOFINGER) {
    p = finger.getImage();
  }
  
  displayStatus("Place Again", "Same Finger");
  
  p = -1;
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
  }

  finger.image2Tz(2);
  
  p = finger.createModel();
  if (p == FINGERPRINT_OK) {
     p = finger.storeModel(enrollFingerId);
     if (p == FINGERPRINT_OK) {
       displayStatus("Uploading...", "Please Wait");
       
       // Extrating Template
       finger.loadModel(enrollFingerId);
       finger.getModel();
       uint8_t bytesReceived[534];
       memset(bytesReceived, 0xff, 534);
       uint32_t starttime = millis();
       int i = 0;
       while (i < 534 && (millis() - starttime) < 5000) {
         if (mySerial.available()) {
           bytesReceived[i++] = mySerial.read();
         }
       }
       String templateHex = "";
       if (i >= 534) {
         uint8_t fingerTemplate[512];
         int uindx = 9, index = 0;
         memcpy(fingerTemplate + index, bytesReceived + uindx, 256);
         uindx += 256; uindx += 2; uindx += 9; index += 256;
         memcpy(fingerTemplate + index, bytesReceived + uindx, 256);
         for(int j=0; j<512; j++) {
           char hexbuf[3];
           sprintf(hexbuf, "%02X", fingerTemplate[j]);
           templateHex += hexbuf;
         }
       }
       
       sendEnrollDone(templateHex);
     } else {
       displayStatus("Error", "Store Failed");
       delay(2000);
     }
  } else {
     displayStatus("Error", "Match Failed");
     delay(2000);
  }
  currentMode = MODE_IDLE; 
}

int getFingerprintID() {
  uint8_t p = finger.getImage();
  if (p != FINGERPRINT_OK) return -1;

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) return -1;

  p = finger.fingerFastSearch();
  if (p == FINGERPRINT_OK) {
    return finger.fingerID;
  } 
  return -1;
}

// ================= Template Sync =================

void sendRawPacket(uint8_t packetType, uint8_t *payload, uint16_t length) {
  uint16_t wire_length = length + 2;
  uint16_t sum = packetType + (wire_length >> 8) + (wire_length & 0xFF);
  mySerial.write(0xEF);
  mySerial.write(0x01);
  mySerial.write(0xFF); mySerial.write(0xFF); mySerial.write(0xFF); mySerial.write(0xFF); // address
  mySerial.write(packetType);
  mySerial.write((uint8_t)(wire_length >> 8));
  mySerial.write((uint8_t)(wire_length & 0xFF));
  for(int i=0; i<length; i++) {
    mySerial.write(payload[i]);
    sum += payload[i];
  }
  mySerial.write((uint8_t)(sum >> 8));
  mySerial.write((uint8_t)(sum & 0xFF));
}

void writeTemplateToSensor(int id, String hexStr) {
  if (hexStr.length() != 1024) return;
  uint8_t fingerTemplate[512];
  for(int i=0; i<512; i++) {
    char sub[3] = {hexStr.charAt(i*2), hexStr.charAt(i*2+1), '\0'};
    fingerTemplate[i] = (uint8_t)strtol(sub, NULL, 16);
  }
  
  // Send downChar command to Buffer 1
  uint8_t downcmd[] = { 0x09, 0x01 };
  sendRawPacket(0x01, downcmd, 2);
  delay(10);
  
  // Send 4 data packets of 128 bytes
  for(int p=0; p<4; p++) {
    uint8_t pType = (p == 3) ? 0x08 : 0x02; // ENDDATAPACKET or DATAPACKET
    sendRawPacket(pType, fingerTemplate + (p*128), 128);
    delay(10);
  }
  
  // Store it using adafruit library
  finger.storeModel(id);
}

void syncTemplates() {
  if (WiFi.status() != WL_CONNECTED) return;
  displayStatus("Syncing...", "Templates");
  
  HTTPClient http;
  String url = String("http://") + SERVER_IP + ":" + SERVER_PORT + "/api/iot/templates";
  http.begin(url);
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    // Use large doc for many templates
    DynamicJsonDocument doc(32768);
    DeserializationError error = deserializeJson(doc, payload);
    
    if (!error) {
      JsonArray arr = doc["templates"].as<JsonArray>();
      for(JsonObject tmpl : arr) {
        int id = tmpl["fingerprint_id"];
        String hexStr = tmpl["template_data"].as<String>();
        
        // Skip if already in sensor
        if (finger.loadModel(id) != FINGERPRINT_OK) {
           writeTemplateToSensor(id, hexStr);
        }
      }
    }
  }
  http.end();
  
  displayStatus("Sync OK", "");
  delay(1000);
}