#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

command -v adb >/dev/null || { echo "Falta adb (android-tools)." >&2; exit 1; }
if ! adb get-state >/dev/null 2>&1; then
  echo "No hay un Android autorizado por ADB. Conecta el teléfono y acepta la huella USB." >&2
  adb devices -l || true
  exit 1
fi

pnpm --filter DeviceBridgeMobile typecheck
pnpm --filter DeviceBridgeMobile android
