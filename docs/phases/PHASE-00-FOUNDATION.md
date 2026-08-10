# Phase 00 — Foundation and Capability Inventory

## Objective
Create a reproducible baseline and verify what the actual Fedora laptop + Android can do.

## Tasks
- [x] Initialize Git repository and first commit. *(Commit `d9abd3f` on `main`.)*
- [x] Run `scripts/check-prereqs.sh`.
- [x] Record Fedora version, kernel, desktop session and network interfaces.
- [x] Install/verify ADB.
- [x] Enable Android Developer Options and USB debugging only on trusted computers.
- [x] Verify `adb devices` over USB.
- [x] Verify scrcpy over USB. *(scrcpy 4.1 installed; USB device previously verified.)*
- [x] Pair KDE Connect on local Wi-Fi. *(User confirmed pairing; D-Bus inspection unavailable in sandbox.)*
- [x] Verify Tailscale on Fedora and Android.
- [x] Install Codex CLI. *(Sign-in remains unverified.)*
- [ ] Sign in to Codex CLI. *(CLI installed; login state not verified.)*
- [ ] Install/configure Sunshine only from an upstream-supported package.
- [ ] Record hardware WOL capability; do not enable remote wake yet.

## Deliverables
- Updated `STATE.md`.
- `artifacts/capability-inventory.txt` generated locally.
- No DeviceBridge public ports; Tailscale Serve is tailnet-only and proxies to loopback.

## Exit criteria
Fedora and Android can identify each other locally, Tailscale is online on both, and ADB/scrcpy works without root.
