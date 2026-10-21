#!/usr/bin/env python3
"""Raspberry Pi 3B bus announcer.

  python main.py                      real GPS (VK-162)
  python main.py --start-trip Northbound --windowed     (real GPS required)
"""
import argparse
import json
import logging
import logging.handlers
import os
import threading
import time

from audio_manager import AudioManager
from display import DisplayState
from gps_reader import GPSReader
from sender import Pi4Sender
from tracker import TripTracker, haversine_m
from web import create_server

BASE = os.path.dirname(os.path.abspath(__file__))
log = logging.getLogger("main")


def load(name):
    with open(os.path.join(BASE, name), encoding="utf-8") as f:
        return json.load(f)


def setup_logging():
    fmt = logging.Formatter("%(asctime)s %(name)s: %(message)s")
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    console = logging.StreamHandler()
    console.setFormatter(fmt)
    root.addHandler(console)
    try:   # small rotating file (max ~1 MB total) so the SD card is not worn out
        fh = logging.handlers.RotatingFileHandler(os.path.join(BASE, "announcer.log"),
                                                  maxBytes=500_000, backupCount=1, encoding="utf-8")
        fh.setFormatter(fmt)
        root.addHandler(fh)
    except OSError:
        pass


def safe(fn, name):
    """A bug in a callback must never kill the GPS thread - log it and carry on."""
    def wrapper(*a, **kw):
        try:
            return fn(*a, **kw)
        except Exception:
            log.exception("error in %s", name)
    return wrapper


def jump_filter(on_fix, max_mps):
    """Drop impossible GPS jumps (urban canyon / flyover multipath). 3 rejects in a row = trust the new position."""
    last = {"t": None, "lat": 0.0, "lon": 0.0, "rej": 0}

    def f(lat, lon, kmh):
        now = time.monotonic()
        if last["t"] is not None and last["rej"] < 3:
            dt = max(now - last["t"], 1.0)
            if haversine_m(last["lat"], last["lon"], lat, lon) / dt > max_mps:
                last["rej"] += 1
                log.warning("GPS jump ignored (%.5f, %.5f)", lat, lon)
                return
        last.update(t=now, lat=lat, lon=lon, rej=0)
        on_fix(lat, lon, kmh)
    return f


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-screen", action="store_true", help="headless (no monitor), API + audio only")
    ap.add_argument("--windowed", action="store_true", help="window instead of fullscreen (laptop testing)")
    ap.add_argument("--start-trip", help="e.g. Northbound")
    args = ap.parse_args()

    setup_logging()
    cfg, routes = load("config.json"), load("routes.json")
    for key, r in routes.items():
        for s in r["stops"]:
            assert all(k in s for k in ("id", "name", "lat", "lon")), f"bad stop in {key}: {s}"
    if args.start_trip and args.start_trip not in routes:
        raise SystemExit(f"--start-trip must be one of {list(routes)}")
    display = DisplayState()
    sender_cfg = dict(cfg["pi4b"])
    sender_cfg["laptop"] = cfg.get("laptop")
    sender = Pi4Sender(sender_cfg)
    audio = AudioManager(BASE, cfg["audio"], cfg["text"], cfg["reminders"], display)
    done = {"n": 0}

    def sync_current_display(stop):
        # The GPS tracker can reach a stop while the preceding approach clip
        # is still playing. Move the display when the current-stop clip starts.
        state = display.snapshot()
        route = routes.get(state.get("trip"), {})
        for stop_index, route_stop in enumerate(route.get("stops", [])):
            if route_stop.get("id") == stop.get("id"):
                display.update(current_idx=stop_index, idx=stop_index)
                break

    audio.on_here_start = sync_current_display

    def on_event(kind, stop, info):
        display.update(idx=info["idx"], phase=info["phase"])
        if kind in ("approaching", "here", "next"):
            audio.announce(kind, stop)
        elif kind == "trip_start":
            audio.clear()
            audio.reset_reminder_timer()
            display.clear_banner()
            r = routes[info["direction"]]
            display.update(active=True, trip=info["direction"], trip_label=r["label"],
                           current_idx=info["current_idx"],
                           stops=[s["name"] for s in r["stops"]], idx=0, phase="waiting")
        elif kind == "trip_complete":
            done["n"] += 1
            display.update(active=False, phase="idle", trips_done=done["n"],
                           last_trip={"direction": info["direction"],
                                      "finished_at": time.strftime("%Y-%m-%d %H:%M:%S")})
        elif kind == "trip_end":
            audio.clear()
            display.clear_banner()
            display.update(active=False, phase="idle")

    tracker = TripTracker(routes, cfg["thresholds"], on_event)
    audio.reminder_ok = lambda: tracker.reminder_ok(cfg["reminders"]["suppress_within_m"])

    def on_fix(lat, lon, kmh):
        print(f"GPS: lat={lat:.6f}, lon={lon:.6f}, speed={kmh:.1f} km/h", flush=True)
        sender.send(lat, lon)
        tracker.update(lat, lon)
        display.update(gps={"fix": True, "lat": round(lat, 6), "lon": round(lon, 6), "kmh": round(kmh)},
                       dist=tracker.snapshot()["dist"])

    def on_nofix():
        g = display.snapshot()["gps"]
        g["fix"] = False
        display.update(gps=g)

    on_fix, on_nofix = safe(on_fix, "on_fix"), safe(on_nofix, "on_nofix")

    audio.start()
    real_fix = jump_filter(on_fix, cfg["gps"].get("max_speed_mps", 45))
    GPSReader(cfg["gps"]["port"], cfg["gps"]["baud"], real_fix, on_nofix).start()

    if args.start_trip:
        tracker.start_trip(args.start_trip)

    server = create_server(cfg["api"]["host"], cfg["api"]["port"], display, tracker, routes,
                           cfg["api"].get("allow_from", ["10.10.10.0/24", "127.0.0.1/32"]))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    log.info("API on %s:%s - ready", cfg["api"]["host"], cfg["api"]["port"])

    if args.no_screen:
        while True:
            time.sleep(3600)
    from screen import Screen          # pygame display must run on the main thread
    dcfg = dict(cfg.get("display", {}))
    if args.windowed:
        dcfg["fullscreen"] = False
    Screen(dcfg).run(display)


if __name__ == "__main__":
    main()
