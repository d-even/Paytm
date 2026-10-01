/*
 * Vyapaar Mitra — RFID card reader (ESP32 or ESP8266 NodeMCU + MFRC522)
 * -----------------------------------------------------------------------
 * Minimal hardware: just the board + an RC522 reader + cards. The LAPTOP is the
 * counter screen and the Soundbox; this device only reads cards.
 *
 *   laptop: merchant types ₹240 → bill opens (QR + "tap card")
 *   customer taps card here ─► signed POST /api/v1/pos/card {rfidUid}
 *        ─► server pays the open bill ─► laptop: "₹240 prapt hue, card se"
 *        ─► agent recognises the customer ─► laptop: "Yeh regular customer hain…"
 *
 * If no bill is open, the tap still reaches the laptop screen so you can link the
 * card to a customer's UPI ID (that's how you register your own cards).
 *
 * Library (Arduino Library Manager): "MFRC522" by GithubCommunity (miguelbalboa)
 * Board: "ESP32 Dev Module"  — or —  "NodeMCU 1.0 (ESP-12E Module)" for ESP8266
 *
 * Security: every request is HMAC-SHA256 signed over "deviceId.timestamp.body".
 * The server rejects unknown devices, tampered bodies, stale timestamps and replays.
 */
#include <SPI.h>
#include <MFRC522.h>
#include <time.h>
#include "config.h"

#if defined(ESP32)
  #include <WiFi.h>
  #include <HTTPClient.h>
  #include "mbedtls/md.h"
  // ESP32 pins — SPI: SCK 18, MISO 19, MOSI 23
  #define SS_PIN   5
  #define RST_PIN  4
  #define LED_PIN  2          // on-board blue LED (active HIGH)
  #define LED_ON   HIGH
  #define LED_OFF  LOW
#elif defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <bearssl/bearssl.h>
  // NodeMCU ESP8266 pins — SPI: SCK D5, MISO D6, MOSI D7
  #define SS_PIN   D8
  #define RST_PIN  D3
  #define LED_PIN  LED_BUILTIN  // on-board LED (active LOW)
  #define LED_ON   LOW
  #define LED_OFF  HIGH
#else
  #error "Select an ESP32 or ESP8266 board"
#endif

MFRC522 rfid(SS_PIN, RST_PIN);
String lastUid = "";
unsigned long lastUidAt = 0;
const unsigned long SAME_CARD_COOLDOWN_MS = 3000;   // ignore the same card held on the reader

// ── LED patterns (the only local feedback — everything else is on the laptop) ──
void blink(int times, int onMs, int offMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, LED_ON);  delay(onMs);
    digitalWrite(LED_PIN, LED_OFF); delay(offMs);
  }
}
void ledPaid()    { blink(1, 900, 100); }   // one long flash  = payment done
void ledNoBill()  { blink(2, 150, 150); }   // two short       = no bill open (card shown on laptop)
void ledError()   { blink(5, 60, 60); }     // rapid flicker   = error, see Serial Monitor

// ── HMAC-SHA256 → lowercase hex ─────────────────────────────────────────
String hmacSha256Hex(const char* key, const String& msg) {
  uint8_t out[32];
#if defined(ESP32)
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)key, strlen(key));
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)msg.c_str(), msg.length());
  mbedtls_md_hmac_finish(&ctx, out);
  mbedtls_md_free(&ctx);
#else
  br_hmac_key_context kc;
  br_hmac_context hc;
  br_hmac_key_init(&kc, &br_sha256_vtable, key, strlen(key));
  br_hmac_init(&hc, &kc, 0);
  br_hmac_update(&hc, msg.c_str(), msg.length());
  br_hmac_out(&hc, out);
#endif
  char hex[65];
  for (int i = 0; i < 32; i++) sprintf(hex + i * 2, "%02x", out[i]);
  hex[64] = '\0';
  return String(hex);
}

String uidToHex(const MFRC522::Uid& uid) {
  String s = "";
  for (byte i = 0; i < uid.size; i++) {
    if (uid.uidByte[i] < 0x10) s += "0";
    s += String(uid.uidByte[i], HEX);
  }
  s.toUpperCase();
  return s;
}

// ── Network ─────────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.printf("[wifi] connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000) { delay(400); Serial.print("."); }
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n[wifi] FAILED — check WIFI_SSID / WIFI_PASSWORD (2.4 GHz only). Restarting.");
    ledError(); delay(2000); ESP.restart();
  }
  Serial.printf("\n[wifi] connected, IP %s\n", WiFi.localIP().toString().c_str());
}

void syncClock() {
  Serial.print("[ntp] syncing clock");
  configTime(0, 0, NTP_SERVER);                 // UTC epoch is all we need for signatures
  time_t now = time(nullptr);
  unsigned long t0 = millis();
  while (now < 1700000000 && millis() - t0 < 15000) { delay(400); Serial.print("."); now = time(nullptr); }
  Serial.printf("\n[ntp] epoch %ld %s\n", (long)now, now < 1700000000 ? "(NOT synced — requests will be rejected)" : "");
}

// Signed POST /api/v1/pos/card — the server finds the open bill for this device's merchant.
int sendCard(const String& uid, String& reply) {
  String body = "{\"rfidUid\":\"" + uid + "\"}";   // UID is hex only, safe to inline
  String ts = String((long)time(nullptr));
  String sig = hmacSha256Hex(DEVICE_SECRET, String(DEVICE_ID) + "." + ts + "." + body);

  WiFiClient client;
  HTTPClient http;
  http.begin(client, String(API_BASE_URL) + "/api/v1/pos/card");
  http.setTimeout(8000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-id", DEVICE_ID);
  http.addHeader("x-timestamp", ts);
  http.addHeader("x-signature", sig);
  int code = http.POST(body);
  reply = code > 0 ? http.getString() : http.errorToString(code);
  http.end();
  return code;
}

void setup() {
  Serial.begin(115200);
  delay(200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LED_OFF);
  Serial.println("\n=== Vyapaar Mitra RFID reader ===");

  SPI.begin();
  rfid.PCD_Init();
  delay(50);
  byte v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  if (v == 0x00 || v == 0xFF) Serial.println("[rfid] reader NOT found — check wiring (3.3V, SDA/SS, RST)");
  else Serial.printf("[rfid] MFRC522 ready (version 0x%02X)\n", v);

  connectWiFi();
  syncClock();
  Serial.println("[ready] tap a card…");
  blink(3, 80, 80);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  String uid = uidToHex(rfid.uid);
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
  if (uid == lastUid && millis() - lastUidAt < SAME_CARD_COOLDOWN_MS) return;
  lastUid = uid; lastUidAt = millis();

  Serial.printf("[rfid] card %s\n", uid.c_str());
  digitalWrite(LED_PIN, LED_ON);
  String reply;
  int code = sendCard(uid, reply);
  digitalWrite(LED_PIN, LED_OFF);
  Serial.printf("[pos] %d %s\n", code, reply.c_str());

  if (code == 201) ledPaid();
  else if (code == 409) ledNoBill();             // no bill open — laptop shows the card to link it
  else ledError();
}
