"""Pi 4B ↔ Pi 3B Communication Bridge (Revised).

Features:
1. UDP GPS Receiver: Receives live GPS from Pi 3B (default port 5005).
2. Rate-Limited Cloud Ingest: Safely uploads GPS to Supabase ingest-gps (respects 1.5s rate limit).
3. Local HTTP API with CORS (Port 5007):
   - Allows the Personnel App (browser) on Pi 4B to dispatch Northbound/Southbound commands to Pi 3B.
   - Allows Personnel App to read latest GPS coordinates and Pi 3B announcer status.
4. Cloud Direction Relay: Polls Supabase bus-direction (if configured) with graceful 404 fallback.
"""

import json
import logging
import os
import socket
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

import requests

# Optional: load .env file if available
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

# Configuration via environment variables with safe defaults
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
DEVICE_KEY = os.getenv("DEVICE_KEY", "")

# Networking Configuration
GPS_BIND = os.getenv("GPS_BIND", "0.0.0.0")
GPS_PORT = int(os.getenv("GPS_PORT", "5005"))

# Local HTTP Bridge API (for Personnel App on Pi 4B)
HTTP_BIND = os.getenv("HTTP_BIND", "0.0.0.0")
HTTP_PORT = int(os.getenv("HTTP_PORT", "5007"))

# Pi 3B Announcer Endpoint
# Per specification: Pi 3B runs on 127.0.0.1:5000 over local Ethernet
PI3B_URL = os.getenv("PI3B_URL", "http://127.0.0.1:5000").rstrip("/")

# Rate limits & intervals
GPS_UPLOAD_INTERVAL = float(os.getenv("GPS_UPLOAD_INTERVAL", "2.0"))  # >=1.5s for ingest-gps
DIRECTION_POLL_SECONDS = float(os.getenv("DIRECTION_POLL_SECONDS", "3.0"))

# Shared in-memory state
state_lock = threading.Lock()
latest_gps = {
    "latitude": None,
    "longitude": None,
    "timestamp": None,
    "received_at": None,
    "fix": False
}
bridge_stats = {
    "gps_packets_received": 0,
    "gps_uploads_success": 0,
    "gps_uploads_failed": 0,
    "directions_relayed": 0,
    "last_direction": None,
    "pi3b_online": False,
    "pi3b_last_check": None
}
last_upload_time = 0.0


# ============================================================================
# 1. PI 3B RELAY CLIENT
# ============================================================================

def send_direction_to_pi3b(direction: str, force: bool = False) -> tuple:
    """Send Northbound or Southbound trip start command directly to Pi 3B.
    
    Returns (status_code, response_dict).
    Handles 409 Conflict (trip already active) by optionally ending previous trip if force=True.
    """
    norm_dir = direction.strip().title()
    if norm_dir not in ("Northbound", "Southbound"):
        raise ValueError(f"Unsupported direction: '{direction}'. Must be Northbound or Southbound.")

    url = f"{PI3B_URL}/api/trip/start"
    log.info("Relaying direction '%s' to Pi 3B at %s (force=%s)", norm_dir, url, force)
    
    try:
        res = requests.post(url, json={"direction": norm_dir}, timeout=6.0)
    except requests.RequestException as e:
        with state_lock:
            bridge_stats["pi3b_online"] = False
            bridge_stats["pi3b_last_check"] = time.time()
        raise ConnectionError(f"Cannot connect to Pi 3B at {PI3B_URL}: {e}")

    # Handle 409 Conflict: trip already active
    if res.status_code == 409 and force:
        log.warning("Trip already active on Pi 3B (409). Force enabled: ending active trip first...")
        try:
            send_end_trip_to_pi3b()
            time.sleep(0.3)
            res = requests.post(url, json={"direction": norm_dir}, timeout=6.0)
        except Exception as retry_err:
            log.error("Failed to force-restart trip on Pi 3B: %s", retry_err)

    try:
        payload = res.json()
    except Exception:
        payload = {"raw": res.text, "status_code": res.status_code}

    with state_lock:
        bridge_stats["pi3b_online"] = (res.status_code < 500)
        bridge_stats["pi3b_last_check"] = time.time()
        if res.status_code == 200:
            bridge_stats["directions_relayed"] += 1
            bridge_stats["last_direction"] = norm_dir

    return res.status_code, payload


def send_end_trip_to_pi3b() -> tuple:
    """Send end/pause trip command directly to Pi 3B.
    
    Returns (status_code, response_dict).
    """
    url = f"{PI3B_URL}/api/trip/end"
    log.info("Sending end/pause trip to Pi 3B at %s", url)
    try:
        res = requests.post(url, json={}, timeout=6.0)
    except requests.RequestException as e:
        with state_lock:
            bridge_stats["pi3b_online"] = False
            bridge_stats["pi3b_last_check"] = time.time()
        raise ConnectionError(f"Cannot connect to Pi 3B at {PI3B_URL}: {e}")

    try:
        payload = res.json()
    except Exception:
        payload = {"raw": res.text, "status_code": res.status_code}

    with state_lock:
        bridge_stats["pi3b_online"] = (res.status_code < 500)
        bridge_stats["pi3b_last_check"] = time.time()

    return res.status_code, payload


def query_pi3b_state() -> dict:
    """Fetch current display/tracker state from Pi 3B (GET /api/state)."""
    url = f"{PI3B_URL}/api/state"
    try:
        res = requests.get(url, timeout=3.0)
        res.raise_for_status()
        with state_lock:
            bridge_stats["pi3b_online"] = True
            bridge_stats["pi3b_last_check"] = time.time()
        return res.json()
    except Exception as e:
        with state_lock:
            bridge_stats["pi3b_online"] = False
            bridge_stats["pi3b_last_check"] = time.time()
        return {"error": str(e), "online": False}


# ============================================================================
# 2. LOCAL HTTP SERVER (PORT 5007) - INTERFACES WITH PERSONNEL APP
# ============================================================================

class LocalBridgeHandler(BaseHTTPRequestHandler):
    """Provides local REST API with full CORS for Pi 4B Personnel Web App."""

    def _send_json(self, code: int, data: dict):
        body = json.dumps(data).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-device-key")
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
            self._send_json(200, {
                "status": "online",
                "service": "dito-na-po-pi4b-bridge",
                "pi3b_url": PI3B_URL,
                "gps_port": GPS_PORT
            })

        elif path == "/api/status":
            pi3b_state = query_pi3b_state()
            with state_lock:
                gps_copy = dict(latest_gps)
                stats_copy = dict(bridge_stats)
            self._send_json(200, {
                "success": True,
                "bridge": stats_copy,
                "latest_gps": gps_copy,
                "pi3b": pi3b_state
            })

        elif path == "/api/gps":
            with state_lock:
                gps_copy = dict(latest_gps)
            age = (time.time() - gps_copy["received_at"]) if gps_copy["received_at"] else None
            self._send_json(200, {
                "success": True,
                **gps_copy,
                "age_seconds": round(age, 2) if age is not None else None
            })

        elif path in ("/api/state", "/api/pi3b/state"):
            pi3b_state = query_pi3b_state()
            self._send_json(200, pi3b_state)

        else:
            self._send_json(404, {"error": "Endpoint not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        # Read JSON body
        content_len = int(self.headers.get("Content-Length") or 0)
        try:
            raw_body = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"
            body = json.loads(raw_body or "{}")
        except Exception:
            body = {}

        if path in ("/api/trip/start", "/api/direction"):
            direction = body.get("direction") or body.get("tripDirection") or body.get("route")
            force = bool(body.get("force", False))
            if not direction:
                self._send_json(400, {"error": "Missing 'direction' (Northbound or Southbound)"})
                return

            try:
                code, pi3b_res = send_direction_to_pi3b(str(direction), force=force)
                if code == 200:
                    self._send_json(200, {
                        "success": True,
                        "direction": str(direction).strip().title(),
                        "pi3b_response": pi3b_res
                    })
                elif code == 409:
                    self._send_json(409, {
                        "success": False,
                        "conflict": True,
                        "error": pi3b_res.get("error", "A trip is already active on the Pi 3B announcer. End it first or pass force: true."),
                        "pi3b_response": pi3b_res
                    })
                else:
                    self._send_json(code, {
                        "success": False,
                        "error": pi3b_res.get("error", f"Pi 3B returned HTTP {code}"),
                        "pi3b_response": pi3b_res
                    })
            except ValueError as e:
                self._send_json(400, {"error": str(e)})
            except ConnectionError as e:
                log.error("Failed to connect to Pi 3B at %s: %s", PI3B_URL, e)
                self._send_json(502, {
                    "error": f"Pi 3B announcer unreachable at {PI3B_URL}: {e}"
                })

        elif path == "/api/trip/end":
            try:
                code, pi3b_res = send_end_trip_to_pi3b()
                self._send_json(code, {
                    "success": (code == 200),
                    "pi3b_response": pi3b_res
                })
            except ConnectionError as e:
                log.error("Failed to connect to Pi 3B at %s: %s", PI3B_URL, e)
                self._send_json(502, {
                    "error": f"Pi 3B announcer unreachable at {PI3B_URL}: {e}"
                })

        else:
            self._send_json(404, {"error": "Endpoint not found"})

    def log_message(self, fmt, *args):
        # Silence routine access logs
        pass


def run_http_server():
    server = ThreadingHTTPServer((HTTP_BIND, HTTP_PORT), LocalBridgeHandler)
    log.info("Local HTTP Bridge API listening on http://%s:%d", HTTP_BIND, HTTP_PORT)
    server.serve_forever()


# ============================================================================
# 3. UDP GPS RECEIVER & CLOUD INGESTION
# ============================================================================

def upload_gps_to_supabase(packet: dict):
    """Upload GPS packet to Supabase ingest-gps Edge Function with rate limiting."""
    global last_upload_time

    if not SUPABASE_URL or not SUPABASE_ANON_KEY or not DEVICE_KEY:
        return  # Supabase cloud not configured; local bridge operates standalone

    now = time.time()
    if now - last_upload_time < GPS_UPLOAD_INTERVAL:
        return  # Throttled to comply with ingest-gps 1.5s rate limit

    lat, lon = packet.get("latitude"), packet.get("longitude")
    if not isinstance(lat, (int, float)) or not -90 <= lat <= 90:
        return
    if not isinstance(lon, (int, float)) or not -180 <= lon <= 180:
        return

    timestamp = packet.get("timestamp")
    payload = {"latitude": lat, "longitude": lon}
    if timestamp is not None:
        try:
            payload["recorded_at"] = datetime.fromtimestamp(float(timestamp), timezone.utc).isoformat()
        except (ValueError, OSError):
            payload["recorded_at"] = datetime.now(timezone.utc).isoformat()
    else:
        payload["recorded_at"] = datetime.now(timezone.utc).isoformat()

    try:
        response = requests.post(
            f"{SUPABASE_URL}/functions/v1/ingest-gps",
            json=payload,
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "x-device-key": DEVICE_KEY,
                "Content-Type": "application/json"
            },
            timeout=8.0,
        )
        if response.status_code == 429:
            log.warning("Supabase ingest-gps rate limit exceeded (HTTP 429). Will back off.")
            last_upload_time = now + 1.0  # Extra backoff
            return

        response.raise_for_status()
        last_upload_time = now
        with state_lock:
            bridge_stats["gps_uploads_success"] += 1
    except requests.RequestException as e:
        with state_lock:
            bridge_stats["gps_uploads_failed"] += 1
        log.warning("GPS cloud upload notice: %s", e)


def receive_gps_loop():
    """Receive UDP GPS packets from Pi 3B.
    
    Supports:
    - JSON format (per specification): {"latitude": 14.650221, "longitude": 121.052022, "timestamp": 1760770000.12}
    - CSV format (fallback): "14.650221,121.052022"
    """
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind((GPS_BIND, GPS_PORT))
    log.info("Listening for Pi 3B UDP GPS packets on %s:%d", GPS_BIND, GPS_PORT)

    while True:
        try:
            data, address = sock.recvfrom(4096)
            text = data.decode("utf-8").strip()
            lat, lon, ts = None, None, time.time()
            packet = {}

            if text.startswith("{"):
                packet = json.loads(text)
                lat = packet.get("latitude")
                lon = packet.get("longitude")
                ts = packet.get("timestamp", time.time())
            elif "," in text:
                parts = [p.strip() for p in text.split(",")]
                if len(parts) >= 2:
                    lat = float(parts[0])
                    lon = float(parts[1])
                    ts = float(parts[2]) if len(parts) >= 3 else time.time()
                    packet = {"latitude": lat, "longitude": lon, "timestamp": ts}

            if isinstance(lat, (int, float)) and isinstance(lon, (int, float)) and -90 <= lat <= 90 and -180 <= lon <= 180:
                with state_lock:
                    latest_gps["latitude"] = round(float(lat), 6)
                    latest_gps["longitude"] = round(float(lon), 6)
                    latest_gps["timestamp"] = ts
                    latest_gps["received_at"] = time.time()
                    latest_gps["fix"] = True
                    bridge_stats["gps_packets_received"] += 1

                # Attempt rate-limited upload to Supabase cloud
                upload_gps_to_supabase(packet)

        except (ValueError, UnicodeDecodeError) as e:
            log.warning("Malformed UDP packet: %s", e)
        except Exception as e:
            log.error("Error in GPS receiver loop: %s", e)


# ============================================================================
# 4. CLOUD DIRECTION POLLER (SUPABASE BUS-DIRECTION FALLBACK)
# ============================================================================

def cloud_direction_poll_loop():
    """Polls Supabase bus-direction if configured; handles missing function gracefully."""
    if not SUPABASE_URL or not SUPABASE_ANON_KEY or not DEVICE_KEY:
        log.info("Supabase credentials not fully set; operating in local-only relay mode.")
        return

    cursor = None
    headers = {"apikey": SUPABASE_ANON_KEY, "x-device-key": DEVICE_KEY}
    logged_404 = False

    log.info("Starting cloud direction polling from %s/functions/v1/bus-direction", SUPABASE_URL)

    while True:
        try:
            params = {} if cursor is None else {"after_id": cursor}
            response = requests.get(
                f"{SUPABASE_URL}/functions/v1/bus-direction",
                params=params,
                headers=headers,
                timeout=10.0
            )

            if response.status_code == 404:
                if not logged_404:
                    log.info("Supabase edge function 'bus-direction' not found (HTTP 404). Local bridge handles directions.")
                    logged_404 = True
                time.sleep(30.0)  # Long backoff when edge function is not deployed
                continue

            logged_404 = False
            response.raise_for_status()

            commands = response.json().get("commands", [])
            for command in commands:
                direction = command.get("direction")
                if direction in ("Northbound", "Southbound"):
                    send_direction_to_pi3b(direction)
                    cursor = int(command["id"])
                    log.info("Relayed cloud command %d (%s) to Pi 3B", cursor, direction)

        except requests.RequestException as e:
            # Avoid flooding logs on temporary network disconnects
            time.sleep(10.0)
        except Exception as e:
            log.warning("Direction poller notice: %s", e)

        time.sleep(DIRECTION_POLL_SECONDS)


# ============================================================================
# MAIN ENTRYPOINT
# ============================================================================

def main():
    log.info("=== Starting DITO NA PO Pi 4B ↔ Pi 3B Bridge ===")
    log.info("Target Pi 3B URL : %s", PI3B_URL)
    log.info("Local HTTP API   : http://%s:%d", HTTP_BIND, HTTP_PORT)
    log.info("UDP GPS Ingest   : %s:%d", GPS_BIND, GPS_PORT)
    log.info("Cloud Sync       : %s", "Enabled" if (SUPABASE_URL and DEVICE_KEY) else "Local Only")

    # Thread 1: Local HTTP Server (for Personnel App on Pi 4B)
    threading.Thread(target=run_http_server, daemon=True, name="BridgeHttpServer").start()

    # Thread 2: Cloud Direction Polling (optional background sync)
    threading.Thread(target=cloud_direction_poll_loop, daemon=True, name="CloudPoller").start()

    # Thread 3 (Main): Receive UDP GPS
    receive_gps_loop()


if __name__ == "__main__":
    main()
