# Hardware — RFID card reader (ESP32 / NodeMCU + RC522)

You only need **3 things**: an ESP32 (or ESP8266 NodeMCU) board, an **MFRC522 (RC522) RFID reader**, and RFID cards/key-fobs. The **laptop** does everything else — it is the counter screen, shows the payment QR, and *is* the Soundbox (the browser speaks).

```
 LAPTOP  /counter screen                         ESP32 + RC522
 ┌───────────────────────────────┐              ┌─────────────┐
 │ merchant types ₹240 → bill    │              │  card tap   │
 │ shows QR  +  "tap card"       │◄── bill ────►│  reads UID  │
 │                               │              └──────┬──────┘
 │ 🔊 "₹240 prapt hue, card se"  │   signed POST /api/v1/pos/card {rfidUid}
 │ 🔊 "Yeh regular customer…"    │◄─────────────────────┘
 │ agent feed · approvals · ask  │
 └───────────────────────────────┘
        ▲  customer can ALSO scan the QR with a phone → pays by UPI → same flow
```

The card reader never sends an amount — it just says *which card*. The server attaches it to the bill that's open on the laptop. So the same bill can be paid **by card or by QR**, whichever the customer prefers, and it can't be paid twice.

> **Scope note.** Real card payments at a Paytm EDC go through the certified EMV flow. Here an RFID tag stands in for a contactless card: it identifies the customer and settles the bill through the mock gateway. The agent's recognition logic is identical either way.

## Wiring — ESP32 DevKit / NodeMCU-32S

| RC522 pin | ESP32 pin |
|---|---|
| SDA (SS) | GPIO **5** |
| SCK | GPIO **18** |
| MOSI | GPIO **23** |
| MISO | GPIO **19** |
| IRQ | — (not connected) |
| GND | GND |
| RST | GPIO **4** |
| 3.3V | **3V3** ⚠️ never 5 V |

## Wiring — ESP8266 NodeMCU (if your "node module" is the ESP8266 one)

| RC522 pin | NodeMCU pin |
|---|---|
| SDA (SS) | **D8** |
| SCK | **D5** |
| MOSI | **D7** |
| MISO | **D6** |
| IRQ | — |
| GND | GND |
| RST | **D3** |
| 3.3V | **3V3** ⚠️ never 5 V |

The same `.ino` works on both — it detects the board at compile time.

**Feedback without a screen** (on-board LED):
| LED | Meaning |
|---|---|
| 3 quick blinks at boot | connected to Wi-Fi, ready |
| 1 long flash | bill paid ✅ |
| 2 short blinks | no bill open — card appears on the laptop so you can link it |
| rapid flicker | error — open Serial Monitor (115200) to see why |

## Flash it

1. **Arduino IDE 2.x** → *Boards Manager* → install **esp32 by Espressif Systems** (or **esp8266 by ESP8266 Community**).
   Select board **ESP32 Dev Module** (or **NodeMCU 1.0 (ESP-12E Module)**) and the right COM port.
2. *Library Manager* → install **MFRC522** (by GithubCommunity / miguelbalboa). That's the only library.
3. On the laptop:
   ```bash
   npm run gen:device-secret        # copy the 64-char secret
   ```
   In `.env`: `POS_DEVICE_SECRETS=POS-RAMESH-01:<secret>` — then start the server with `npm run dev`. It prints:
   ```
   Phones & ESP32 reach it → http://192.168.x.x:4000
   ```
4. Copy `esp32_rfid_pos/config.example.h` → `config.h` and fill in Wi-Fi name/password, `API_BASE_URL` = that `http://192.168.x.x:4000`, and the same `DEVICE_SECRET`.
5. Upload. Open Serial Monitor at **115200** — you should see `[rfid] MFRC522 ready`, `[wifi] connected`, `[ready] tap a card…`.

**Network:** laptop, ESP32 and the customer's phone must be on the **same 2.4 GHz Wi-Fi**. A phone hotspot is the easiest at a hackathon. Allow Node.js through the laptop firewall (Windows will ask the first time — click *Allow*, tick *Private networks*).

## Register your own cards (one time, ~30 seconds)

The demo data has two customers with history: **Sharma ji** (a regular) and **Gupta ji** (a regular who stopped coming 3 weeks ago). Link your physical cards to them:

1. Open `http://localhost:4000/counter` on the laptop (no bill open).
2. Tap card #1 → the screen shows **"Card scanned: XXXXXXXX (new card)"** → click **Sharma ji (regular)**.
3. Tap card #2 → click **Gupta ji (lapsed)**.

Any other card tapped during a bill becomes a brand-new customer (that works too — just no loyalty nudge yet).

## Demo flow at the table

1. Laptop: **Enable voice** → type `240` → **Create bill**. Screen shows the QR and "tap card".
2. Customer taps **card #1** → LED long flash → laptop says *"₹240 prapt hue, card se"* then *"Yeh regular customer hain, 19vi baar aaye hain — 10% loyalty discount dijiye"*.
3. New bill `310` → customer scans the **QR with their phone** → picks `gupta.ji@okaxis` → **Pay** → laptop: *"₹310 prapt hue, UPI se"* then *"Purane regular customer 20 din baad wapas aaye hain — welcome back"*. (The agent recognises UPI payers too — that's why hardware is optional.)
4. Click **Run agent now** → WhatsApp offers, win-back, loan suggestion appear in the feed and approvals.

## No hardware / reader not working?

`scripts/virtualPos.js` sends the byte-for-byte same signed request as the firmware:

```bash
npm run pos:tap -- A3F19C2B       # "taps" Sharma ji's demo card on the open bill
npm run pos:tap -- 7B22E4D1       # Gupta ji's demo card
```

## Troubleshooting

| Serial Monitor says | Fix |
|---|---|
| `reader NOT found` | wiring — especially SDA/SS and RST pins, and 3.3 V (not 5 V) |
| `[wifi] FAILED` | wrong SSID/password, or a 5 GHz network — ESP boards need 2.4 GHz |
| `[ntp] … NOT synced` | the Wi-Fi has no internet — a phone hotspot fixes it |
| `[pos] -1 connection refused` | wrong `API_BASE_URL`, laptop on another network, or firewall blocking port 4000 |
| `[pos] 401 … timestamp` | clock not synced (see NTP above) |
| `[pos] 401 bad signature` / `unknown device` | `DEVICE_SECRET` / `DEVICE_ID` don't match `.env`, or server not restarted after editing `.env` |
| `[pos] 403` | the merchant's `posDeviceIds` doesn't include your `DEVICE_ID` (seed data uses `POS-RAMESH-01`) |
| `[pos] 409` | not an error — no bill open; create one on the laptop |
| Phone can't open the QR page | phone not on the same Wi-Fi, or set `PUBLIC_BASE_URL` in `.env` to the laptop's IP |
