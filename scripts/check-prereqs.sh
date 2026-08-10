#!/usr/bin/env bash
set -u

inventory_file="${DEVICEBRIDGE_INVENTORY_FILE:-artifacts/capability-inventory.txt}"
mkdir -p "$(dirname "$inventory_file")"
exec > >(tee "$inventory_file") 2>&1

echo "== DeviceBridge capability inventory =="
echo "Date: $(date -Is 2>/dev/null || date)"
echo

echo "-- OS --"
cat /etc/os-release 2>/dev/null | grep -E '^(NAME|VERSION|VERSION_ID|PRETTY_NAME)=' || true
uname -a || true

echo
echo "-- Session --"
echo "XDG_CURRENT_DESKTOP=${XDG_CURRENT_DESKTOP:-unknown}"
echo "XDG_SESSION_TYPE=${XDG_SESSION_TYPE:-unknown}"

echo
echo "-- Commands --"
for cmd in git node npm adb scrcpy kdeconnect-cli tailscale sunshine codex ethtool systemctl loginctl; do
  if command -v "$cmd" >/dev/null 2>&1; then
    printf '%-18s %s\n' "$cmd" "$(command -v "$cmd")"
  else
    printf '%-18s MISSING\n' "$cmd"
  fi
done

echo
echo "-- Tailscale --"
if command -v tailscale >/dev/null 2>&1; then tailscale status 2>&1 || true; fi

echo
echo "-- ADB --"
if command -v adb >/dev/null 2>&1; then adb devices -l 2>&1 || true; fi

echo
echo "-- Network interfaces / WOL hints --"
if command -v ip >/dev/null 2>&1; then ip -brief link 2>/dev/null || true; fi
if command -v ethtool >/dev/null 2>&1; then
  while read -r iface; do
    [[ "$iface" == "lo" ]] && continue
    echo "Interface: $iface"
    ethtool "$iface" 2>/dev/null | grep -E 'Supports Wake-on|Wake-on' || true
  done < <(ls /sys/class/net 2>/dev/null)
fi

echo
echo "Inventory complete. Record results in STATE.md; do not enable features based only on package presence."
