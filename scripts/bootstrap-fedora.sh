#!/usr/bin/env bash
set -euo pipefail

cat <<'MSG'
This script installs only baseline Fedora packages from Fedora repositories.
It intentionally does NOT install Sunshine, Tailscale, scrcpy, or Codex from third-party sources.
Read docs/SOURCES.md and use current upstream instructions for those tools.
MSG

sudo dnf install -y git nodejs npm android-tools kde-connect ethtool openssh-clients openssh-server

echo "Baseline packages installed. Run ./scripts/check-prereqs.sh again."
