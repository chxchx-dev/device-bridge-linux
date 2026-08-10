#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

for f in scripts/*.sh; do bash -n "$f"; done
python3 - <<'PY2'
from pathlib import Path
import json, tomllib
root=Path('.')
excluded={'node_modules', 'dist', 'coverage', '.git'}
for p in root.rglob('*.json'):
    if excluded.intersection(p.parts):
        continue
    json.loads(p.read_text())
for p in root.rglob('*.toml'):
    if excluded.intersection(p.parts):
        continue
    tomllib.loads(p.read_text())
print('JSON/TOML parse OK')
PY2
bash scripts/security-check.sh

echo "Project static validation OK"
