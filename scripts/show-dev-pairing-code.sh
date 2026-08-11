#!/usr/bin/env bash
set -euo pipefail

bridge_pid="$(systemctl --user show devicebridge-bridge.service --property=MainPID --value 2>/dev/null || true)"
if [[ ! "$bridge_pid" =~ ^[1-9][0-9]*$ ]]; then
  bridge_pid="$(pgrep -f '/pnpm --filter @devicebridge/bridge-api run dev' | head -n 1 || true)"
fi
if [[ -z "$bridge_pid" ]]; then
  echo "DeviceBridge Bridge process is not running" >&2
  exit 1
fi

pairing_token="$(tr '\0' '\n' < "/proc/$bridge_pid/environ" | sed -n 's/^DEVICEBRIDGE_PAIRING_TOKEN=//p')"
if [[ ${#pairing_token} -lt 24 ]]; then
  echo "The running Bridge has no valid pairing token" >&2
  exit 1
fi

hash_hex="$(printf '%s' "$pairing_token" | sha256sum | cut -c1-7)"
printf '%s\n' "$((16#$hash_hex % 900000 + 100000))"
