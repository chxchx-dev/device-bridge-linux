#!/usr/bin/env bash
set -euo pipefail

cat <<'MSG'
OpenAI's Codex CLI macOS/Linux docs currently provide a standalone installer.
Review the installer URL before running this script.
MSG

read -r -p "Install/update Codex CLI from official chatgpt.com installer? [y/N] " ans
[[ "$ans" =~ ^[Yy]$ ]] || exit 0
curl -fsSL https://chatgpt.com/codex/install.sh | sh

echo "Run 'codex' in the repository and sign in interactively."
