"""Print GPS JSON packets sent by the Pi 3B to this computer over UDP."""
import argparse
import json
import socket


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=5006)
    args = parser.parse_args()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("0.0.0.0", args.port))
    print(f"Listening for Pi 3B GPS packets on UDP port {args.port}; press Ctrl+C to stop")
    try:
        while True:
            payload, address = sock.recvfrom(4096)
            try:
                data = json.loads(payload.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                data = payload.decode("utf-8", errors="replace")
            print(f"{address[0]}: {data}", flush=True)
    except KeyboardInterrupt:
        pass
    finally:
        sock.close()


if __name__ == "__main__":
    main()
