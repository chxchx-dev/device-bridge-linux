# Phase 08 — Remote Access, Wake and Secure Unlock

## Objective
Make the system useful away from home without punching holes into the router.

## Remote access
- [x] Tailnet ACL/grants reviewed; personal tailnet contains only the Fedora and Android devices, with no additional nodes requiring access rules.
- [x] MagicDNS naming chosen (existing tailnet hostname; private value remains local).
- [x] Bridge published with Tailscale Serve.
- [x] No Funnel/public exposure; Serve reports `tailnet only`.
- [x] Test from Android cellular data (Phase 1/3 evidence).

## Wake
- [x] Detect NIC WOL support with `ethtool` when applicable; Phase 00 evidence records no WOL capability on the active Wi-Fi interface.
- [x] Accept current hardware limitation: Wi-Fi wake is unsupported, so DeviceBridge keeps Fedora awake during idle instead.
- [ ] Optional future relay for replacement WOL-capable hardware.
- [ ] Optional future relay action with strict destination allowlist.
- [x] Remote dashboard availability tested from the cellular path.

## Unlock
- [ ] Confirm exact Fedora/KDE lock-session behavior.
- [x] Threat-model unlock adapter (ADR-010/ADR-011; unlock remains disabled).
- [ ] Require biometric step-up (only applicable if a secure unlock adapter is later approved).
- [ ] Require one-time short-lived challenge (only applicable if a secure unlock adapter is later approved).
- [x] Never store/replay Fedora password.
- [x] Keep feature disabled when desktop stack cannot support a secure flow.

## Exit criteria
Remote dashboard works from outside the LAN; hardware wake is explicitly unsupported on the current laptop and idle-suspend prevention is enabled as the safe fallback. Unlock remains explicitly unsupported—not hacked around.
