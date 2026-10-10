"""Extract static public provider/evidence messages, never runtime farmer data."""
import ast
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FIELDS = {"title", "why", "message", "purpose", "limitations", "requires_verification", "review_scope", "description", "reason", "use"}
records = []
for directory in (ROOT / "backend/v2", ROOT / "backend/remote_sensing"):
    for file in sorted(directory.rglob("*.py")):
        tree = ast.parse(file.read_text(encoding="utf-8"))
        nodes = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Assign) and any(
                (isinstance(target, ast.Attribute) and target.attr == "message") or
                (isinstance(target, ast.Subscript) and isinstance(target.slice, ast.Constant) and target.slice.value == "message")
                for target in node.targets
            ):
                nodes.extend(ast.walk(node.value))
            if isinstance(node, ast.Dict):
                for key, value in zip(node.keys, node.values):
                    if isinstance(key, ast.Constant) and key.value in FIELDS:
                        nodes.extend(ast.walk(value))
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in {"V2Error", "HTTPException"}:
                nodes.extend(ast.walk(node))
            elif (isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "ValueError"
                  and file.parent.name == "farm_context" and file.name in {"service.py", "engines.py"}):
                nodes.extend(ast.walk(node))
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in {"Source", "absent"}:
                for keyword in node.keywords:
                    if keyword.arg == "message": nodes.extend(ast.walk(keyword.value))
                if node.func.id == "absent" and len(node.args) > 1: nodes.extend(ast.walk(node.args[1]))
        for node in nodes:
            if isinstance(node, ast.Constant) and isinstance(node.value, str) and " " in node.value and not node.value.startswith(("https:", "SELECT ", "INSERT ", "UPDATE ", "DELETE ")):
                records.append({"source": node.value, "file": str(file.relative_to(ROOT)).replace("\\", "/"), "line": node.lineno})
# Farmer-facing disease names, causes and care steps shown after a photo check.
guidance_file = ROOT / "backend/v2/disease_guidance.json"
guidance = json.loads(guidance_file.read_text(encoding="utf-8"))
guidance_path = str(guidance_file.relative_to(ROOT)).replace("\\", "/")
for text in guidance["common_steps"]:
    records.append({"source": text, "file": guidance_path, "line": 1})
for entry in guidance["classes"].values():
    for text in [entry["name"], entry["cause"], *entry["steps"]]:
        records.append({"source": text, "file": guidance_path, "line": 1})
output = ROOT / "docs/release/SERVER_STRING_INVENTORY.json"
output.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Extracted {len(records)} static server message references")
