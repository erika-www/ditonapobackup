"""Sends latitude/longitude to configured receivers over UDP."""
import json
import socket
import time


class Pi4Sender:
    def __init__(self, cfg):
        self.addrs = [(cfg["host"], cfg["port"])]
        laptop = cfg.get("laptop")
        if laptop and laptop.get("enabled", True) and laptop.get("host"):
            self.addrs.append((laptop["host"], laptop.get("port", cfg["port"])))
        self.fmt = cfg.get("format", "json")
        self.min_interval = 1.0 / cfg.get("send_hz", 1)
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.last = 0.0

    def send(self, lat, lon):
        now = time.time()
        if now - self.last < self.min_interval:
            return
        self.last = now
        if self.fmt == "csv":
            payload = f"{lat:.6f},{lon:.6f}"
        else:
            payload = json.dumps({"latitude": round(lat, 6), "longitude": round(lon, 6),
                                  "timestamp": round(now, 2)})
        try:
            for addr in self.addrs:
                try:
                    self.sock.sendto(payload.encode(), addr)
                except OSError:
                    pass  # one unreachable receiver must not block the others
        except OSError:
            pass  # never let a network error crash the announcer
