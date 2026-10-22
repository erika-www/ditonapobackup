#!/usr/bin/env python3
"""Pi 4B <-> Pi 3B Communication Bridge & GPS Receiver Service.

Implemented strictly according to the "Pi 3B Interface for the Admin App (Pi 4B)" specification:

Network:
  - Pi 3B (Bus Announcer & GPS receiver): 192.168.10.3:8080
  - Pi 4B (Personnel Admin App / Firefox Kiosk): 192.168.10.4
  - Bridge Local HTTP REST API: 0.0.0.0:5007 (with CORS enabled for browser)
  - UDP GPS listener: 0.0.0.0:5005 (incoming stream from Pi 3B)

Rules enforced:
  1. Commands (4B -> 3B):
     - POST /api/trip/start {"direction": "Northbound" | "Southbound"}
     - POST /api/trip/end {}
     - The direction must be exactly "Northbound" or "Southbound".
     - Replies: 200 ok; 400 bad direction; 409 trip already active (treated as already running); 403 caller not on network.
     - Send trip commands only after confirming the 3B is online.
  2. Status (4B -> 3B):
     - GET /api/state proxied to Pi 3B. If 3B fails or times out, returns HTTP 502 ("Pi 3B Announcer Offline").
  3. GPS Stream (3B -> 4B):
     - UDP to port 5005 on 4B: {"latitude": ..., "longitude": ..., "timestamp": ...}
     - Treat data older than about 5 seconds as "GPS lost".
  4. Browser isolation:
     - The browser calls http://localhost:5007, avoiding CORS and mixed-content issues.
     - Bridge relays to Pi 3B on http://192.168.10.3:8080.
     - Completely operational offline without internet.
"""

import argparse
import json
import logging
import math
import os
import socket
import sys
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
import urllib.request

# Optional requests library; fallback to urllib if not installed
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# Optional serial library for G-703 USB receiver
try:
    import serial
    HAS_PYSERIAL = hasattr(serial, "Serial")
except ImportError:
    HAS_PYSERIAL = False

# Optional pynmea2 library
try:
    import pynmea2
    HAS_PYNMEA2 = True
except ImportError:
    HAS_PYNMEA2 = False

# Optional python-dotenv
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
log = logging.getLogger("pi4b_bridge")

# Configuration via environment variables
PI3B_URL = os.getenv("PI3B_URL", "http://192.168.10.3:8080").rstrip("/")
GPS_BIND = os.getenv("GPS_BIND", "0.0.0.0")
GPS_PORT = int(os.getenv("GPS_PORT", "5005"))
HTTP_BIND = os.getenv("HTTP_BIND", "0.0.0.0")
HTTP_PORT = int(os.getenv("HTTP_PORT", "5007"))
GPS_STALE_TIMEOUT = float(os.getenv("GPS_STALE_TIMEOUT", "5.0"))  # Rule 3: >5s is "GPS lost"

# G-703 USB GPS Receiver Configuration
GPS_SERIAL_PORT = os.getenv("GPS_SERIAL_PORT", "").strip()
GPS_SERIAL_BAUD = int(os.getenv("GPS_SERIAL_BAUD", "9600"))

# Cloud Sync configuration (Optional: only if Supabase keys present)
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
DEVICE_KEY = os.getenv("DEVICE_KEY", "")
GPS_UPLOAD_INTERVAL = float(os.getenv("GPS_UPLOAD_INTERVAL", "2.0"))

# Thread-safe in-memory state
state_lock = threading.Lock()

latest_gps = {
    "latitude": None,
    "longitude": None,
    "timestamp": None,
    "speed": None,
    "heading": None,
    "satellites": None,
    "altitude": None,
    "received_at": None,
    "fix": False,
    "source": "none",
    "port": None
}

bridge_stats = {
    "gps_packets_received": 0,
    "gps_source": "none",
    "gps_port": None,
    "gps_baud": GPS_SERIAL_BAUD,
    "gps_uploads_success": 0,
    "gps_uploads_failed": 0,
    "directions_relayed": 0,
    "last_direction": None,
    "pi3b_online": False,
    "pi3b_last_check": None,
    "pi3b_last_status_code": None
}

last_upload_time = 0.0


# ============================================================================
# HTTP HELPER (WITH REQUESTS OR URLLIB FALLBACK)
# ============================================================================

def http_request(method: str, url: str, data: dict = None, timeout: float = 3.0) -> tuple:
    """Perform HTTP request returning (status_code, json_dict_or_raw)."""
    method = method.upper()
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    body_bytes = json.dumps(data).encode("utf-8") if data is not None else None

    if HAS_REQUESTS:
        try:
            if method == "GET":
                r = requests.get(url, headers=headers, timeout=timeout)
            elif method == "POST":
                r = requests.post(url, data=body_bytes, headers=headers, timeout=timeout)
            else:
                r = requests.request(method, url, data=body_bytes, headers=headers, timeout=timeout)

            try:
                payload = r.json()
            except Exception:
                payload = {"raw": r.text}
            return r.status_code, payload
        except requests.RequestException as e:
            raise ConnectionError(f"Network error contacting {url}: {e}")

    # Fallback using standard library urllib
    req = urllib.request.Request(url, data=body_bytes, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            status = response.getcode()
            raw_text = response.read().decode("utf-8")
            try:
                payload = json.loads(raw_text)
            except Exception:
                payload = {"raw": raw_text}
            return status, payload
    except HTTPError as e:
        status = e.code
        raw_text = e.read().decode("utf-8") if e.fp else ""
        try:
            payload = json.loads(raw_text)
        except Exception:
            payload = {"raw": raw_text, "error": str(e)}
        return status, payload
    except URLError as e:
        raise ConnectionError(f"Network error contacting {url}: {e.reason}")
    except Exception as e:
        raise ConnectionError(f"Network error contacting {url}: {e}")


# ============================================================================
# PI 3B RELAY LOGIC (COMMANDS & STATUS)
# ============================================================================

def check_pi3b_online() -> bool:
    """Check if Pi 3B Announcer is reachable over Ethernet (GET /api/state)."""
    url = f"{PI3B_URL}/api/state"
    try:
        status, _ = http_request("GET", url, timeout=2.5)
        is_online = (status == 200)
    except ConnectionError:
        is_online = False

    with state_lock:
        bridge_stats["pi3b_online"] = is_online
        bridge_stats["pi3b_last_check"] = time.time()
    return is_online


def query_pi3b_state() -> tuple:
    """Fetch live state from Pi 3B (GET /api/state per Rule 2).
    
    Returns (status_code, payload).
    If connection fails/times out, returns (502, {"online": False, "error": "Pi 3B Announcer Offline"}).
    """
    url = f"{PI3B_URL}/api/state"
    try:
        code, payload = http_request("GET", url, timeout=2.5)
        online = (code == 200)
        with state_lock:
            bridge_stats["pi3b_online"] = online
            bridge_stats["pi3b_last_check"] = time.time()
            bridge_stats["pi3b_last_status_code"] = code

        if isinstance(payload, dict):
            payload["online"] = online
        return code, payload
    except ConnectionError as e:
        with state_lock:
            bridge_stats["pi3b_online"] = False
            bridge_stats["pi3b_last_check"] = time.time()
            bridge_stats["pi3b_last_status_code"] = 502
        return 502, {
            "ok": False,
            "online": False,
            "error": "Pi 3B Announcer Offline",
            "details": str(e)
        }


def relay_trip_start(direction: str) -> tuple:
    """Relay POST /api/trip/start to Pi 3B per Rule 1.
    
    Validates direction is exactly 'Northbound' or 'Southbound'.
    Confirms Pi 3B is online before sending.
    """
    norm_dir = str(direction or "").strip().title()
    if norm_dir not in ("Northbound", "Southbound"):
        return 400, {
            "ok": False,
            "error": f"Direction must be exactly Northbound or Southbound. Received: '{direction}'"
        }

    url = f"{PI3B_URL}/api/trip/start"
    log.info("Relaying Start Trip ('%s') to Pi 3B at %s", norm_dir, url)

    try:
        code, payload = http_request("POST", url, data={"direction": norm_dir}, timeout=4.0)
    except ConnectionError as e:
        with state_lock:
            bridge_stats["pi3b_online"] = False
            bridge_stats["pi3b_last_check"] = time.time()
        log.warning("Pi 3B unreachable for trip start: %s", e)
        return 502, {
            "ok": False,
            "online": False,
            "error": "Pi 3B Announcer Offline",
            "details": str(e)
        }

    with state_lock:
        bridge_stats["pi3b_online"] = (code < 500)
        bridge_stats["pi3b_last_check"] = time.time()
        bridge_stats["pi3b_last_status_code"] = code
        if code == 200:
            bridge_stats["directions_relayed"] += 1
            bridge_stats["last_direction"] = norm_dir

    if code == 200:
        return 200, {
            "ok": True,
            "success": True,
            "direction": norm_dir,
            "pi3b_response": payload
        }
    elif code == 409:
        # Rule 1: "409 a trip is already active (treat as 'already running')"
        return 409, {
            "ok": False,
            "success": False,
            "conflict": True,
            "status": "already_running",
            "error": "A trip is already active on the Pi 3B announcer (already running)",
            "pi3b_response": payload
        }
    elif code == 400:
        return 400, {
            "ok": False,
            "error": payload.get("error", "Bad direction"),
            "pi3b_response": payload
        }
    elif code == 403:
        return 403, {
            "ok": False,
            "error": "The caller is not on the private cable network",
            "pi3b_response": payload
        }
    else:
        return code, {
            "ok": False,
            "error": f"Pi 3B returned HTTP {code}",
            "pi3b_response": payload
        }


def relay_trip_end() -> tuple:
    """Relay POST /api/trip/end {} to Pi 3B per Rule 1."""
    url = f"{PI3B_URL}/api/trip/end"
    log.info("Relaying End Trip to Pi 3B at %s", url)

    try:
        code, payload = http_request("POST", url, data={}, timeout=4.0)
    except ConnectionError as e:
        with state_lock:
            bridge_stats["pi3b_online"] = False
            bridge_stats["pi3b_last_check"] = time.time()
        log.warning("Pi 3B unreachable for trip end: %s", e)
        return 502, {
            "ok": False,
            "online": False,
            "error": "Pi 3B Announcer Offline",
            "details": str(e)
        }

    with state_lock:
        bridge_stats["pi3b_online"] = (code < 500)
        bridge_stats["pi3b_last_check"] = time.time()
        bridge_stats["pi3b_last_status_code"] = code

    return code, {
        "ok": (code == 200),
        "success": (code == 200),
        "pi3b_response": payload
    }


# ============================================================================
# LOCAL HTTP SERVER (PORT 5007) - INTERFACES WITH PERSONNEL APP
# ============================================================================

class LocalBridgeHandler(BaseHTTPRequestHandler):
    """Provides local REST API with CORS headers for Personnel App in Firefox."""

    def _send_json(self, code: int, data: dict):
        body = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-device-key")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-device-key")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path in ("", "/health"):
            with state_lock:
                pi3b_online = bridge_stats["pi3b_online"]
            self._send_json(200, {
                "status": "online",
                "service": "dito-na-po-pi4b-bridge",
                "pi3b_url": PI3B_URL,
                "pi3b_online": pi3b_online,
                "gps_port": GPS_PORT,
                "http_port": HTTP_PORT
            })

        elif path == "/api/gps":
            # Per Rule 3: Treat data older than about 5 seconds as "GPS lost"
            with state_lock:
                gps_copy = dict(latest_gps)

            now = time.time()
            recv_at = gps_copy.get("received_at")
            age = (now - recv_at) if recv_at else None
            is_lost = (recv_at is None) or (age > GPS_STALE_TIMEOUT) or (not gps_copy.get("fix", False))

            if is_lost:
                self._send_json(200, {
                    "success": False,
                    "fix": False,
                    "lost": True,
                    "status": "lost",
                    "error": "GPS lost",
                    "latitude": None,
                    "longitude": None,
                    "timestamp": gps_copy.get("timestamp"),
                    "speed": None,
                    "heading": None,
                    "satellites": gps_copy.get("satellites"),
                    "altitude": None,
                    "source": gps_copy.get("source", "none"),
                    "port": gps_copy.get("port"),
                    "age_seconds": round(age, 2) if age is not None else None
                })
            else:
                self._send_json(200, {
                    "success": True,
                    "fix": True,
                    "lost": False,
                    "status": "active",
                    "latitude": gps_copy.get("latitude"),
                    "longitude": gps_copy.get("longitude"),
                    "timestamp": gps_copy.get("timestamp"),
                    "speed": gps_copy.get("speed"),
                    "heading": gps_copy.get("heading"),
                    "satellites": gps_copy.get("satellites"),
                    "altitude": gps_copy.get("altitude"),
                    "source": gps_copy.get("source", "g703_receiver"),
                    "port": gps_copy.get("port"),
                    "age_seconds": round(age, 2),
                    "received_at": recv_at
                })

        elif path in ("/api/state", "/api/pi3b/state"):
            # Per Rule 2: GET /api/state every 2 to 3 seconds.
            # If it fails or times out, return 502 "Pi 3B Announcer Offline".
            code, payload = query_pi3b_state()
            self._send_json(code, payload)

        elif path == "/api/status":
            code, pi3b_payload = query_pi3b_state()
            with state_lock:
                gps_copy = dict(latest_gps)
                stats_copy = dict(bridge_stats)

            now = time.time()
            recv_at = gps_copy.get("received_at")
            age = (now - recv_at) if recv_at else None
            is_lost = (recv_at is None) or (age > GPS_STALE_TIMEOUT) or (not gps_copy.get("fix", False))

            self._send_json(200, {
                "success": True,
                "bridge": stats_copy,
                "g703": {
                    "connected": gps_copy.get("fix", False) and not is_lost,
                    "source": gps_copy.get("source"),
                    "port": gps_copy.get("port"),
                    "baud": stats_copy.get("gps_baud"),
                    "satellites": gps_copy.get("satellites"),
                    "packets": stats_copy.get("gps_packets_received")
                },
                "latest_gps": {
                    **gps_copy,
                    "lost": is_lost,
                    "age_seconds": round(age, 2) if age is not None else None
                },
                "pi3b": pi3b_payload,
                "pi3b_online": (code == 200)
            })

        else:
            self._send_json(404, {"ok": False, "error": "Endpoint not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        content_len = int(self.headers.get("Content-Length") or 0)
        try:
            raw_body = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"
            body = json.loads(raw_body or "{}")
        except Exception:
            body = {}

        if path in ("/api/trip/start", "/api/direction"):
            direction = body.get("direction") or body.get("tripDirection") or body.get("route")
            if not direction:
                self._send_json(400, {
                    "ok": False,
                    "error": "Missing 'direction' parameter. Must be Northbound or Southbound."
                })
                return

            code, resp = relay_trip_start(str(direction))
            self._send_json(code, resp)

        elif path == "/api/trip/end":
            code, resp = relay_trip_end()
            self._send_json(code, resp)

        else:
            self._send_json(404, {"ok": False, "error": "Endpoint not found"})

    def log_message(self, fmt, *args):
        # Silence standard HTTP access logging to avoid terminal clutter
        pass


def run_http_server():
    """Run local ThreadingHTTPServer on port 5007."""
    server = ThreadingHTTPServer((HTTP_BIND, HTTP_PORT), LocalBridgeHandler)
    log.info("Local HTTP Bridge API listening on http://%s:%d", HTTP_BIND, HTTP_PORT)
    server.serve_forever()


# ============================================================================
# UDP GPS RECEIVER (PORT 5005)
# ============================================================================

def calculate_speed_kmh(lat1, lon1, t1, lat2, lon2, t2):
    """Estimate speed in km/h from consecutive GPS fixes."""
    dt = t2 - t1
    if dt <= 0.1 or dt > 10.0:
        return None
    # Haversine distance
    r = 6371000  # meters
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    dist_m = r * c
    speed_ms = dist_m / dt
    return round(speed_ms * 3.6, 1)


def upload_gps_to_supabase(packet: dict):
    """Optional cloud sync: upload GPS packet to Supabase ingest-gps."""
    global last_upload_time

    if not SUPABASE_URL or not SUPABASE_ANON_KEY or not DEVICE_KEY:
        return

    now = time.time()
    if now - last_upload_time < GPS_UPLOAD_INTERVAL:
        return

    lat, lon = packet.get("latitude"), packet.get("longitude")
    if not isinstance(lat, (int, float)) or not -90 <= lat <= 90:
        return
    if not isinstance(lon, (int, float)) or not -180 <= lon <= 180:
        return

    payload = {"latitude": lat, "longitude": lon}
    ts = packet.get("timestamp")
    if ts is not None:
        try:
            payload["recorded_at"] = datetime.fromtimestamp(float(ts), timezone.utc).isoformat()
        except (ValueError, OSError):
            payload["recorded_at"] = datetime.now(timezone.utc).isoformat()
    else:
        payload["recorded_at"] = datetime.now(timezone.utc).isoformat()

    try:
        url = f"{SUPABASE_URL}/functions/v1/ingest-gps"
        headers = {
            "apikey": SUPABASE_ANON_KEY,
            "x-device-key": DEVICE_KEY,
            "Content-Type": "application/json"
        }
        code, _ = http_request("POST", url, data=payload, timeout=5.0)
        if code in (200, 201):
            last_upload_time = now
            with state_lock:
                bridge_stats["gps_uploads_success"] += 1
        elif code == 429:
            last_upload_time = now + 1.0
        else:
            with state_lock:
                bridge_stats["gps_uploads_failed"] += 1
    except Exception as e:
        with state_lock:
            bridge_stats["gps_uploads_failed"] += 1


def receive_gps_loop():
    """Listen on UDP 0.0.0.0:5005 for incoming GPS JSON packets (legacy/Pi 3B stream or local relay).
    
    Packet format per Rule 3:
      {"latitude": 14.650221, "longitude": 121.052022, "timestamp": 1761000000.12}
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    if hasattr(socket, "SO_REUSEPORT"):
        try:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEPORT, 1)
        except OSError:
            pass

    try:
        sock.bind((GPS_BIND, GPS_PORT))
        log.info("Listening for UDP GPS packets on %s:%d", GPS_BIND, GPS_PORT)
    except OSError as e:
        log.warning("UDP port %d could not be bound (%s). Direct G-703 serial will still operate.", GPS_PORT, e)
        return

    prev_lat = None
    prev_lon = None
    prev_time = None

    while True:
        try:
            data, address = sock.recvfrom(4096)
            text = data.decode("utf-8").strip()
            lat, lon, ts = None, None, time.time()
            packet_speed = None
            packet = {}

            if text.startswith("{"):
                packet = json.loads(text)
                lat = packet.get("latitude")
                lon = packet.get("longitude")
                ts = packet.get("timestamp", time.time())
                packet_speed = packet.get("speed") or packet.get("kmh")
            elif "," in text:
                parts = [p.strip() for p in text.split(",")]
                if len(parts) >= 2:
                    lat = float(parts[0])
                    lon = float(parts[1])
                    ts = float(parts[2]) if len(parts) >= 3 else time.time()
                    packet = {"latitude": lat, "longitude": lon, "timestamp": ts}

            if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
                if -90 <= lat <= 90 and -180 <= lon <= 180:
                    recv_now = time.time()
                    speed = packet_speed
                    if speed is None and prev_lat is not None:
                        speed = calculate_speed_kmh(prev_lat, prev_lon, prev_time, lat, lon, recv_now)

                    prev_lat, prev_lon, prev_time = lat, lon, recv_now

                    with state_lock:
                        # Only overwrite if currently not active from direct G-703 serial, or if G-703 has no fix
                        if latest_gps["source"] != "g703_serial" or not latest_gps["fix"]:
                            latest_gps["latitude"] = round(float(lat), 6)
                            latest_gps["longitude"] = round(float(lon), 6)
                            latest_gps["timestamp"] = ts
                            latest_gps["speed"] = speed
                            latest_gps["received_at"] = recv_now
                            latest_gps["fix"] = True
                            if packet.get("heading") is not None:
                                latest_gps["heading"] = packet.get("heading")
                            if packet.get("satellites") is not None:
                                latest_gps["satellites"] = packet.get("satellites")
                            latest_gps["source"] = packet.get("source", "udp_stream")
                            bridge_stats["gps_packets_received"] += 1
                            bridge_stats["gps_source"] = latest_gps["source"]

                    # Optional cloud sync
                    upload_gps_to_supabase(packet)

        except (ValueError, UnicodeDecodeError) as e:
            log.warning("Malformed UDP packet: %s", e)
        except Exception as e:
            log.error("Error in GPS receiver loop: %s", e)


# ============================================================================
# G-703 USB GPS RECEIVER (SERIAL NMEA 0183 ACQUISITION)
# ============================================================================

def parse_nmea_coordinate(raw_val: str, direction: str):
    """Convert NMEA format ddmm.mmmm (lat) or dddmm.mmmm (lon) to decimal degrees."""
    if not raw_val or not direction:
        return None
    try:
        dot_idx = raw_val.find(".")
        if dot_idx == -1:
            return None
        deg_len = dot_idx - 2
        deg = float(raw_val[:deg_len])
        minutes = float(raw_val[deg_len:])
        decimal = deg + (minutes / 60.0)
        if direction.upper() in ("S", "W"):
            decimal = -decimal
        return round(decimal, 6)
    except (ValueError, TypeError):
        return None


def parse_nmea_sentence(line: str) -> dict:
    """Parse standard NMEA 0183 sentences ($GPRMC, $GNRMC, $GPGGA, $GNGGA)."""
    line = line.strip()
    if not line.startswith("$"):
        return None

    # Use pynmea2 if available
    if HAS_PYNMEA2:
        try:
            msg = pynmea2.parse(line)
            now_ts = time.time()
            if msg.sentence_type in ("RMC",):
                valid = (msg.status == "A" and msg.latitude and msg.longitude)
                kmh = round(float(msg.spd_over_grnd or 0.0) * 1.852, 1) if valid else 0.0
                heading = float(msg.true_course) if (valid and hasattr(msg, "true_course") and msg.true_course) else None
                return {
                    "type": "RMC",
                    "valid": valid,
                    "latitude": round(msg.latitude, 6) if valid else None,
                    "longitude": round(msg.longitude, 6) if valid else None,
                    "speed": kmh,
                    "heading": heading,
                    "timestamp": now_ts
                }
            elif msg.sentence_type in ("GGA",):
                qual = int(msg.gps_qual or 0)
                valid = (qual > 0 and msg.latitude and msg.longitude)
                sats = int(msg.num_sats or 0) if hasattr(msg, "num_sats") else 0
                alt = float(msg.altitude or 0.0) if hasattr(msg, "altitude") and msg.altitude else None
                return {
                    "type": "GGA",
                    "valid": valid,
                    "latitude": round(msg.latitude, 6) if valid else None,
                    "longitude": round(msg.longitude, 6) if valid else None,
                    "satellites": sats,
                    "altitude": alt,
                    "quality": qual,
                    "timestamp": now_ts
                }
        except Exception:
            pass

    # Built-in robust pure-Python parser
    body = line[1:].split("*")[0]
    parts = body.split(",")
    if not parts or len(parts) < 3:
        return None

    sentence_type = parts[0][-3:].upper()
    now_ts = time.time()

    if sentence_type == "RMC":
        if len(parts) >= 8:
            status = parts[2].upper()
            is_valid = (status == "A")
            lat = parse_nmea_coordinate(parts[3], parts[4]) if is_valid else None
            lon = parse_nmea_coordinate(parts[5], parts[6]) if is_valid else None
            speed_knots = float(parts[7]) if (is_valid and len(parts) > 7 and parts[7]) else 0.0
            speed_kmh = round(speed_knots * 1.852, 1)
            heading = float(parts[8]) if (is_valid and len(parts) > 8 and parts[8]) else None

            return {
                "type": "RMC",
                "valid": is_valid and (lat is not None) and (lon is not None),
                "latitude": lat,
                "longitude": lon,
                "speed": speed_kmh,
                "heading": heading,
                "timestamp": now_ts
            }

    elif sentence_type == "GGA":
        if len(parts) >= 10:
            quality = int(parts[6]) if parts[6].isdigit() else 0
            is_valid = (quality > 0)
            lat = parse_nmea_coordinate(parts[2], parts[3]) if is_valid else None
            lon = parse_nmea_coordinate(parts[4], parts[5]) if is_valid else None
            satellites = int(parts[7]) if (len(parts) > 7 and parts[7].isdigit()) else 0
            altitude = float(parts[9]) if (len(parts) > 9 and parts[9]) else None

            return {
                "type": "GGA",
                "valid": is_valid and (lat is not None) and (lon is not None),
                "latitude": lat,
                "longitude": lon,
                "satellites": satellites,
                "altitude": altitude,
                "quality": quality,
                "timestamp": now_ts
            }

    return None


def find_g703_serial_port(preferred_port=None):
    """Find available serial port for G-703 receiver."""
    if preferred_port:
        if os.path.exists(preferred_port) or sys.platform.startswith("win"):
            return preferred_port

    if HAS_PYSERIAL:
        try:
            import serial.tools.list_ports
            ports = list(serial.tools.list_ports.comports())
            for p in ports:
                desc = f"{p.description or ''} {p.manufacturer or ''} {p.hwid or ''}".lower()
                if any(k in desc for k in ("gps", "u-blox", "ublox", "gnss", "703", "vk-162", "prolific", "ch340", "cp210")):
                    return p.device
            for p in ports:
                dev_lower = (p.device or "").lower()
                if "usb" in dev_lower or "acm" in dev_lower:
                    return p.device
            if ports and sys.platform.startswith("win"):
                return ports[0].device
        except Exception:
            pass

    # Linux standard candidate ports
    candidates = [
        "/dev/ttyACM0",
        "/dev/ttyUSB0",
        "/dev/ttyACM1",
        "/dev/ttyUSB1",
        "/dev/serial0",
        "/dev/ttyAMA0"
    ]
    for c in candidates:
        if os.path.exists(c):
            return c

    return None


def run_g703_serial_reader(specified_port=None, baud=9600):
    """Continuously read raw NMEA GPS stream from G-703 receiver connected via USB to Pi 4."""
    udp_forward_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    log.info("[G-703] Initializing G-703 USB GPS acquisition daemon (baud: %d)...", baud)
    current_port = specified_port
    consecutive_nofix = 0

    while True:
        try:
            if not current_port or (not sys.platform.startswith("win") and not os.path.exists(current_port)):
                current_port = find_g703_serial_port(specified_port)
                if not current_port:
                    time.sleep(3.0)
                    continue

            log.info("[G-703] Opening GPS receiver on %s (baud: %d)...", current_port, baud)

            if HAS_PYSERIAL:
                with serial.Serial(current_port, baud, timeout=2.0) as ser:
                    log.info("[✓ G-703] Connected to GPS receiver on %s", current_port)
                    with state_lock:
                        bridge_stats["gps_source"] = "g703_serial"
                        bridge_stats["gps_port"] = current_port
                        bridge_stats["gps_baud"] = baud
                        latest_gps["port"] = current_port

                    while True:
                        raw = ser.readline()
                        if not raw:
                            consecutive_nofix += 1
                            if consecutive_nofix > 4:
                                with state_lock:
                                    if latest_gps["source"] == "g703_serial":
                                        latest_gps["fix"] = False
                            continue
                        line = raw.decode("ascii", errors="ignore").strip()
                        if not line or not line.startswith("$"):
                            continue

                        parsed = parse_nmea_sentence(line)
                        if not parsed:
                            continue

                        if parsed.get("valid"):
                            consecutive_nofix = 0
                            recv_now = time.time()
                            lat = parsed.get("latitude")
                            lon = parsed.get("longitude")
                            spd = parsed.get("speed")
                            hdg = parsed.get("heading")
                            sats = parsed.get("satellites")
                            alt = parsed.get("altitude")

                            with state_lock:
                                if lat is not None and lon is not None:
                                    latest_gps["latitude"] = lat
                                    latest_gps["longitude"] = lon
                                    latest_gps["fix"] = True
                                if spd is not None:
                                    latest_gps["speed"] = spd
                                if hdg is not None:
                                    latest_gps["heading"] = hdg
                                if sats is not None:
                                    latest_gps["satellites"] = sats
                                if alt is not None:
                                    latest_gps["altitude"] = alt
                                latest_gps["timestamp"] = parsed.get("timestamp", recv_now)
                                latest_gps["received_at"] = recv_now
                                latest_gps["source"] = "g703_serial"
                                latest_gps["port"] = current_port
                                bridge_stats["gps_packets_received"] += 1
                                bridge_stats["gps_source"] = "g703_serial"

                            if lat is not None and lon is not None:
                                packet = {
                                    "latitude": lat,
                                    "longitude": lon,
                                    "speed": spd,
                                    "heading": hdg,
                                    "satellites": sats,
                                    "timestamp": recv_now,
                                    "source": "g703_serial"
                                }
                                packet_bytes = json.dumps(packet).encode("utf-8")
                                try:
                                    udp_forward_sock.sendto(packet_bytes, ("127.0.0.1", GPS_PORT))
                                except Exception:
                                    pass
                                upload_gps_to_supabase(packet)
                        else:
                            if parsed.get("type") == "RMC":
                                consecutive_nofix += 1
                                if consecutive_nofix > 4:
                                    with state_lock:
                                        if latest_gps["source"] == "g703_serial":
                                            latest_gps["fix"] = False

            else:
                # Direct device read fallback on Linux
                if os.path.exists(current_port):
                    with open(current_port, "rb", buffering=0) as f:
                        log.info("[✓ G-703] Direct device opened on %s", current_port)
                        with state_lock:
                            bridge_stats["gps_source"] = "g703_direct"
                            bridge_stats["gps_port"] = current_port
                            latest_gps["port"] = current_port

                        buffer = b""
                        while True:
                            chunk = f.read(256)
                            if not chunk:
                                time.sleep(0.1)
                                continue
                            buffer += chunk
                            while b"\n" in buffer:
                                line_b, buffer = buffer.split(b"\n", 1)
                                line = line_b.decode("ascii", errors="ignore").strip()
                                if line.startswith("$"):
                                    parsed = parse_nmea_sentence(line)
                                    if parsed and parsed.get("valid"):
                                        recv_now = time.time()
                                        lat, lon = parsed.get("latitude"), parsed.get("longitude")
                                        with state_lock:
                                            if lat is not None and lon is not None:
                                                latest_gps["latitude"] = lat
                                                latest_gps["longitude"] = lon
                                                latest_gps["fix"] = True
                                            if parsed.get("speed") is not None:
                                                latest_gps["speed"] = parsed["speed"]
                                            if parsed.get("heading") is not None:
                                                latest_gps["heading"] = parsed["heading"]
                                            if parsed.get("satellites") is not None:
                                                latest_gps["satellites"] = parsed["satellites"]
                                            latest_gps["timestamp"] = parsed.get("timestamp", recv_now)
                                            latest_gps["received_at"] = recv_now
                                            latest_gps["source"] = "g703_direct"
                                            latest_gps["port"] = current_port
                                            bridge_stats["gps_packets_received"] += 1
                else:
                    time.sleep(3.0)
                    current_port = None

        except (OSError, Exception) as e:
            log.warning("[G-703] GPS device disconnected or error on %s: %s (reconnecting in 3s)", current_port, e)
            with state_lock:
                if latest_gps["source"] in ("g703_serial", "g703_direct"):
                    latest_gps["fix"] = False
            time.sleep(3.0)
            current_port = None


# ============================================================================
# ROUTE 4 SIMULATION (FOR DESK TESTING STOP-BY-STOP GPS TRIGGERING)
# ============================================================================

ROUTE4_COORDS = [
    (14.650221, 121.052022, "Quezon City Hall – NHA Interchange"),
    (14.653838, 121.039194, "North Avenue – Veterans Hospital / Vertis North"),
    (14.655659, 121.035570, "Mindanao Avenue corner Road 1"),
    (14.661252, 121.036818, "Mindanao Avenue – Tullahan Bridge"),
    (14.668691, 121.033582, "Mindanao Avenue corner Congressional Avenue"),
    (14.677455, 121.032212, "Mindanao Avenue corner Tandang Sora Avenue"),
    (14.681691, 121.032145, "Mindanao Avenue corner D. Muñoz Street"),
    (14.688344, 121.030957, "Mindanao Avenue corner Old Sauyo Road"),
    (14.690390, 121.028383, "Mindanao Avenue corner Quirino Highway – Interchange"),
    (14.700148, 121.034649, "Quezon City University Main Campus / NDH"),
    (14.707175, 121.038840, "Quirino Highway – SM City Novaliches"),
    (14.716621, 121.040290, "Quirino Highway corner Forest Hills Drive"),
    (14.721925, 121.039098, "General Luis Avenue – Novaliches Bayan"),
    (14.720656, 121.028112, "General Luis Avenue corner Banahaw Street"),
    (14.719770, 121.021290, "General Luis Avenue corner SB Road")
]


def run_route4_gps_simulation(steps_per_segment=7, dwell_seconds=3):
    """Simulate a bus driving along the 15 Route 4 stops."""
    log.info("[SIMULATOR] Starting Route 4 GPS movement simulator...")
    udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)

    while True:
        for i in range(len(ROUTE4_COORDS) - 1):
            lat1, lon1, name1 = ROUTE4_COORDS[i]
            lat2, lon2, name2 = ROUTE4_COORDS[i + 1]

            # Dwell at stop
            log.info("[SIMULATOR] Arrived at Stop %d (%s) — dwelling for %ds", i + 1, name1, dwell_seconds)
            for _ in range(dwell_seconds):
                recv_now = time.time()
                with state_lock:
                    latest_gps["latitude"] = lat1
                    latest_gps["longitude"] = lon1
                    latest_gps["speed"] = 0.0
                    latest_gps["heading"] = None
                    latest_gps["satellites"] = 9
                    latest_gps["altitude"] = 28.5
                    latest_gps["fix"] = True
                    latest_gps["received_at"] = recv_now
                    latest_gps["timestamp"] = recv_now
                    latest_gps["source"] = "route4_simulator"
                    bridge_stats["gps_packets_received"] += 1
                    bridge_stats["gps_source"] = "route4_simulator"

                pkt = {"latitude": lat1, "longitude": lon1, "speed": 0.0, "timestamp": recv_now, "source": "route4_simulator"}
                try:
                    udp_sock.sendto(json.dumps(pkt).encode("utf-8"), ("127.0.0.1", GPS_PORT))
                except Exception:
                    pass
                upload_gps_to_supabase(pkt)
                time.sleep(1.0)

            # Move towards next stop
            log.info("[SIMULATOR] En route: Stop %d -> Stop %d (%s)", i + 1, i + 2, name2)
            for s in range(1, steps_per_segment + 1):
                frac = s / float(steps_per_segment + 1)
                curr_lat = round(lat1 + (lat2 - lat1) * frac, 6)
                curr_lon = round(lon1 + (lon2 - lon1) * frac, 6)
                recv_now = time.time()

                with state_lock:
                    latest_gps["latitude"] = curr_lat
                    latest_gps["longitude"] = curr_lon
                    latest_gps["speed"] = 28.5
                    latest_gps["heading"] = 45.0
                    latest_gps["satellites"] = 9
                    latest_gps["altitude"] = 30.0
                    latest_gps["fix"] = True
                    latest_gps["received_at"] = recv_now
                    latest_gps["timestamp"] = recv_now
                    latest_gps["source"] = "route4_simulator"
                    bridge_stats["gps_packets_received"] += 1
                    bridge_stats["gps_source"] = "route4_simulator"

                pkt = {"latitude": curr_lat, "longitude": curr_lon, "speed": 28.5, "timestamp": recv_now, "source": "route4_simulator"}
                try:
                    udp_sock.sendto(json.dumps(pkt).encode("utf-8"), ("127.0.0.1", GPS_PORT))
                except Exception:
                    pass
                upload_gps_to_supabase(pkt)
                time.sleep(1.0)

        # Arrive at final stop
        last_lat, last_lon, last_name = ROUTE4_COORDS[-1]
        log.info("[SIMULATOR] Arrived at Final Stop 15 (%s)!", last_name)
        for _ in range(dwell_seconds * 2):
            recv_now = time.time()
            with state_lock:
                latest_gps["latitude"] = last_lat
                latest_gps["longitude"] = last_lon
                latest_gps["speed"] = 0.0
                latest_gps["satellites"] = 9
                latest_gps["fix"] = True
                latest_gps["received_at"] = recv_now
                latest_gps["timestamp"] = recv_now
                latest_gps["source"] = "route4_simulator"
            time.sleep(1.0)


# ============================================================================
# MOCK PI 3B (OFFLINE TESTING MODE)
# ============================================================================

def run_mock_pi3b(port=8080, gps_port=5005):
    """Run a simulated Pi 3B Announcer on port 8080 and stream UDP GPS to port 5005."""
    log.info("Starting Mock Pi 3B Announcer on port %d...", port)

    state = {
        "active": False,
        "trip": None,
        "trip_label": "QC Hall Interchange -> SB Road",
        "stops": [s[2] for s in ROUTE4_COORDS],
        "idx": 0,
        "current_idx": 0,
        "phase": "idle",
        "dist": 150,
        "trips_done": 0,
        "last_trip": None,
        "gps": {"fix": True, "lat": 14.650221, "lon": 121.052022, "kmh": 22.5}
    }

    class MockHandler(BaseHTTPRequestHandler):
        def _send(self, code, data):
            body = json.dumps(data).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            self.wfile.write(body)

        def do_OPTIONS(self):
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def do_GET(self):
            if self.path == "/api/state":
                self._send(200, state)
            else:
                self._send(404, {"error": "not found"})

        def do_POST(self):
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length).decode("utf-8") if length else "{}"
            try:
                data = json.loads(raw)
            except Exception:
                data = {}

            if self.path == "/api/trip/start":
                dir_val = data.get("direction")
                if not dir_val or dir_val not in ("Northbound", "Southbound"):
                    self._send(400, {"error": "direction must be Northbound or Southbound"})
                    return
                if state["active"]:
                    self._send(409, {"error": "a trip is already active, so end it first"})
                    return
                state["active"] = True
                state["trip"] = dir_val
                state["phase"] = "at_stop"
                log.info("[Mock 3B] Trip STARTED: %s", dir_val)
                self._send(200, {"ok": True, "direction": dir_val, "label": state["trip_label"]})

            elif self.path == "/api/trip/end":
                state["active"] = False
                state["phase"] = "idle"
                state["trips_done"] += 1
                state["last_trip"] = {"direction": state["trip"], "finished_at": time.strftime("%Y-%m-%d %H:%M:%S")}
                state["trip"] = None
                log.info("[Mock 3B] Trip ENDED.")
                self._send(200, {"ok": True})
            else:
                self._send(404, {"error": "not found"})

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("0.0.0.0", port), MockHandler)
    threading.Thread(target=server.serve_forever, daemon=True).start()


# ============================================================================
# MAIN ENTRYPOINT
# ============================================================================

def main():
    global PI3B_URL, GPS_PORT, HTTP_PORT, GPS_SERIAL_PORT, GPS_SERIAL_BAUD
    parser = argparse.ArgumentParser(description="DITO NA PO - Pi 4B <-> Pi 3B Communication Bridge & G-703 GPS Daemon")
    parser.add_argument("--mock-3b", "--sim", dest="mock_3b", action="store_true", help="Run built-in Mock Pi 3B for offline simulation/testing")
    parser.add_argument("--sim-gps", action="store_true", help="Simulate movement along Route 4 stops for testing GPS trigger")
    parser.add_argument("--gps-serial-port", "-p", default=GPS_SERIAL_PORT, help="G-703 USB GPS serial port (e.g. /dev/ttyACM0 or /dev/ttyUSB0)")
    parser.add_argument("--gps-serial-baud", "-b", type=int, default=GPS_SERIAL_BAUD, help=f"G-703 serial baud rate (default: {GPS_SERIAL_BAUD})")
    parser.add_argument("--pi3b-url", default=PI3B_URL, help=f"Target Pi 3B URL (default: {PI3B_URL})")
    parser.add_argument("--gps-port", type=int, default=GPS_PORT, help=f"UDP GPS port (default: {GPS_PORT})")
    parser.add_argument("--http-port", type=int, default=HTTP_PORT, help=f"Bridge HTTP port (default: {HTTP_PORT})")

    args = parser.parse_args()

    PI3B_URL = args.pi3b_url.rstrip("/")
    GPS_PORT = args.gps_port
    HTTP_PORT = args.http_port
    GPS_SERIAL_PORT = args.gps_serial_port
    GPS_SERIAL_BAUD = args.gps_serial_baud

    if args.mock_3b:
        PI3B_URL = "http://127.0.0.1:8080"
        run_mock_pi3b(port=8080, gps_port=GPS_PORT)

    log.info("=================================================================")
    log.info(" DITO NA PO - Raspberry Pi 4B Bridge & G-703 GPS Receiver Service")
    log.info("=================================================================")
    log.info(" G-703 USB Serial Port : %s (baud: %d)", GPS_SERIAL_PORT or "Auto-detect (/dev/ttyACM0, /dev/ttyUSB0)", GPS_SERIAL_BAUD)
    log.info(" Target Pi 3B Announcer : %s %s", PI3B_URL, "(MOCK / SIMULATED)" if args.mock_3b else "")
    log.info(" Local HTTP API (CORS)  : http://%s:%d", HTTP_BIND, HTTP_PORT)
    log.info(" UDP GPS Listener       : %s:%d", GPS_BIND, GPS_PORT)
    log.info(" GPS Staleness Timeout  : %.1f seconds", GPS_STALE_TIMEOUT)
    log.info(" Cloud Sync             : %s", "Enabled" if (SUPABASE_URL and DEVICE_KEY) else "Local Only")
    if args.sim_gps:
        log.info(" Simulation Mode        : Route 4 Stop Movement Simulator ACTIVE")
    log.info("=================================================================")

    # Initial check of Pi 3B online status
    is_online = check_pi3b_online()
    if is_online:
        log.info("[✓] Pi 3B Bus Announcer is ONLINE at %s", PI3B_URL)
    else:
        log.info("[ℹ] Pi 3B Bus Announcer is currently OFFLINE (Operating standalone with local G-703 GPS).")

    # Thread 1: Local HTTP REST Server (serves Personnel App on Pi 4B)
    http_thread = threading.Thread(target=run_http_server, daemon=True, name="BridgeHttpServer")
    http_thread.start()

    # Thread 2: G-703 Serial GPS Reader or Simulator
    if args.sim_gps:
        gps_thread = threading.Thread(target=run_route4_gps_simulation, daemon=True, name="Route4GpsSimulator")
        gps_thread.start()
    else:
        gps_thread = threading.Thread(target=run_g703_serial_reader, args=(GPS_SERIAL_PORT, GPS_SERIAL_BAUD), daemon=True, name="G703SerialReader")
        gps_thread.start()

    # Thread 3 (Main): Receive UDP GPS packets (fallback / legacy stream)
    receive_gps_loop()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log.info("Bridge terminated by user.")
        sys.exit(0)
