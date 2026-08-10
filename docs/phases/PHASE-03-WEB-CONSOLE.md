# Phase 03 — Web Console / PWA

## Objective
Get a useful control surface on the phone before native Android complexity.

## Tasks
- [x] Create React + Vite console.
- [x] Pair/login screen.
- [x] Fedora status dashboard.
- [x] Actions screen.
- [x] Confirmation modal for R2/R3.
- [x] WebSocket reconnect/backoff.
- [x] Offline/error states.
- [x] Installable PWA shell.
- [ ] Tailnet-only deployment.

## Exit criteria
From Android browser over mobile data, user can securely see Fedora state and execute a tested non-destructive action.

## Verification

- `pnpm --filter @devicebridge/web-console run typecheck` — passed.
- `pnpm --filter @devicebridge/web-console run build` — passed.

The console keeps the device token in JavaScript memory only. Tailnet deployment and the Android mobile-data acceptance test remain pending.
