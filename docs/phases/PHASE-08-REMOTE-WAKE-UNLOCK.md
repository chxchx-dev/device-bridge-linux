# Phase 08 — Remote Access, Wake and Secure Unlock

## Objective
Make the system useful away from home without punching holes into the router.

## Remote access
- [ ] Tailnet ACL/grants reviewed.
- [ ] MagicDNS naming chosen.
- [ ] Bridge published with Tailscale Serve.
- [ ] No Funnel/public exposure.
- [ ] Test from Android cellular data.

## Wake
- [ ] Detect NIC WOL support with `ethtool` when applicable.
- [ ] Verify BIOS/UEFI WOL option.
- [ ] Verify suspend/power-state behavior.
- [ ] Choose always-on relay if remote wake is required.
- [ ] Implement relay action with strict destination allowlist.
- [ ] Test from cellular network.

## Unlock
- [ ] Confirm exact Fedora/KDE lock-session behavior.
- [ ] Threat-model unlock adapter.
- [ ] Require biometric step-up.
- [ ] Require one-time short-lived challenge.
- [ ] Never store/replay Fedora password.
- [ ] Keep feature disabled when desktop stack cannot support a secure flow.

## Exit criteria
Remote dashboard and wake work from outside the LAN. Unlock is either securely validated or explicitly remains unsupported—not hacked around.
