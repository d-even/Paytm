// ─────────────────────────────────────────────────────────────
//  Copy this file to config.h and fill in your values.
//  config.h is git-ignored — it holds your Wi-Fi password and device secret.
// ─────────────────────────────────────────────────────────────
#pragma once

// Wi-Fi (2.4 GHz only). The laptop running the server must be on the SAME network.
// Tip: a phone hotspot works well at hackathons.
#define WIFI_SSID        "Deven"
#define WIFI_PASSWORD    "INDIA070"

// The laptop's LAN IP — printed by `npm run dev` as "Phones & ESP32 reach it → …"
// Do NOT use "localhost" — that would mean the ESP32 itself.
#define API_BASE_URL     "http://10.85.17.217:4000"

// Must match an entry in the server's .env:
//   POS_DEVICE_SECRETS=POS-RAMESH-01:<same 64-hex secret>
// Generate the secret with:  npm run gen:device-secret
#define DEVICE_ID        "POS-RAMESH-01"
#define DEVICE_SECRET    "202d2e7ac02ce5f1d8fdca4e0c2ce1c6249042c1bf627788c9b299cadc4236e2"

// Requests are timestamped (replay protection), so the clock must be right.
#define NTP_SERVER       "pool.ntp.org"
