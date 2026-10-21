"""Shared state read by the monitor screen and by GET /api/state (the 4B).
Audio manager sets the banner in sync with speech.
trips_done / last_trip tell the 4B that a trip finished (one completed direction = 1 trip)."""
import copy
import threading


class DisplayState:
    def __init__(self):
        self.lock = threading.Lock()
        self.d = {"active": False, "trip": None, "trip_label": "", "stops": [], "idx": 0,
                  "current_idx": None,
                  "phase": "idle", "dist": None, "banner": None,
                  "trips_done": 0, "last_trip": None,
                  "gps": {"fix": False, "lat": None, "lon": None, "kmh": 0}}

    def update(self, **kw):
        with self.lock:
            self.d.update(kw)

    def set_banner(self, kind, tl, en, stop=None):
        with self.lock:
            self.d["banner"] = {"kind": kind, "tl": tl, "en": en, "stop": stop, "speaking": None}

    def set_speaking(self, lang):
        with self.lock:
            if self.d["banner"]:
                self.d["banner"]["speaking"] = lang

    def clear_banner(self):
        with self.lock:
            self.d["banner"] = None

    def snapshot(self):
        with self.lock:
            return copy.deepcopy(self.d)
