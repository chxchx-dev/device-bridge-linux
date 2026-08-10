# Security Model

## Assets
- Fedora user session.
- Source code and repositories.
- SSH/Git credentials.
- Codex session/authentication.
- Personal files.
- Android device identity.
- Tailscale identity.

## Main threats
1. Lost or stolen phone.
2. Compromised mobile app token.
3. Malicious LAN client.
4. Command injection.
5. CSRF/replay against a state-changing action.
6. Codex command exceeding expected scope.
7. Accidentally public Bridge/Sunshine port.
8. Privilege escalation through system helpers.
9. Unsafe remote unlock.

## Controls

### Network
- Bind Bridge API to `127.0.0.1` by default.
- Remote exposure only through tailnet.
- Never use Tailscale Funnel for DeviceBridge production access.
- Keep Sunshine management UI off the public Internet.

### Authentication
MVP: high-entropy per-device bearer token stored in Android secure storage.

Professional target:
- Ed25519 device keypair;
- short-lived challenge;
- signed requests/session token;
- token rotation/revocation;
- biometric step-up for R3 actions.

### Authorization
Capabilities are explicit. Example:

```text
system:read
system:lock
system:suspend
gaming:start
codex:read
codex:approve
files:read
```

No wildcard capability in production.

### Process execution
- Use `execFile`/spawn with fixed executable and fixed argument templates.
- Never concatenate request input into a shell string.
- No `/shell`, `/exec`, `/terminal/run` endpoint.

### Codex
- Keep Codex sandbox/approvals active.
- Surface approval requests to Android instead of bypassing them.
- MCP tools should be narrow and typed.

### Remote unlock
Unlock is **not equivalent to remote access**.

Default policy:
- wake/online status: allowed according to capability;
- lock: R2;
- unlock: disabled;
- OS password storage/replay: forbidden;
- auto-login: forbidden.

An experimental unlock adapter may be enabled only after local testing, with device-bound crypto, biometric step-up, short challenge expiry and an audit event. If the desktop environment cannot perform a supported authenticated unlock, DeviceBridge must not fake it.

## Lost phone response
See `runbooks/LOST_PHONE.md`.
