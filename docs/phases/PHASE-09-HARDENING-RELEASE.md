# Phase 09 — Hardening and Personal Release

## Objective
Turn the project into a maintainable daily-use system.

## Tasks
- [ ] Dependency audit (audit found two high-severity `image-size` advisories in the React Native/Metro toolchain; no patched version is currently available).
- [x] Threat model review (architecture, security policy and Phase 08 decisions reviewed).
- [x] Secret scan (no high-confidence tracked secrets; `.env.example` contains placeholders only).
- [x] Rate limiting (pairing, authentication failures and authenticated action requests; bounded in-memory windows).
- [x] Replay protection (one-time, short-lived confirmation challenges; replay test passes).
- [x] Device revocation UX: Android can forget its local session and rotate its own server token with biometric step-up and a one-time R2 challenge.
- [x] Audit log rotation (MCP JSONL audit is capped at 1 MiB with one restrictive-permission rotated file).
- [ ] SELinux compatibility review.
- [ ] firewalld verification.
- [x] systemd hardening directives (no new privileges, private temp, read-only system/home with narrow write exceptions; services verified healthy).
- [ ] backup/recovery test.
- [ ] lost-phone drill.
- [ ] reboot/reconnect test.
- [ ] versioned release notes.

## Exit criteria
System can survive reboot, phone loss, token rotation and service failure without exposing the machine.
