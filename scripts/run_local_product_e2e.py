"""Run browser checks against the local test stack and always remove generated fields.

Use the backend virtualenv. Start the isolated API and production preview first.
Additional arguments are passed directly to Playwright, without a shell.
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLEANUP = ROOT / "scripts/cleanup_local_e2e_fields.py"


def main():
    browser_server = os.environ.get("V2_E2E_BROWSER_WS")
    if browser_server and browser_server != "ws://127.0.0.1:9333/":
        raise SystemExit(
            "Remote local test browsers must use the fixed loopback server"
        )
    if (
        os.environ.get("V2_E2E_FRONTEND", "http://localhost:3000")
        != "http://localhost:3000"
    ):
        raise SystemExit("This cleanup runner supports only the fixed local test stack")
    # The cleanup guard validates database, port, environment, identity provider
    # and fixture mobiles before any tests or mutations are allowed.
    subprocess.run([sys.executable, str(CLEANUP)], check=True)
    npm = shutil.which("npm.cmd" if os.name == "nt" else "npm")
    if not npm:
        raise SystemExit("npm is required")
    environment = dict(os.environ, V2_E2E_PRODUCTION="true")
    try:
        result = subprocess.run(
            [npm, "run", "test:e2e", "--", *sys.argv[1:]],
            cwd=ROOT / "frontend",
            env=environment,
            check=False,
        )
    finally:
        subprocess.run([sys.executable, str(CLEANUP), "--apply"], check=True)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
