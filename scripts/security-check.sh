#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

echo "== DeviceBridge static safety checks =="

if git ls-files 2>/dev/null | grep -Eq '(^|/)\.env$'; then
  echo "FAIL: .env is tracked" >&2; exit 1
fi

# Flag dangerous primitives in network service source. Review exceptions manually.
if grep -RInE '(exec\(|execSync\(|shell:[[:space:]]*true|dangerously-bypass|--yolo)' services/bridge-api/src packages/command-registry/src 2>/dev/null; then
  echo "FAIL: potentially dangerous execution primitive found in remote control path" >&2; exit 1
fi

echo "PASS: no obvious forbidden remote execution primitive found"
