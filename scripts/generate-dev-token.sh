#!/usr/bin/env bash
set -euo pipefail
if command -v openssl >/dev/null 2>&1; then
  openssl rand -base64 48 | tr -d '\n'; echo
else
  echo "openssl is required" >&2
  exit 1
fi
