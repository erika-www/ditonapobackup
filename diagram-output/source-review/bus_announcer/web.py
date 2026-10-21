"""Small Pi 3B API for state and route commands from the Pi 4B (stdlib only)."""
import ipaddress
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

def create_server(host, port, display, tracker, routes, allow_from):
    nets = [ipaddress.ip_network(n) for n in allow_from]

    class Handler(BaseHTTPRequestHandler):
        def _send(self, code, obj):
            body = json.dumps(obj).encode()
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

        def _allowed(self):
            try:
                ip = ipaddress.ip_address(self.client_address[0])
            except ValueError:
                return False
            if any(ip in n for n in nets):
                return True
            self._send(403, {"error": "forbidden"})
            return False

        def do_GET(self):
            if not self._allowed():
                return
            if self.path == "/api/state":
                self._send(200, display.snapshot())
            else:
                self._send(404, {"error": "not found"})

        def do_POST(self):
            if not self._allowed():
                return
            n = int(self.headers.get("Content-Length") or 0)
            try:
                data = json.loads(self.rfile.read(n) or b"{}")
            except ValueError:
                data = {}
            if self.path == "/api/trip/start":
                if not isinstance(data, dict):
                    self._send(400, {"error": "JSON body must be an object"})
                    return
                selected = data.get("direction", data.get("tripDirection", data.get("route")))
                if not isinstance(selected, str):
                    self._send(400, {"error": "direction must be Northbound or Southbound"})
                    return
                direction = selected.strip().lower()
                route_id = {
                    "northbound": "Northbound",
                    "southbound": "Southbound",
                }.get(direction)
                if route_id not in routes:
                    self._send(400, {"error": "direction must be Northbound or Southbound"})
                    return
                try:
                    tracker.start_trip(route_id)
                except ValueError as e:
                    self._send(409, {"error": str(e)})
                    return
                self._send(200, {"ok": True, "direction": route_id,
                                 "label": routes[route_id]["label"]})
            elif self.path == "/api/trip/end":
                tracker.end_trip()
                display.update(active=False, phase="idle")
                self._send(200, {"ok": True})
            else:
                self._send(404, {"error": "not found"})

        def log_message(self, *args):
            pass

    return ThreadingHTTPServer((host, port), Handler)
