"""Keep the flat cloud runtime manifest synchronized with locked adapter pins."""

import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
START = "# BEGIN GENERATED ADAPTER PINS: requirements-v2.txt\n"
END = "# END GENERATED ADAPTER PINS"


def synchronize(write=False):
    path = ROOT / "backend/requirements.txt"
    runtime = path.read_text(encoding="utf-8")
    adapters = (ROOT / "backend/requirements-v2.txt").read_text(encoding="utf-8").rstrip() + "\n"
    if runtime.count(START) != 1 or runtime.count(END) != 1:
        raise SystemExit("Runtime manifest must contain exactly one adapter block")
    if any(line.strip().startswith(("-r", "--requirement", "-c", "--constraint")) for line in adapters.splitlines()):
        raise SystemExit("Adapter manifest must contain direct locked requirements")
    prefix, block = runtime.split(START)
    _, suffix = block.split(END)
    expected = prefix + START + adapters + END + suffix
    if write:
        path.write_text(expected, encoding="utf-8", newline="\n")
    elif runtime != expected:
        raise SystemExit("Adapter pins differ. Run python scripts/sync_runtime_requirements.py --write")
    print("Flat runtime manifest matches the shared adapter pins")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--write", action="store_true")
    mode.add_argument("--check", action="store_true")
    synchronize(parser.parse_args().write)
