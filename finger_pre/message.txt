#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_Fingerprint.h>

// ================== WiFi ==================
const char* ssid = "Save";
const char* password = "09028325";

// ================== Backend ==================
#define SERVER_IP   "172.20.10.14"
#define SERVER_PORT "3000"

const char* DEVICE_ID = "esp32-room-101";

// ================== Fingerprint ==================
HardwareSerial mySerial(2); // UART2
Adafruit_Fingerprint finger(&mySerial);

// ================== State ==================
int currentSessionId = -1;   // ✅ GLOBAL ใช้ได้ทั้งไฟล์
unsigned long lastScan = 0;
int lastSessionId = -1;
int currentCommandId = -1;
int currentFingerprintId = -1;
int lastEnrollCommandId = -1;

// ================== MODE ==================
enum Mode {
  MODE_IDLE,
  MODE_ENROLL,
  MODE_SCAN
};

Mode currentMode = MODE_IDLE;
Mode lastMode    = MODE_IDLE;



void setup() {
  Serial.begin(115200);
  delay(1000);

  // Fingerprint UART
  mySerial.begin(57600, SERIAL_8N1, 16, 17);
  finger.begin(57600);

  if (!finger.verifyPassword()) {
    Serial.println("❌ Fingerprint sensor not found");
    delay(3000);
    return;   // ปล่อยให้ระบบยังทำงานต่อ
  }

  Serial.println("✅ Fingerprint sensor ready");

  // WiFi
  WiFi.begin(ssid, password);
  Serial.print("📶 Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ WiFi connected");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}
void checkModeFromServer() {
  HTTPClient http;
  String url = String("http://") + SERVER_IP + ":" + SERVER_PORT + "/api/iot/mode";

  http.begin(url);
  int code = http.GET();

  if (code == 200) {
    StaticJsonDocument<256> doc;
    deserializeJson(doc, http.getString());

    String mode = doc["mode"];

    if (mode == "idle") {
      currentMode = MODE_IDLE;
    }
    else if (mode == "enroll") {
      currentMode = MODE_ENROLL;
      currentCommandId     = doc["command_id"];
      currentFingerprintId = doc["fingerprint_id"];
    }
    else if (mode == "scan") {
      currentMode      = MODE_SCAN;
      currentSessionId = doc["session_id"];
    }
  }

  http.end();
}


void notifyEnrollDone() {
  HTTPClient http;
  String url = String("http://") + SERVER_IP + ":" + SERVER_PORT + "/api/iot/enroll/done";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["command_id"] = currentCommandId;

  String body;
  serializeJson(doc, body);

  http.POST(body);
  http.end();
}


unsigned long lastSessionCheck = 0;
bool wasLive = false;
void loop() {
  if (WiFi.status() != WL_CONNECTED) return;

  // 🔄 เช็คโหมดทุก 3 วิ
  if (millis() - lastSessionCheck > 3000) {
    checkModeFromServer();
    lastSessionCheck = millis();
  }

  // 🔔 log เฉพาะตอน mode เปลี่ยน
  if (currentMode != lastMode) {
    if (currentMode == MODE_IDLE)   Serial.println("🔵 MODE: IDLE");
    if (currentMode == MODE_ENROLL) Serial.println("🟡 MODE: ENROLL");
    if (currentMode == MODE_SCAN)   Serial.println("🟢 MODE: SCAN");
    lastMode = currentMode;
  }

  // 🟡 ENROLL ทำครั้งเดียว
  if (currentMode == MODE_ENROLL) {

  // ❗ ถ้า command นี้ทำไปแล้ว → ไม่ทำซ้ำ
  if (currentCommandId == lastEnrollCommandId) {
    return;
  }

  Serial.println("🟡 START ENROLL");

  lastEnrollCommandId = currentCommandId;  // 🔒 ล็อก command นี้

  enrollFingerprint(currentFingerprintId);
  notifyEnrollDone();

  currentMode = MODE_IDLE;
  currentCommandId = -1;
  currentFingerprintId = -1;

  Serial.println("🟢 ENROLL DONE → IDLE");
  delay(2000);
  return;
}


  // 🟢 SCAN
  if (currentMode == MODE_SCAN) {
    if (millis() - lastScan < 2000) return;

    int id = getFingerprintID();
    if (id > 0) {
      sendAttendance(id);
      lastScan = millis();
    }
  }
}


// ================== Scan Finger ==================
int getFingerprintID() {
  uint8_t p = finger.getImage();
  if (p != FINGERPRINT_OK) return -1;

  p = finger.image2Tz();
  if (p != FINGERPRINT_OK) return -1;

  p = finger.fingerFastSearch();
  if (p != FINGERPRINT_OK) {
    Serial.println("❌ ไม่พบลายนิ้วมือ");
    return -1;
  }

  Serial.print("🆔 Finger ID: ");
  Serial.println(finger.fingerID);
  return finger.fingerID;
}
bool fetchLiveSession() {
  HTTPClient http;
  String url = "http://172.20.10.14:3000/api/iot/live-session";

  http.begin(url);
  int code = http.GET();

  if (code != 200) {
    http.end();
    return false;
  }

  StaticJsonDocument<128> doc;
  deserializeJson(doc, http.getString());
  http.end();

  if (!doc["live"]) {
    if (currentSessionId != -1) {
      Serial.println("🔴 ไม่มีคาบเรียน (NOT LIVE)");
    }
    currentSessionId = -1;
    lastSessionId = -1;
    return false;
  }

  int newSessionId = doc["session_id"];

  // ✅ log เฉพาะตอน session เปลี่ยน
  if (newSessionId != lastSessionId) {
    Serial.print("🟢 LIVE session: ");
    Serial.println(newSessionId);
    lastSessionId = newSessionId;
  }

  currentSessionId = newSessionId;
  return true;
}

void enrollFingerprint(int id) {
  int p;

  Serial.println("👉 วางนิ้วมือ");

  while ((p = finger.getImage()) != FINGERPRINT_OK) {
    delay(100);
  }
  finger.image2Tz(1);

  Serial.println("✋ ยกนิ้วออก");
  delay(2000);

  Serial.println("👉 วางนิ้วเดิมอีกครั้ง");

  while ((p = finger.getImage()) != FINGERPRINT_OK) {
    delay(100);
  }
  finger.image2Tz(2);

  if (finger.createModel() != FINGERPRINT_OK) {
    Serial.println("❌ Enroll failed");
    return;
  }

  if (finger.storeModel(id) == FINGERPRINT_OK) {
    Serial.print("✅ Enroll SUCCESS (ID=");
    Serial.print(id);
    Serial.println(")");
  } else {
    Serial.println("❌ Store failed");
  }
}


// ================== Send Attendance ==================
void sendAttendance(int fingerprint_id) {
  if (currentSessionId <= 0) {
    Serial.println("🚫 ไม่มี LIVE session");
    return;
  }

  HTTPClient http;
  String url = String("http://") + SERVER_IP + ":" + SERVER_PORT + "/api/attendance";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["fingerprint_id"] = fingerprint_id;
  doc["session_id"]     = currentSessionId;   // ✅ ใช้ค่าที่ดึงมา
  doc["device_id"]      = DEVICE_ID;

  String body;
  serializeJson(doc, body);

  int httpCode = http.POST(body);
  String response = http.getString();

  Serial.println("HTTP Code: " + String(httpCode));
  Serial.println("Response: " + response);

  if (httpCode == 200) {
    Serial.println("✅ เช็คชื่อสำเร็จ");
  }
  else if (httpCode == 403) {
    Serial.println("🚫 ยังไม่เปิดคาบเรียน (NOT LIVE)");
  }
  else {
    Serial.println("⚠️ Error");
  }

  http.end();
}



