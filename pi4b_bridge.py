#!/usr/bin/env python3
"""Root executable wrapper for Pi 4B <-> Pi 3B Communication Bridge.

Run directly on the Raspberry Pi 4B:
    python3 pi4b_bridge.py

Or with mock mode for testing without physical Pi 3B:
    python3 pi4b_bridge.py --mock-3b
"""
import os
import sys

# Add raspi4b connec directory to python path
current_dir = os.path.dirname(os.path.abspath(__file__))
bridge_dir = os.path.join(current_dir, "bus_announcer", "raspi4b connec")
if bridge_dir not in sys.path:
    sys.path.insert(0, bridge_dir)

from bridge import main

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
