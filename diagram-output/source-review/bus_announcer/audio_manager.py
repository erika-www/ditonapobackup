"""Plays announcements + reminders on ONE worker thread so they can never overlap.

Rules:
  * Stop announcements (approaching / here / next) are queued and play in order.
  * Announcements play fully in English then Tagalog, in queue order.
  * Reminders only start when nothing is queued AND the tracker says it's safe
    (not near a stop). If an announcement arrives mid-reminder, the reminder is
    cut off immediately and the announcement plays.
  * clear() (new trip / trip cancelled) empties the queue and stops what is playing.
  * The monitor banner is set when speech starts, and highlights the language being spoken.
  * Any error inside the worker is logged and the worker keeps running.
"""
import json
import logging
import os
import threading
import time

os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")
import pygame  # noqa: E402

log = logging.getLogger("audio")
EXTS = (".mp3", ".wav", ".ogg")


class AudioManager(threading.Thread):
    def __init__(self, base_dir, audio_cfg, text_cfg, rem_cfg, display):
        super().__init__(daemon=True)
        self.root = os.path.join(base_dir, audio_cfg["dir"])
        self.gap = audio_cfg.get("gap_between_languages_s", 0.4)
        self.banner_min = audio_cfg.get("banner_min_s", 4)
        self.approach_to_here_gap = audio_cfg.get("approach_to_here_gap_s", 60)
        # Departure is detected by GPS; play the queued next-stop cue only
        # after the current-stop clips finish and this short pause elapses.
        self.here_to_next_gap = audio_cfg.get("here_to_next_gap_s", 2)
        self.text = text_cfg
        self.rem_cfg = rem_cfg
        self.display = display
        self.on_here_start = None     # optional callback for GPS/display synchronization
        self.reminder_ok = lambda: False     # set by main.py
        self._items = []
        self._lock = threading.Lock()
        self._wake = threading.Event()
        self._abort = threading.Event()      # set by clear(): stop what is playing right now
        self.last_reminder = time.time()
        self.rem_idx = 0
        self._approach_finished = {}
        self._here_finished = None
        self.reminders = self._load_reminders()
        self.ok = True
        try:
            pygame.mixer.init()
            pygame.mixer.music.set_volume(audio_cfg.get("volume", 1.0))
        except pygame.error as e:
            log.error("No audio device (%s) - running silent", e)
            self.ok = False

    # ---- public ---------------------------------------------------------
    def announce(self, kind, stop):
        with self._lock:
            self._items.append((kind, stop))
        self._wake.set()

    def clear(self):
        with self._lock:
            self._items.clear()
        self._approach_finished.clear()
        self._here_finished = None
        self._abort.set()

    def reset_reminder_timer(self):
        self.last_reminder = time.time()

    # ---- helpers --------------------------------------------------------
    def _pending(self):
        with self._lock:
            return bool(self._items)

    def _pop(self):
        with self._lock:
            if self._items:
                return self._items.pop(0)
            self._wake.clear()
            return None

    def _load_reminders(self):
        p = os.path.join(self.root, "reminders", "reminders.json")
        try:
            with open(p, encoding="utf-8") as f:
                return json.load(f)
        except (OSError, ValueError) as e:
            log.warning("No reminders loaded: %s", e)
            return []

    def _find(self, rel_base):
        """rel_base has no extension; any of .mp3 .wav .ogg is accepted."""
        for ext in EXTS:
            p = os.path.join(self.root, rel_base + ext)
            if os.path.isfile(p):
                return p
        return None

    def _find_reminder(self, name):
        """reminders.json may say "no_food_tl.mp3" or just "no_food_tl"; the extension can differ on disk."""
        if not name:
            return None
        stem = os.path.splitext(name)[0] if name.lower().endswith(EXTS) else name
        return self._find("reminders/" + stem)

    def _announcement_paths(self, kind, folder, lang):
        """Use reusable phrase + stop-name clips when present; retain legacy full-stop clips as fallback."""
        phrase = self._find(f"phrases/{kind}_{lang}")
        stop_name = self._find(f"stops/{folder}/name_{lang}")
        if phrase and stop_name:
            return [phrase, stop_name]
        legacy = self._find(f"stops/{folder}/{kind}_{lang}")
        return [legacy] if legacy else []

    def _play(self, path, interruptible):
        """Blocks until finished. Returns False if cut off (by an announcement or clear())."""
        if not self.ok:
            return not self._abort.wait(2)
        try:
            pygame.mixer.music.load(path)
            pygame.mixer.music.play()
        except pygame.error as e:
            log.error("Cannot play %s: %s", path, e)
            return True
        while pygame.mixer.music.get_busy():
            if self._abort.is_set() or (interruptible and self._pending()):
                pygame.mixer.music.stop()
                return False
            time.sleep(0.05)
        return True

    # ---- worker ---------------------------------------------------------
    def run(self):
        while True:
            try:
                item = self._pop()
                if item:
                    self._abort.clear()
                    self._announce(*item)
                else:
                    self._abort.clear()            # idle: a leftover abort must not cut the next reminder
                    self._maybe_reminder()
                    self._wake.wait(0.5)
            except Exception:                      # never let the audio thread die
                log.exception("audio worker error")
                time.sleep(1)

    def _announce(self, kind, stop):
        if kind == "here":
            self._wait_gap(self._approach_finished.get(stop["id"]),
                           self.approach_to_here_gap)
        elif kind == "next":
            self._wait_gap(self._here_finished, self.here_to_next_gap)
        if self._abort.is_set():
            return
        if kind == "here" and self.on_here_start:
            self.on_here_start(stop)
        started = time.time()
        name = stop["name"]
        tl = self.text[kind]["tl"].format(stop=name)
        en = self.text[kind]["en"].format(stop=name)
        self.display.set_banner(kind, tl, en, name)
        folder = stop.get("audio", stop["id"])
        for lang in ("en", "tl"):
            if self._abort.is_set():
                break
            self.display.set_speaking(lang)
            paths = self._announcement_paths(kind, folder, lang)
            if paths:
                if any(not self._play(path, interruptible=False) for path in paths):
                    break
            else:
                log.warning("Missing audio: audio/phrases/%s_%s and audio/stops/%s/name_%s (or legacy full clip)",
                            kind, lang, folder, lang)
                if self._abort.wait(1.5):
                    break
            if self._abort.wait(self.gap):
                break
        if not self._abort.is_set():
            if kind == "approaching":
                self._approach_finished[stop["id"]] = time.monotonic()
            elif kind == "here":
                self._here_finished = time.monotonic()
        if not self._abort.is_set() and not self._pending():
            remaining = self.banner_min - (time.time() - started)
            until = time.time() + max(0, remaining)
            while time.time() < until and not self._abort.is_set() and not self._pending():
                self._abort.wait(min(0.05, until - time.time()))
        if not self._pending():
            self.display.clear_banner()
        self.last_reminder = time.time()   # don't fire a reminder right after a stop announcement

    def _wait_gap(self, previous_finished, gap_s):
        if previous_finished is None or gap_s <= 0:
            return
        deadline = previous_finished + gap_s
        while not self._abort.is_set():
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                return
            self._abort.wait(min(0.1, remaining))

    def _maybe_reminder(self):
        if not self.rem_cfg.get("enabled") or not self.reminders:
            return
        interval = self.rem_cfg.get("interval_s", 180)
        if time.time() - self.last_reminder < interval or not self.reminder_ok():
            return
        r = self.reminders[self.rem_idx % len(self.reminders)]
        self.display.set_banner("reminder", r["tl_text"], r["en_text"])
        finished = True
        for lang in ("en", "tl"):
            self.display.set_speaking(lang)
            path = self._find_reminder(r.get(f"{lang}_audio", ""))
            if path:
                if not self._play(path, interruptible=False):
                    finished = False
                    break
            else:
                log.warning("Missing reminder audio: %s", r.get(f"{lang}_audio"))
                time.sleep(2)
            time.sleep(self.gap)
        if finished:
            self.rem_idx += 1
            self.last_reminder = time.time()
        else:
            self.last_reminder = time.time() - interval + 30   # retry in ~30 s
        if not self._pending():
            self.display.clear_banner()
