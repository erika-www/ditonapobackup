"""Trip state machine: decides WHEN to announce, based on GPS distance to the next stop.

Per stop, in order:   waiting -> approaching -> at_stop -> (departed) -> next stop
Events emitted:       trip_start, approaching, here, next, trip_complete, trip_end

A stop in routes.json may override the distances for that stop only, e.g.
    {"id": "x", "name": "...", "lat": .., "lon": .., "approach_m": 60, "arrive_m": 25}
(useful when two stops are very close together).
"""
import math
import threading
import logging

log = logging.getLogger("tracker")

OVERRIDABLE = ("approach_m", "arrive_m", "depart_extra_m", "pass_margin_m")


def haversine_m(lat1, lon1, lat2, lon2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


class TripTracker:
    def __init__(self, routes, thresholds, on_event):
        self.routes = routes
        self.th = thresholds
        self.on_event = on_event      # on_event(kind, stop_or_None, info_dict)
        self.lock = threading.RLock()
        self.active = False
        self.direction = None
        self.stops = []
        self.idx = 0
        self.current_idx = None
        self.phase = "idle"
        self.dist = None
        self.min_dist = None
        self.trip_id = 0

    # ---- control ----------------------------------------------------------
    def start_trip(self, direction):
        if direction not in self.routes:
            raise ValueError(f"unknown direction {direction}")
        with self.lock:
            if self.active:
                raise ValueError("a trip is already active; end it before starting another")
            self.direction = direction
            self.stops = self.routes[direction]["stops"]
            # A trip starts at its first station, so show it as current from the outset.
            self.current_idx = 0 if self.stops else None
            self.idx = 0
            self.phase = "waiting"
            self.dist = None
            self.min_dist = None
            self.active = True
            self.trip_id += 1
            self._emit("trip_start", None)

    def end_trip(self):
        """Driver/4B cancels the trip (this is NOT a completed trip)."""
        with self.lock:
            if not self.active:
                return
            self.active = False
            self.phase = "idle"
            self._emit("trip_end", None)

    def current_route(self):
        with self.lock:
            return (self.direction, self.stops, self.trip_id) if self.active else None

    # ---- helpers ----------------------------------------------------------
    def _th(self, stop):
        """Thresholds for one stop = global values + that stop's own overrides."""
        extra = {k: stop[k] for k in OVERRIDABLE if k in stop}
        return {**self.th, **extra} if extra else self.th

    def _info(self):
        return {"idx": self.idx, "total": len(self.stops), "direction": self.direction,
                "phase": self.phase, "current_idx": self.current_idx}

    def _emit(self, kind, stop):
        log.info("EVENT %s %s", kind, stop["name"] if stop else "")
        self.on_event(kind, stop, self._info())

    def _finish(self):
        self._emit("trip_complete", None)
        self.active = False
        self.phase = "idle"

    def _arrive(self):
        self.phase = "at_stop"
        self.current_idx = self.idx
        self._emit("here", self.stops[self.idx])
        if self.idx >= len(self.stops) - 1:
            self._finish()

    def _advance(self):
        if self.idx >= len(self.stops) - 1:
            self._finish()
            return
        self.idx += 1
        self.phase = "waiting"
        self.min_dist = None
        self.dist = None           # old stop's distance must not leak into the new stop
        self._emit("next", self.stops[self.idx])

    # ---- main update (called on every GPS fix) -----------------------------
    def update(self, lat, lon):
        with self.lock:
            if not self.active:
                return
            stop = self.stops[self.idx]
            th = self._th(stop)
            d = haversine_m(lat, lon, stop["lat"], stop["lon"])
            self.dist = d

            if self.phase == "waiting":
                # Process stops strictly in route order. Looking ahead here can
                # jump over a nearby stop and label the later one as current.
                if d <= th["approach_m"]:
                    self.phase = "approaching"
                    self.min_dist = d
                    # First stop is the starting station; announce its arrival only.
                    if self.idx != 0:
                        self._emit("approaching", stop)
                    # If a GPS update skipped over the approach radius and is
                    # already inside the arrival radius, preserve event order.
                    if d <= th["arrive_m"]:
                        self._arrive()
                elif d <= th["arrive_m"]:
                    # Supports a route stop whose arrival radius exceeds its
                    # approach radius.
                    self._arrive()

            elif self.phase == "approaching":
                self.min_dist = min(self.min_dist, d)
                if d <= th["arrive_m"]:
                    self._arrive()
                elif d > self.min_dist + th["pass_margin_m"]:
                    # drove past without entering the arrive radius
                    self._advance()

            elif self.phase == "at_stop":
                # Announce the following stop once the bus has moved the
                # configured departure distance from this stop.
                if d >= th["arrive_m"] + th["depart_extra_m"]:
                    self._advance()

    # ---- queries -----------------------------------------------------------
    def reminder_ok(self, suppress_m):
        """Reminders are only allowed mid-trip, away from any stop."""
        with self.lock:
            if not self.active or self.phase in ("approaching", "at_stop"):
                return False
            return self.dist is not None and self.dist > suppress_m

    def snapshot(self):
        with self.lock:
            return {"active": self.active, "direction": self.direction, "idx": self.idx,
                    "current_idx": self.current_idx, "phase": self.phase, "dist": self.dist}
