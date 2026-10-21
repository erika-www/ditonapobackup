"""Checks WHEN announcements fire. Run:  python -m unittest -v      (from the project folder)"""
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tracker import TripTracker, haversine_m  # noqa: E402

TH = {"approach_m": 100, "arrive_m": 30, "depart_extra_m": 20, "pass_margin_m": 40}
M_PER_DEG = 111_320.0


def mk_route(n=3, spacing_m=500):
    """n stops in a straight north-going line, spacing_m apart."""
    return {"T": {"label": "t", "stops": [
        {"id": f"s{i}", "name": f"Stop {i}", "lat": 14.65 + i * spacing_m / M_PER_DEG, "lon": 121.05}
        for i in range(n)]}}


def drive(tracker, stops, lateral_m=0.0, speed=10.0, start_before=0.0):
    """Feed 1 Hz fixes along the stops. lateral_m shifts the bus sideways (bus passes beside the stop)."""
    lon_off = lateral_m / (M_PER_DEG * math.cos(math.radians(14.65)))
    pts = [(stops[0]["lat"] - start_before / M_PER_DEG, stops[0]["lon"] + lon_off)]
    for a, b in zip(stops, stops[1:]):
        d = haversine_m(a["lat"], a["lon"], b["lat"], b["lon"])
        steps = max(1, int(d / speed))
        for i in range(1, steps + 1):
            f = i / steps
            pts.append((a["lat"] + (b["lat"] - a["lat"]) * f, a["lon"] + lon_off))
    for lat, lon in pts:
        tracker.update(lat, lon)


class TrackerTests(unittest.TestCase):
    def setUp(self):
        self.events = []
        self.routes = mk_route()
        self.t = TripTracker(self.routes, TH, lambda k, s, i: self.events.append((k, s["id"] if s else None)))

    def kinds(self):
        return [e for e in self.events]

    def leave_stop0(self, t=None):
        """Bus is at stop 0 (-> 'here'), then pulls away 60 m (-> 'next stop 1')."""
        t = t or self.t
        s0 = t.routes["T"]["stops"][0]
        t.update(s0["lat"], s0["lon"])
        t.update(s0["lat"] + 60 / M_PER_DEG, s0["lon"])

    def test_normal_trip_sequence(self):
        self.t.start_trip("T")
        drive(self.t, self.routes["T"]["stops"])
        self.assertEqual(self.kinds(), [
            ("trip_start", None),
            ("here", "s0"), ("next", "s1"),
            ("approaching", "s1"), ("here", "s1"), ("next", "s2"),
            ("approaching", "s2"), ("here", "s2"), ("trip_complete", None)])

    def test_no_announcement_before_trip_start(self):
        drive(self.t, self.routes["T"]["stops"])
        self.assertEqual(self.events, [])

    def test_approach_happens_inside_100m_not_before(self):
        self.t.start_trip("T")
        self.leave_stop0()
        s1 = self.routes["T"]["stops"][1]
        self.t.update(s1["lat"] - 150 / M_PER_DEG, s1["lon"])
        self.assertNotIn(("approaching", "s1"), self.events)
        self.t.update(s1["lat"] - 95 / M_PER_DEG, s1["lon"])
        self.assertIn(("approaching", "s1"), self.events)

    def test_drive_past_without_stopping_goes_to_next(self):
        self.t.start_trip("T")
        stops = self.routes["T"]["stops"]
        drive(self.t, stops[:1])                       # at stop 0
        self.events.clear()
        drive(self.t, stops, lateral_m=60)             # passes 60 m beside every stop: never inside 30 m
        kinds = [k for k, _ in self.events]
        self.assertNotIn("here", kinds)
        self.assertIn(("approaching", "s1"), self.events)
        self.assertIn(("next", "s2"), self.events)

    def test_gps_gap_resyncs_to_following_stop(self):
        self.t.start_trip("T")
        s2 = self.routes["T"]["stops"][2]
        self.t.update(s2["lat"], s2["lon"])            # teleport to the last stop
        self.assertEqual(self.events[-2:], [("here", "s2"), ("trip_complete", None)])
        self.assertNotIn(("here", "s0"), self.events)

    def test_trip_selected_late_resyncs_at_next_real_stop(self):
        self.t.start_trip("T")
        s1 = self.routes["T"]["stops"][1]
        self.t.update(s1["lat"] - 200 / M_PER_DEG, s1["lon"])    # already past stop 0, nothing fires yet
        self.assertEqual(self.events, [("trip_start", None)])
        self.t.update(s1["lat"], s1["lon"])
        self.assertEqual(self.events[-1], ("here", "s1"))

    def test_trip_end_is_not_trip_complete(self):
        self.t.start_trip("T")
        self.t.end_trip()
        self.assertEqual(self.events[-1], ("trip_end", None))
        self.assertNotIn("trip_complete", [k for k, _ in self.events])
        self.t.update(*[self.routes["T"]["stops"][0][k] for k in ("lat", "lon")])
        self.assertNotIn(("here", "s0"), self.events)

    def test_reminders_blocked_near_stops(self):
        self.t.start_trip("T")
        s = self.routes["T"]["stops"]
        self.t.update(s[0]["lat"] - 300 / M_PER_DEG, s[0]["lon"])    # 300 m before stop 0, waiting
        self.assertTrue(self.t.reminder_ok(150))
        self.t.update(s[0]["lat"] - 90 / M_PER_DEG, s[0]["lon"])     # approaching
        self.assertFalse(self.t.reminder_ok(150))

    def test_per_stop_override(self):
        routes = mk_route()
        routes["T"]["stops"][1]["approach_m"] = 50
        ev = []
        t = TripTracker(routes, TH, lambda k, s, i: ev.append((k, s["id"] if s else None)))
        t.start_trip("T")
        self.leave_stop0(t)
        s1 = routes["T"]["stops"][1]
        t.update(s1["lat"] - 80 / M_PER_DEG, s1["lon"])
        self.assertNotIn(("approaching", "s1"), ev)
        t.update(s1["lat"] - 45 / M_PER_DEG, s1["lon"])
        self.assertIn(("approaching", "s1"), ev)


if __name__ == "__main__":
    unittest.main()
