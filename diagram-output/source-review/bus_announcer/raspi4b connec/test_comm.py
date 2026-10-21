#!/usr/bin/env python3
"""DITO NA PO - Communication Diagnostic & Testing Tool.

Usage:
  1. Test Local Bridge (Pi 4B side):
     python test_comm.py --test-bridge

  2. Send Simulated GPS packets (simulate Pi 3B GPS UDP sender):
     python test_comm.py --send-gps

  3. Run Complete Mock Pi 3B (simulates Pi 3B HTTP API :8080 & UDP GPS :5005):
     python test_comm.py --mock-3b

  4. Test Real Pi 3B directly:
     python test_comm.py --test-3b --ip 127.0.0.1
"""

import argparse
import json
import socket
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import requests


def test_local_bridge(port=5007):
    """Test the local bridge HTTP API on Pi 4B."""
    base_url = f"http://127.0.0.1:{port}"
    print(f"\n[*] Testing Local Bridge API on {base_url}...")

    # 1. /health
    try:
        r = requests.get(f"{base_url}/health", timeout=2)
        print(f" [✓] GET /health -> HTTP {r.status_code}: {r.json()}")
    except Exception as e:
        print(f" [✗] GET /health FAILED: {e}")
        return False

    # 2. /api/status
    try:
        r = requests.get(f"{base_url}/api/status", timeout=3)
        print(f" [✓] GET /api/status -> HTTP {r.status_code}")
        data = r.json()
        print(f"     - Pi 3B Online: {data.get('pi3b', {}).get('online', False)}")
        print(f"     - Latest GPS Fix: {data.get('latest_gps', {}).get('fix', False)}")
        print(f"     - GPS Packets Received: {data.get('bridge', {}).get('gps_packets_received', 0)}")
    except Exception as e:
        print(f" [✗] GET /api/status FAILED: {e}")

    # 3. /api/gps
    try:
        r = requests.get(f"{base_url}/api/gps", timeout=2)
        print(f" [✓] GET /api/gps -> HTTP {r.status_code}: {r.json()}")
    except Exception as e:
        print(f" [✗] GET /api/gps FAILED: {e}")

    return True


def send_simulated_gps(host="127.0.0.1", port=5005, count=10, interval=1.0):
    """Simulate Pi 3B sending UDP GPS packets to Pi 4B."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    print(f"\n[*] Sending {count} simulated GPS packets to {host}:{port} via UDP...")

    base_lat = 14.650221
    base_lon = 121.052022

    for i in range(count):
        payload = {
            "latitude": round(base_lat + (i * 0.0001), 6),
            "longitude": round(base_lon + (i * 0.0001), 6),
            "timestamp": round(time.time(), 2)
        }
        raw = json.dumps(payload).encode("utf-8")
        sock.sendto(raw, (host, port))
        print(f" [→] Sent UDP packet #{i+1}: {payload}")
        time.sleep(interval)

    print("[✓] Finished sending simulated GPS packets.")


def test_pi3b_direct(ip="127.0.0.1", port=8080):
    """Test communicating directly with Pi 3B HTTP API."""
    url = f"http://ip:{port}" if ":" in ip else f"http://{ip}:{port}"
    print(f"\n[*] Testing Pi 3B directly at {url}...")

    # 1. GET /api/state
    try:
        r = requests.get(f"{url}/api/state", timeout=3)
        print(f" [✓] GET /api/state -> HTTP {r.status_code}: {r.json()}")
    except Exception as e:
        print(f" [✗] GET /api/state FAILED: {e}")

    # 2. POST /api/trip/start (Northbound)
    try:
        r = requests.post(f"{url}/api/trip/start", json={"direction": "Northbound"}, timeout=4)
        print(f" [✓] POST /api/trip/start -> HTTP {r.status_code}: {r.text}")
    except Exception as e:
        print(f" [✗] POST /api/trip/start FAILED: {e}")

    # 3. POST /api/trip/end
    try:
        r = requests.post(f"{url}/api/trip/end", json={}, timeout=4)
        print(f" [✓] POST /api/trip/end -> HTTP {r.status_code}: {r.text}")
    except Exception as e:
        print(f" [✗] POST /api/trip/end FAILED: {e}")


def run_mock_pi3b(http_port=8080, gps_target_host="127.0.0.1", gps_target_port=5005):
    """Run a mock Pi 3B server for end-to-end local testing on a PC/laptop."""
    print(f"\n========================================================")
    print(f" Running Mock Pi 3B Bus Announcer")
    print(f" HTTP API  : http://0.0.0.0:{http_port}")
    print(f" UDP GPS   : sending to {gps_target_host}:{gps_target_port}")
    print(f"========================================================")

    state = {
        "active": False,
        "trip": None,
        "trip_label": "",
        "stops": ["QC Hall Interchange", "Elliptical Road", "SB Road"],
        "idx": 0,
        "current_idx": 0,
        "phase": "idle",
        "dist": 150,
        "banner": None,
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
                dir_val = data.get("direction") or data.get("tripDirection") or data.get("route")
                if not dir_val or dir_val.strip().title() not in ("Northbound", "Southbound"):
                    self._send(400, {"error": "direction must be Northbound or Southbound"})
                    return

                if state["active"]:
                    self._send(409, {"error": "a trip is already active, so end it first"})
                    return

                norm = dir_val.strip().title()
                state["active"] = True
                state["trip"] = norm
                state["trip_label"] = f"QC Hall Interchange -> {norm} Terminal"
                state["phase"] = "en_route"
                print(f" [Mock 3B] Trip STARTED: {norm}")
                self._send(200, {"ok": True, "direction": norm, "label": state["trip_label"]})

            elif self.path == "/api/trip/end":
                state["active"] = False
                state["phase"] = "idle"
                state["trips_done"] += 1
                state["last_trip"] = {"direction": state["trip"], "finished_at": time.strftime("%Y-%m-%d %H:%M:%S")}
                state["trip"] = None
                print(f" [Mock 3B] Trip ENDED.")
                self._send(200, {"ok": True})
            else:
                self._send(404, {"error": "not found"})

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("0.0.0.0", http_port), MockHandler)

    # Background thread sending UDP GPS packets
    import threading
    def gps_sender():
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        while True:
            payload = {
                "latitude": 14.650221,
                "longitude": 121.052022,
                "timestamp": round(time.time(), 2)
            }
            try:
                sock.sendto(json.dumps(payload).encode("utf-8"), (gps_target_host, gps_target_port))
            except Exception:
                pass
            time.sleep(1.0)

    threading.Thread(target=gps_sender, daemon=True).start()
    print("[*] Server running. Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Stopping Mock Pi 3B.")


def main():
    parser = argparse.ArgumentParser(description="DITO NA PO Pi 4B <-> Pi 3B Communication Diagnostic Tool")
    parser.add_argument("--test-bridge", action="store_true", help="Test local bridge API (port 5007)")
    parser.add_argument("--send-gps", action="store_true", help="Send simulated UDP GPS packets (port 5005)")
    parser.add_argument("--test-3b", action="store_true", help="Test Pi 3B HTTP API directly")
    parser.add_argument("--mock-3b", action="store_true", help="Run a mock Pi 3B server for testing without hardware")
    parser.add_argument("--ip", default="127.0.0.1", help="Pi 3B IP address (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8080, help="Pi 3B HTTP port (default: 8080)")

    args = parser.parse_args()

    if args.test_bridge:
        test_local_bridge()
    elif args.send_gps:
        send_simulated_gps()
    elif args.test_3b:
        test_pi3b_direct(ip=args.ip, port=args.port)
    elif args.mock_3b:
        run_mock_pi3b(http_port=args.port)
    else:
        # Default: run local bridge test
        test_local_bridge()


if __name__ == "__main__":
    main()
