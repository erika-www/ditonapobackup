"""Shared helper: works out WHICH audio clips the app needs (from routes.json, config.json, reminders.json)."""
import json
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTS = (".mp3", ".wav", ".ogg")
LANG_NAME = {"tl": "Tagalog", "en": "English"}


def _load(*parts):
    with open(os.path.join(BASE, *parts), encoding="utf-8") as f:
        return json.load(f)


def audio_root():
    return os.path.join(BASE, _load("config.json")["audio"]["dir"])


def existing(rel_base):
    """Path of an existing file for rel_base (no extension), or None."""
    root = audio_root()
    for ext in EXTS:
        p = os.path.join(root, rel_base + ext)
        if os.path.isfile(p):
            return p
    return None


def needed_clips():
    """List of dicts: rel (path without extension, relative to audio/), lang, text (what to say), say (TTS wording)."""
    cfg, routes = _load("config.json"), _load("routes.json")
    clips, seen = [], set()
    for kind, languages in cfg.get("audio_phrases", {}).items():
        for lang, phrase in languages.items():
            clips.append({"rel": f"phrases/{kind}_{lang}", "lang": lang,
                          "text": phrase, "say": phrase, "group": "phrases"})
    for r in routes.values():
        for s in r["stops"]:
            folder = s.get("audio", s["id"])
            if folder in seen:
                continue
            seen.add(folder)
            for lang in ("tl", "en"):
                clips.append({"rel": f"stops/{folder}/name_{lang}", "lang": lang,
                              "text": s["name"], "say": s.get("say", s["name"]),
                              "group": folder})
    rem_path = os.path.join(audio_root(), "reminders", "reminders.json")
    if os.path.isfile(rem_path):
        with open(rem_path, encoding="utf-8") as f:
            for r in json.load(f):
                for lang in ("tl", "en"):
                    name = r.get(f"{lang}_audio")
                    if not name:
                        continue
                    stem = os.path.splitext(name)[0] if name.lower().endswith(EXTS) else name
                    clips.append({"rel": f"reminders/{stem}", "lang": lang, "text": r[f"{lang}_text"],
                                  "say": r[f"{lang}_text"], "group": "reminders"})
    return clips
