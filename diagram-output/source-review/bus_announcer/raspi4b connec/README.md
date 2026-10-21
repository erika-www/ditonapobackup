# Raspberry Pi 4B ↔ Pi 3B Communication & Firefox Kiosk Setup

This guide documents the communication protocol between the **Raspberry Pi 4B** (running the Personnel App in Firefox Kiosk mode) and the **Raspberry Pi 3B** (running the Bus Announcer & GPS receiver).

---

## 1. Network & Architecture Overview

```
 +-------------------------------------------------------------------------------+
 |                        RASPBERRY PI 4B (192.168.10.4)                         |
 |                                                                               |
 |   +------------------------------------+                                      |
 |   | Firefox Kiosk Mode (Personnel App) |                                      |
 |   | - Runs on http://localhost:5174    |                                      |
 |   | - Dispatches Northbound/Southbound |                                      |
 |   | - Displays live bus & stop status  |                                      |
 |   +-----------------+------------------+                                      |
 |                     | HTTP REST (port 5007 with CORS)                         |
 |                     v                                                         |
 |   +-----------------+-----------------------------------------------------+   |
 |   |             bridge.py / pi3b.py (Background Service)                  |   |
 |   |                                                                       |   |
 |   |  [Local HTTP API :5007]            [UDP GPS Listener :5005]           |   |
 |   |   POST /api/trip/start              Binds 0.0.0.0:5005                |   |
 |   |   POST /api/trip/end                Parses JSON/CSV GPS fix           |   |
 |   |   GET  /api/state                   Rate-limits cloud ingest (>=1.5s) |   |
 |   |   GET  /api/status & /api/gps       Exposes latest fix to web app     |   |
 |   +---------+----------------------------------^--------------------------+   |
 +-------------|----------------------------------|------------------------------+
               | Ethernet (HTTP commands)         | Ethernet (UDP GPS stream)
               | Target: http://192.168.10.3:8080 | Target: 192.168.10.4:5005
               v                                  |
 +-------------+----------------------------------+------------------------------+
 |                        RASPBERRY PI 3B (192.168.10.3)                         |
 |                                                                               |
 |   - Hardware: VK-162 GPS (USB serial), 3.5mm Audio Speaker, HDMI Monitor      |
 |   - GPS Sender (sender.py): Transmits UDP packets at 1 Hz to 192.168.10.4:5005|
 |   - Announcer Web API (web.py): Listens on 0.0.0.0:8080                       |
 +-------------------------------------------------------------------------------+
```

---

## 2. Communication Protocol Specification

### Direction 1: Pi 3B sends GPS to Pi 4B
* **Transport**: UDP to `192.168.10.4` on port `5005`.
* **Format**: Plain UTF-8 JSON object (one per packet):
  ```json
  {"latitude": 14.650221, "longitude": 121.052022, "timestamp": 1760770000.12}
  ```
  *(If `format: "csv"` is configured on 3B, it sends `14.650221,121.052022`. `bridge.py` automatically parses both JSON and CSV).*
* **Rate**: ~1 packet per second (`send_hz: 1` in `config.json`), only when GPS has a valid fix.
* **Reply**: No UDP reply required.

---

### Direction 2: Pi 4B sends Commands & Queries to Pi 3B
* **Transport**: HTTP to `http://192.168.10.3:8080`.
* **Headers**: `Content-Type: application/json`.

#### 1. Start Trip: `POST /api/trip/start`
* **Request Body**:
  ```json
  {"direction": "Northbound"}
  ```
  *(Also accepts `"Southbound"`, case-insensitive, with alternative keys `"tripDirection"` or `"route"`).*
* **Success Reply (HTTP 200)**:
  ```json
  {"ok": true, "direction": "Northbound", "label": "QC Hall Interchange -> SB Road"}
  ```
* **Conflict Reply (HTTP 409)**:
  `{"error": "a trip is already active, so end it first"}`
  *(Note: `bridge.py` supports `"force": true` in the request body to automatically end any stale trip and start cleanly).*
* **Error Reply (HTTP 400)**: Bad direction or invalid JSON.
* **Forbidden Reply (HTTP 403)**: Pi 4B IP is not in `api.allow_from` in `config.json`.

#### 2. End / Pause Trip: `POST /api/trip/end`
* **Request Body**: `{}` or none.
* **Reply (HTTP 200)**:
  ```json
  {"ok": true}
  ```

#### 3. Read Announcer State: `GET /api/state`
* **Reply (HTTP 200)**:
  ```json
  {
    "active": true,
    "trip": "Northbound",
    "trip_label": "QC Hall Interchange -> SB Road",
    "stops": ["QC Hall Interchange", "Elliptical Road", "SB Road"],
    "idx": 0,
    "current_idx": 0,
    "phase": "en_route",
    "dist": 120,
    "banner": {"kind": "approaching", "tl": "...", "en": "..."},
    "trips_done": 2,
    "last_trip": {"direction": "Southbound", "finished_at": "2026-10-21 10:15:00"},
    "gps": {"fix": true, "lat": 14.650221, "lon": 121.052022, "kmh": 24.5}
  }
  ```

---

## 3. How the Personnel App Executes on Pi 4B

### Why a Browser Cannot Run `bridge.py` Directly
The Personnel App runs inside Firefox. Browsers operate in a sandboxed security model:
* A browser cannot listen to raw UDP sockets (port 5005).
* A browser cannot execute background Python scripts on the host OS.

### How the Bridge Solves This
1. `bridge.py` (or `pi3b.py`) runs as a **native background service** on the Pi 4B OS.
2. It listens to UDP 5005 for GPS packets from Pi 3B and stores the latest coordinates in memory.
3. It exposes a local HTTP server on `http://localhost:5007` with full CORS headers.
4. When the user interacts with Firefox (e.g., clicking "Start Trip" or changing direction), the React frontend calls `POST http://localhost:5007/api/trip/start`.
5. `bridge.py` immediately relays the command across Ethernet to Pi 3B (`http://192.168.10.3:8080/api/trip/start`).
6. The frontend polls `http://localhost:5007/api/gps` to receive real-time vehicle GPS fixes received from Pi 3B.

---

## 4. Raspberry Pi 4B Setup & Autostart

### Step 1: Install Python Dependencies
```bash
pip install requests python-dotenv
```

### Step 2: Set Static IP on Pi 4B Ethernet Interface
Ensure the Ethernet port on Pi 4B is set to `192.168.10.4`:
```bash
sudo nmcli con mod "Wired connection 1" ipv4.method manual ipv4.addresses 192.168.10.4/24 ipv6.method disabled
sudo nmcli con up "Wired connection 1"
```

### Step 3: Run Bridge as a System Service (systemd)
Copy the service file to systemd:
```bash
sudo cp "bus_announcer/raspi4b connec/pi-bridge.service" /etc/systemd/system/pi-bridge.service
sudo systemctl daemon-reload
sudo systemctl enable pi-bridge
sudo systemctl start pi-bridge
```
Verify the service is active:
```bash
sudo systemctl status pi-bridge
curl http://localhost:5007/health
```

### Step 4: Auto-Launch Firefox in Kiosk Mode on Boot
Copy the desktop autostart entry:
```bash
mkdir -p ~/.config/autostart
cp "bus_announcer/raspi4b connec/personnel-kiosk.desktop" ~/.config/autostart/
chmod +x "bus_announcer/raspi4b connec/start_kiosk.sh"
```
Now, whenever the Pi 4B boots up and logs in, Firefox will automatically launch in full-screen kiosk mode displaying the Personnel App.

---

## 5. Testing & Diagnostics (`test_comm.py`)

A comprehensive test script is included in `bus_announcer/raspi4b connec/test_comm.py`:

### Test 1: Verify Local Bridge on Pi 4B
```bash
python3 test_comm.py --test-bridge
```
Tests `/health`, `/api/status`, and `/api/gps` on `http://localhost:5007`.

### Test 2: Test Direct Communication with Pi 3B
```bash
python3 test_comm.py --test-3b --ip 192.168.10.3
```
Pings `GET /api/state`, `POST /api/trip/start`, and `POST /api/trip/end` directly on Pi 3B.

### Test 3: Send Simulated UDP GPS Packets
```bash
python3 test_comm.py --send-gps
```
Simulates Pi 3B sending 10 UDP GPS packets to `127.0.0.1:5005` to verify reception.

### Test 4: Run Complete Mock Pi 3B (Offline Testing)
If developing on a PC without the physical Pi 3B:
```bash
python3 test_comm.py --mock-3b
```
Runs a mock announcer on port 8080 and streams simulated GPS to port 5005.
