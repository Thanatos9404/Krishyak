"""Check the release documentation index and relative links without network access."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED = [
    "ARCHITECTURE",
    "DOMAIN_MODEL",
    "API",
    "DATABASE",
    "REMOTE_SENSING",
    "MODEL_GOVERNANCE",
    "GOVERNMENT_INTEGRATION",
    "SECURITY",
    "THREAT_MODEL",
    "PRIVACY",
    "OFFLINE_ARCHITECTURE",
    "DEPLOYMENT",
    "DISASTER_RECOVERY",
    "TESTING",
    "PILOT_PLAN",
    "DUE_DILIGENCE",
    "COST_MODEL",
    "KNOWN_LIMITATIONS",
    "TEST_REPORT",
    "DELIVERY_REPORT",
]


def main():
    directory = ROOT / "docs/v2"
    failures = [
        f"Missing required document: {name}"
        for name in REQUIRED
        if not (directory / f"{name}.md").is_file()
    ]
    files = list(directory.glob("*.md")) + [
        ROOT / name
        for name in ["README.md", "TECHNICAL_PROJECT_GUIDE.md", "datasetused.md"]
    ]
    for source in files:
        for target in re.findall(r"\]\(([^)]+)\)", source.read_text(encoding="utf-8")):
            if target.startswith(("http:", "https:", "#", "/")):
                continue
            path = target.split("#", 1)[0].strip("<>")
            if path and not (source.parent / path).exists():
                failures.append(
                    f"Broken relative link in {source.relative_to(ROOT)}: {path}"
                )
    if failures:
        raise SystemExit("\n".join(failures))
    print(
        f"Required release documents and relative links passed ({len(files)} documents)."
    )


if __name__ == "__main__":
    main()
