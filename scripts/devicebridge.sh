#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
bridge_service="devicebridge-bridge.service"
web_service="devicebridge-web-console.service"
keep_awake_service="devicebridge-keep-awake.service"

usage() {
  cat <<'MSG'
Uso: ./scripts/devicebridge.sh <up|down|status>

  up      compila el proyecto y arranca solo el bridge API en 127.0.0.1:8787
  down    detiene los servicios DeviceBridge sin borrar datos
  status  muestra servicios y salud local
MSG
}

service_state() {
  local service="$1"
  systemctl --user --quiet is-active "$service" && echo "OK       $service" || echo "INACTIVE $service"
}

up() {
  command -v pnpm >/dev/null || { echo "Falta pnpm." >&2; exit 1; }
  cd "$project_root"
  pnpm build
  systemctl --user daemon-reload
  systemctl --user restart "$bridge_service"
  sleep 1
  status
}

down() {
  systemctl --user stop "$web_service" "$bridge_service" "$keep_awake_service"
  echo "DeviceBridge detenido. No se borraron datos ni credenciales."
}

status() {
  service_state "$bridge_service"
  service_state "$web_service"
  service_state "$keep_awake_service"
  if curl --fail --silent --show-error --max-time 3 http://127.0.0.1:8787/health; then
    echo
  else
    echo "Bridge health: FAIL" >&2
    return 1
  fi
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  status) status ;;
  *) usage; exit 2 ;;
esac
