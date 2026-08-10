# First Boot Runbook

1. Open a terminal in this repository.
2. Run:

```bash
./scripts/check-prereqs.sh | tee artifacts/capability-inventory.txt
```

3. Install missing Fedora basics with `scripts/bootstrap-fedora.sh` only after reading it.
4. Install Tailscale from official instructions and authenticate Fedora + Android to the same tailnet.
5. Install/sign in to Codex CLI with `scripts/install-codex.sh` or the current official method.
6. Pair KDE Connect on the LAN.
7. Connect Android by USB, enable USB debugging, run `adb devices` and accept the host fingerprint on the phone.
8. Test scrcpy.
9. Copy `.env.example` to `.env` and generate a development bearer token.
10. `npm install && npm run dev:bridge`.
11. `curl http://127.0.0.1:8787/health`.
12. Do not enable remote unlock in this runbook.
