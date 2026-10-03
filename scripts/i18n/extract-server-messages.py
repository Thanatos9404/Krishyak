"""Extract static public provider/evidence messages, never runtime farmer data."""
import ast
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIELDS = {"title", "why", "message", "purpose", "limitations", "requires_verification", "review_scope", "description", "reason"}
records = []
for directory in (ROOT / "backend/v2", ROOT / "backend/remote_sensing"):
    for file in sorted(directory.glob("*.py")):
        tree = ast.parse(file.read_text(encoding="utf-8"))
        nodes = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Dict):
                for key, value in zip(node.keys, node.values):
                    if isinstance(key, ast.Constant) and key.value in FIELDS:
                        nodes.extend(ast.walk(value))
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in {"V2Error", "HTTPException"}:
                nodes.extend(ast.walk(node))
        for node in nodes:
            if isinstance(node, ast.Constant) and isinstance(node.value, str) and " " in node.value and not node.value.startswith(("https:", "SELECT ", "INSERT ", "UPDATE ", "DELETE ")):
                records.append({"source": node.value, "file": str(file.relative_to(ROOT)).replace("\\", "/"), "line": node.lineno})
output = ROOT / "docs/release/SERVER_STRING_INVENTORY.json"
output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Extracted {len(records)} static server message references")
