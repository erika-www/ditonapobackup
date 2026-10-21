# Bus Announcer – Raspberry Pi 3B

Pi 3B = VK-162 GPS + RTC + portable monitor + speaker. It
1. reads GPS and sends `latitude/longitude` to the Pi 4B (UDP, Ethernet),
2. decides when to announce (approaching / here / next stop),
3. plays Tagalog + English audio and shows the same text on the monitor (lightweight pygame screen, no browser), in sync,
4. plays passenger reminders (food and drink, loud music, and belongings) only when safe.

## Files
| File | Purpose |
|---|---|
| `main.py` | starts everything |
| `config.json` | IP/port, distances, reminder interval, announcement wording |
| `routes.json` | stops + coordinates for each direction (**edit this**) |
| `tracker.py` | stop-trigger state machine + trip complete |
| `audio_manager.py` | one audio queue; reminders never overlap/override stop announcements |
| `screen.py` | monitor display (pygame, ~5 fps, low RAM) |
| `web.py` | small API for the 4B: trips + state + Wi-Fi (Python standard library only) |
| `wifi.py` | Wi-Fi control through NetworkManager |
| `run.sh` | autostart wrapper (restarts the app if it crashes) |
| `audio/` | your audio files (see below) |
| `tools/generate_audio.py` | auto-create all audio once (gTTS) |
| `tools/record_audio.py` | record the clips in your own voice (guided) |
| `tests/test_tracker.py` | automatic checks of the announcement triggers |
| `tools/listen_test.py` | run on Pi 4B to check GPS packets arrive |
| `tools/wifi_client.py` | helpers for the 4B to scan / connect the 3B's Wi-Fi |

## 1. Wiring / hardware notes
- VK-162 -> USB port (shows as `/dev/ttyACM0`; check with `ls /dev/ttyACM*`). Put it near a window/roof.
- RTC (DS3231 assumed) -> I2C pins 3 (SDA), 5 (SCL), 3.3V, GND.
- Monitor -> HDMI. Power the monitor from a separate 5V supply, not the Pi's USB ports (Pi 3B USB current is limited).
- Speaker -> 3.5 mm jack (or HDMI audio). Choose in `sudo raspi-config` > System > Audio.

## 2. RTC
```
sudo raspi-config        # Interface Options > I2C > enable
echo "dtoverlay=i2c-rtc,ds3231" | sudo tee -a /boot/firmware/config.txt   # /boot/config.txt on older OS
sudo apt remove -y fake-hwclock && sudo reboot
sudo hwclock -w          # once, while the clock is correct (internet) -> writes time to RTC
```
(Use `pcf8523` / `ds1307` if that is your module.)

## 3. Ethernet link (direct cable 3B <-> 4B)
Fixed IPs on a private subnet. I use `10.10.10.x` instead of `192.168.50.x` because `192.168.50.x` is the default
of many routers and could clash with your Wi-Fi. `never-default` stops the cable from becoming the internet route,
so Wi-Fi keeps working normally on both Pis. (Connection name may differ: check with `nmcli con show`.)
```
# Pi 3B
sudo nmcli con mod "Wired connection 1" ipv4.method manual ipv4.addresses 10.10.10.2/24 ipv4.never-default yes ipv6.method disabled
sudo nmcli con up "Wired connection 1"
# Pi 4B  (same, with 10.10.10.1/24)
```
Test: on 4B `python3 tools/listen_test.py`, on 3B run the app -> you should see packets.

**Also send GPS to the laptop:** `config.json` has a `laptop` receiver (`192.168.1.100:5006`).
Set `laptop.host` to the laptop's current Wi-Fi IPv4 address and keep the laptop and Pi 3B on a
network that can route between them. On the laptop, run `python tools/listen_gps.py`; allow Python
to receive traffic if Windows Firewall prompts. The listener prints each GPS JSON packet. The Pi
continues sending to the Pi 4B independently. Reserve the laptop's address in the router if possible.

**Using Wi-Fi between the two Pis instead of the cable** (two edits in `config.json`):
1. `pi4b.host` = the 4B's IP on the bus router. In the router, give both Pis a *DHCP reservation* so the IPs never change. Use IP addresses, not `.local` names (a name lookup can stall the GPS thread).
2. `api.allow_from` = only the 4B, e.g. `["192.168.1.10/32", "127.0.0.1/32"]`. Otherwise anyone on the bus Wi-Fi gets through.
Notes: the Pi 3B (non-"+") has 2.4 GHz Wi-Fi only. Do not use the Wi-Fi API to switch the 3B's network while that Wi-Fi *is* the link to the 4B: it will cut the link. The cable is more dependable on a vibrating bus; Wi-Fi is fine if the router is stable.

## 3a. Managing the 3B from the 4B (it has no screen or keyboard)
**First-time setup (once):** flash the 3B's SD card with *Raspberry Pi Imager* and use the settings (gear) button to set
hostname, username/password, **enable SSH**, your Wi-Fi, and the **Wi-Fi country (Philippines)**. A country must be set or
the Wi-Fi radio stays blocked. After that you never need a screen on the 3B.

**Day-to-day, everything goes through the cable from the 4B:**
| Need | How (from the 4B) |
|---|---|
| Change the 3B's Wi-Fi | Wi-Fi API below (use it in your touch-screen settings page) |
| Terminal access | `ssh <user>@10.10.10.2` |
| Replace audio files | `scp -r audio/ <user>@10.10.10.2:~/bus_announcer/` |
| Restart the app | `ssh <user>@10.10.10.2 sudo reboot` |

**Wi-Fi API** (3B, port 8080; ready-made Python helpers in `tools/wifi_client.py`):
```
GET  /api/wifi/status                          -> {"state":"connected","ssid":"HomeNet","ip":"192.168.1.23/24"}
GET  /api/wifi/scan                            -> {"networks":[{"ssid","signal","secured","connected"}]}
POST /api/wifi/connect {"ssid":"..","password":".."}   (leave password empty for open networks)
POST /api/wifi/forget  {"ssid":".."}
```
Typical touch flow: tap *Scan* -> pick a network -> type the password on the on-screen keyboard -> *Connect*.
A connect can take up to ~30 s (the 4B should show a "connecting..." state). The cable link is unaffected, so announcements and GPS keep working.

**Security:** the API only answers requests coming from `api.allow_from` in `config.json` (the cable subnet, `10.10.10.0/24`).
Even if the 3B joins a Wi-Fi network, other devices on that Wi-Fi get "403 forbidden" and can't change trips or Wi-Fi.
Wi-Fi passwords travel only over the private cable. Requires Raspberry Pi OS **Bookworm or newer** (NetworkManager).

## 4. Install
Use Raspberry Pi OS **with desktop**, set to auto-login (`raspi-config` > System > Boot / Auto Login > Desktop Autologin).
```
cd ~ && cp -r <this folder> bus_announcer && cd bus_announcer
sudo apt install -y python3-venv
python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
./venv/bin/python main.py --start-trip Northbound    # real GPS receiver required for progress
```
The screen opens fullscreen on the monitor. Press **Esc** to quit while testing.
It draws at 800x480 and SDL scales it to your monitor, so it stays light even on a 1080p panel
(change `display.width/height/fps` in config.json if your monitor is a different shape).
Use `--no-screen` to run without a monitor (audio + API only).

## 5. Audio files (reusable stitched clips)
Everything lives in `audio/`. Accepted: `.mp3 .wav .ogg`.
```
audio/phrases/approaching_tl.mp3   "Paparating na sa"
audio/phrases/approaching_en.mp3   "We are now approaching"
audio/phrases/here_tl.mp3          "Dito na po tayo sa"
audio/phrases/here_en.mp3          "We are now at"
audio/phrases/next_tl.mp3          "Ang susunod na istasyon ay"
audio/phrases/next_en.mp3          "The next bus stop will be"
audio/stops/<stop folder>/name_tl.mp3   stop name only
audio/stops/<stop folder>/name_en.mp3   stop name only
audio/reminders/*.mp3  + reminders.json        (text shown on screen + file names)
```
`<stop folder>` = the stop's `"audio"` value in routes.json, or its `"id"` if there is none. Use the same
`"audio"` for both directions of the same stop so you only record it once.
`audio/reminders/reminders.json` is a list; file names may be written with or without extension:
```
{"id": "no_food", "tl_text": "...", "en_text": "...", "tl_audio": "no_food_tl", "en_audio": "no_food_en"}
```
- **Your own voice:** `python tools/record_audio.py --list` shows what is missing; `python tools/record_audio.py` records each phrase, stop name, and reminder with on-screen prompts, trims silence, evens out the volume, and lets you listen and redo. Saves `.wav` with the right names. Run it on your laptop, then copy `audio/` to the Pi.
- Fast way: `pip install gTTS && python tools/generate_audio.py` (needs internet once, only creates missing files). To fix a pronunciation add `"say": "S B Road"` to that stop in `routes.json`.
- Better quality: record a human voice, name files as above, copy via USB/SCP. No code changes.
- New stop: add it to `routes.json` and record its two `name` clips. New reminder: add audio + one entry in `reminders.json`.
- Missing file = warning in log, screen still updates, nothing crashes.

## 6. Start a trip locally on the Pi 3B
For standalone testing without the Pi 4B, start the announcer with the route direction:
```
python main.py --start-trip Northbound
python main.py --start-trip Southbound
```
The 3B API provides `GET /api/state`, `POST /api/trip/start`, and `POST /api/trip/end`. The Pi 4B can start a route by sending `{"direction":"Northbound"}` or `{"direction":"Southbound"}` to `http://10.10.10.2:8080/api/trip/start`. These map to `Northbound` and `Southbound`, respectively. The app can run without `--start-trip` and wait for this request. GPS progression requires a real GPS receiver.

The 3B sends GPS fixes to the Pi 4B using UDP at `pi4b.host:pi4b.port` (default `10.10.10.1:5005`), at the configured `send_hz`. JSON packets contain `latitude`, `longitude`, and `timestamp`. On the Pi 3B, set `gps.port` to the receiver's Linux serial device, usually `/dev/ttyACM0`.

## 7. Announcement logic
For the next stop in the list only (stops can't trigger out of order):
- within `approach_m` -> "approaching"
- within `arrive_m` -> "here"
- when GPS places the bus 140 m from the upcoming stop -> "approaching"; when it is 15 m from the previous stop -> queue "next stop is ..." for the following stop, played after current-stop clips and a 2-second pause
- drove past without stopping -> goes straight to "next stop"
- the first station has no approaching announcement; approaching is audio-only, while the screen keeps the next-stop layout
- defaults: approach at 20 m, current stop at 10 m, and next-stop announcement at 20 m from the previous stop; announcement clips play English then Tagalog without overlapping, with a 10-second gap from approaching to current stop and a 2-second pause from current to next stop
- last stop reached -> the trip ends on the 3B (announcements and reminders stop until the 4B starts the next trip). `GET /api/state` has `trips_done` and `last_trip` so the 4B can count it (QC->SB = 1 trip, SB->QC = another). `POST /api/trip/end` cancels without counting.
- stops are processed in route order; a GPS fix near a later stop cannot skip the current target.

Reminders: only if the queue is empty, the bus is farther than `suppress_within_m` (150 m) from the next stop, and
`interval_s` has passed. If a stop announcement is triggered while a reminder is speaking, the reminder is cut off immediately.

**About the 10 m idea:** GPS accuracy is ~3-5 m, and a bus at 30 km/h covers 10 m in about 1 second, so a 10 m trigger would
announce too late (or miss). I defaulted to approach 100 m / arrive 30 m. Tune in `config.json` after a real drive.

## 7a. Test on your laptop in VS Code, then deploy to the Pi
```
python -m venv venv                       # Windows: venv\Scripts\activate     Linux/Mac: source venv/bin/activate
pip install -r requirements-dev.txt
python -m unittest discover -s tests -v   # checks the announcement triggers (no hardware)
python main.py --start-trip Northbound --windowed   # connect a GPS receiver to test movement
```
GPS progression and stop announcements require valid fixes from the connected GPS receiver. The `--start-trip` option starts the selected route locally, without a Pi 4B.
Keep files in **LF** line endings (`.vscode/settings.json` does this): a `run.sh` saved with Windows CRLF will not start on the Pi.
Deploy (from the project folder, Windows 10/11 PowerShell also has `scp`):
```
scp -r main.py tracker.py audio_manager.py screen.py display.py gps_reader.py sender.py web.py config.json routes.json requirements.txt run.sh audio audio_own tools <user>@<3B-ip>:~/bus_announcer/
```
Edit on the laptop and copy over; do not run the VS Code remote server on the 3B (too heavy for 1 GB).
Real-GPS check on the Pi: `./venv/bin/python -c "import serial;s=serial.Serial('/dev/ttyACM0',9600,timeout=2);print(s.readline())"` should print `$GPxxx` lines. Make sure the timezone is right (`sudo timedatectl set-timezone Asia/Manila`): the screen clock and the day/night theme use it.

## 8. Autostart
The screen needs the desktop session, so start the app from the desktop autostart (not systemd):
```
chmod +x ~/bus_announcer/run.sh
mkdir -p ~/.config/labwc && echo "$HOME/bus_announcer/run.sh &" >> ~/.config/labwc/autostart
```
(Older Raspberry Pi OS with X11/LXDE: add `@/home/pi/bus_announcer/run.sh` to `~/.config/lxsession/LXDE-pi/autostart`.)
`run.sh` restarts the app automatically if it crashes (pressing Esc is a clean exit and is NOT restarted).

## Keeping the Pi 3B light
- No browser and no web framework: the whole app is roughly 60-90 MB of RAM.
- Optional: `sudo systemctl disable bluetooth cups avahi-daemon` and turn off Wi-Fi if you only use the Ethernet cable.
- Use a good SD card (A1/A2 rated) and a stable 5V/2.5A supply; undervoltage causes more lag than anything else.

## Things to replace / confirm
1. **Stop names and coordinates in `routes.json` are SAMPLES.** Use real surveyed coordinates for every stop, per direction (opposite sides of the road have different coordinates).
2. **GPS packet format**: currently `{"latitude":..,"longitude":..,"timestamp":..}` over UDP port 5005 (or `"format":"csv"` -> `lat,lon`). Match what your 4B listener expects (the 4B can also be changed to TCP if you prefer).
