"""Bounded local CI startup wait; no credentials, provider calls or purchases."""
import time
from urllib.request import urlopen

deadline = time.monotonic() + 60
while time.monotonic() < deadline:
    try:
        with urlopen("http://127.0.0.1:8000/health/ready", timeout=2) as response:
            assert response.status == 200
        with urlopen("http://localhost:3000/farm", timeout=2) as response:
            assert response.status == 200
        break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit("Local API/frontend did not become ready within 60 seconds")
