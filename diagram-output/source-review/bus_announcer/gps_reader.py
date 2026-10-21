"""Reads real NMEA GPS fixes from the VK-162 USB receiver."""
import threading
import time
import logging
import serial
import pynmea2

log = logging.getLogger("gps")


class GPSReader(threading.Thread):
    def __init__(self, port, baud, on_fix, on_nofix):
        super().__init__(daemon=True)
        self.port, self.baud = port, baud
        self.on_fix, self.on_nofix = on_fix, on_nofix

    def run(self):
        while True:
            try:
                with serial.Serial(self.port, self.baud, timeout=2) as ser:
                    log.info("GPS opened %s", self.port)
                    while True:
                        line = ser.readline().decode("ascii", errors="ignore").strip()
                        if not line:
                            self.on_nofix()          # timeout, no data
                            continue
                        if not line.startswith("$"):
                            continue
                        try:
                            msg = pynmea2.parse(line)
                        except pynmea2.ParseError:
                            continue
                        if msg.sentence_type != "RMC":
                            continue
                        try:
                            valid = msg.status == "A" and msg.latitude and msg.longitude
                            kmh = float(msg.spd_over_grnd or 0.0) * 1.852
                            lat, lon = msg.latitude, msg.longitude
                        except (AttributeError, TypeError, ValueError):
                            continue                 # malformed sentence: ignore it
                        if valid:
                            self.on_fix(lat, lon, kmh)
                        else:
                            self.on_nofix()
            except (serial.SerialException, OSError) as e:
                log.warning("GPS error: %s (retrying in 3s)", e)
                self.on_nofix()
                time.sleep(3)

