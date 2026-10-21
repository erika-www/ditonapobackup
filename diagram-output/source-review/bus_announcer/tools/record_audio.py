"""Record the announcements in YOUR OWN VOICE (run this on your laptop, then copy the audio/ folder to the Pi).

    pip install sounddevice numpy
    python tools/record_audio.py --list            # show what is recorded / still missing (no microphone needed)
    python tools/record_audio.py                   # record every missing clip, one by one
    python tools/record_audio.py --only sb_road    # only one stop (or: --only reminders)
    python tools/record_audio.py --redo            # re-record clips that already exist (old ones are kept in audio/_replaced/)

For each clip: it shows the sentence -> press Enter to start -> speak -> press Enter to stop ->
it trims the silence, evens out the volume, plays it back -> [k]eep / [r]edo / [s]kip / [q]uit.
Files are saved as .wav (mono 44.1 kHz) with the exact names the app expects.
"""
import argparse
import os
import shutil
import sys
import time
import wave

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import clips  # noqa: E402

RATE = 44100


def trim_and_normalize(np, x):
    """x: float32 mono in -1..1. Cut leading/trailing silence, keep ~0.15 s of padding, peak-normalize."""
    if x.size == 0:
        return x
    thr = max(0.015, float(np.abs(x).max()) * 0.06)
    loud = np.where(np.abs(x) > thr)[0]
    if loud.size == 0:
        return x
    pad = int(0.15 * RATE)
    x = x[max(0, loud[0] - pad): loud[-1] + pad]
    peak = float(np.abs(x).max())
    return x * (0.89 / peak) if peak > 0 else x       # -1 dBFS


def save_wav(np, path, x):
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm.tobytes())


def record_one(sd, np):
    chunks = []
    stream = sd.InputStream(samplerate=RATE, channels=1, dtype="float32",
                            callback=lambda indata, frames, t, status: chunks.append(indata.copy()))
    input("   [Enter] = start recording ")
    stream.start()
    input("   ...recording...  [Enter] = stop ")
    stream.stop()
    stream.close()
    return np.concatenate(chunks)[:, 0] if chunks else np.zeros(0, dtype="float32")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--only")
    ap.add_argument("--redo", action="store_true")
    ap.add_argument("--device", help="microphone name or number (see: python -m sounddevice)")
    args = ap.parse_args()

    todo = [c for c in clips.needed_clips() if not args.only or c["group"] == args.only]
    root = clips.audio_root()
    if args.list:
        missing = 0
        for c in todo:
            have = clips.existing(c["rel"])
            missing += not have
            print(("  OK       " if have else "  MISSING  ") + c["rel"])
        print(f"\n{missing} missing of {len(todo)}")
        return

    import numpy as np
    import sounddevice as sd
    if args.device:
        sd.default.device = int(args.device) if args.device.isdigit() else args.device
    todo = [c for c in todo if args.redo or not clips.existing(c["rel"])]
    print(f"{len(todo)} clip(s) to record. Quiet room, microphone ~20 cm from your mouth, speak at a steady pace.\n")
    for n, c in enumerate(todo, 1):
        while True:
            print(f"[{n}/{len(todo)}] {c['rel']}   ({clips.LANG_NAME[c['lang']]})")
            print(f'   SAY:  "{c["text"]}"')
            x = trim_and_normalize(np, record_one(sd, np))
            if x.size < RATE * 0.3:
                print("   too short / silent - try again\n")
                continue
            sd.play(x, RATE)
            sd.wait()
            ans = input("   [k]eep  [r]edo  [s]kip  [q]uit > ").strip().lower() or "k"
            if ans.startswith("r"):
                continue
            if ans.startswith("q"):
                return
            if ans.startswith("k"):
                out = os.path.join(root, c["rel"] + ".wav")
                os.makedirs(os.path.dirname(out), exist_ok=True)
                old = clips.existing(c["rel"])
                while old:      # keep old versions (mp3 would otherwise win over the new wav)
                    bak = os.path.join(root, "_replaced", time.strftime("%Y%m%d_%H%M%S"),
                                       os.path.relpath(old, root))
                    os.makedirs(os.path.dirname(bak), exist_ok=True)
                    shutil.move(old, bak)
                    old = clips.existing(c["rel"])
                save_wav(np, out, x)
                print("   saved\n")
            break
    print("All done. Copy the audio/ folder to the Pi (scp -r audio ...).")


if __name__ == "__main__":
    main()
