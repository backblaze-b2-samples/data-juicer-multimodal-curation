"""Structural guard: the Data-Juicer engine stays in the isolated subprocess.

Mirrors test_structure.py's boto3 boundary check. Data-Juicer (and torch) must
never be imported into the FastAPI worker - only ``curation_worker.py``, which
is spawned as a subprocess, may import it. This keeps native-ML crash state out
of the API process.
"""

import ast
from pathlib import Path

APP_ROOT = Path(__file__).resolve().parents[1] / "app"


def _imports(path: Path) -> list[str]:
    tree = ast.parse(path.read_text())
    mods: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            mods += [a.name for a in node.names]
        elif isinstance(node, ast.ImportFrom) and node.module:
            mods.append(node.module)
    return mods


def test_data_juicer_imported_only_in_worker():
    offenders = []
    for pyfile in APP_ROOT.rglob("*.py"):
        if pyfile.name == "curation_worker.py":
            continue
        for mod in _imports(pyfile):
            if mod == "data_juicer" or mod.startswith("data_juicer."):
                offenders.append(str(pyfile.relative_to(APP_ROOT.parent)))
    assert offenders == [], (
        "Data-Juicer must only be imported in the subprocess worker; "
        f"found imports in: {offenders}"
    )
