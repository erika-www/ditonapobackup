"""Create every missing audio clip with Google text-to-speech (needs internet once; only creates MISSING files).

    pip install gTTS
    python tools/generate_audio.py            # make all missing clips (.mp3)
    python tools/generate_audio.py --only sb_road

Tip: if a name is pronounced badly (e.g. "SB"), add a  "say": "S B Road"  entry to that stop in routes.json.
Your own recordings always win: this script never overwrites an existing file (any of .mp3/.wav/.ogg).
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import clips  # noqa: E402

GTTS_LANG = {"tl": "tl", "en": "en"}      # gTTS calls Filipino "tl"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="only this stop folder / 'reminders'")
    args = ap.parse_args()
    from gtts import gTTS
    root = clips.audio_root()
    made = 0
    for c in clips.needed_clips():
        if args.only and c["group"] != args.only:
            continue
        if clips.existing(c["rel"]):
            continue
        out = os.path.join(root, c["rel"] + ".mp3")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        print("creating", c["rel"], "->", c["say"])
        gTTS(text=c["say"], lang=GTTS_LANG[c["lang"]]).save(out)
        made += 1
    print(f"done, {made} new file(s)")


if __name__ == "__main__":
    main()
