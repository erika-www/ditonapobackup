#!/usr/bin/env python3
"""Pi 4B backend entrypoint (pi3b.py).

Per communication specification:
- Listens for UDP GPS packets from Pi 3B on port 5005
- Relays trip start/end commands and queries state from Pi 3B on http://192.168.10.3:8080
- Serves local REST API with CORS on http://localhost:5007 for Firefox Kiosk Personnel App

Runs bridge.py main().
"""
import sys
from bridge import main

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
