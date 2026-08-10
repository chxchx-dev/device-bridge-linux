# Phase 00 — Foundation and Capability Inventory

## Objective
Create a reproducible baseline and verify what the actual Fedora laptop + Android can do.

## Tasks
- [ ] Initialize Git repository and first commit. *(Repository initialized; first commit pending Git identity.)*
- [x] Run `scripts/check-prereqs.sh`.
- [x] Record Fedora version, kernel, desktop session and network interfaces.
- [x] Install/verify ADB.
- [x] Enable Android Developer Options and USB debugging only on trusted computers.
- [x] Verify `adb devices` over USB.
- [ ] Verify scrcpy over USB.
- [ ] Pair KDE Connect on local Wi-Fi.
- [x] Verify Tailscale on Fedora and Android.
- [x] Install Codex CLI. *(Sign-in remains unverified.)*
- [ ] Sign in to Codex CLI.
- [ ] Install/configure Sunshine only from an upstream-supported package.
- [ ] Record hardware WOL capability; do not enable remote wake yet.

## Deliverables
- Updated `STATE.md`.
- `artifacts/capability-inventory.txt` generated locally.
- No DeviceBridge public ports; Tailscale Serve is tailnet-only and proxies to loopback.

## Exit criteria
Fedora and Android can identify each other locally, Tailscale is online on both, and ADB/scrcpy works without root.
