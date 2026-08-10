# DeviceBridge — Agent Rules

## Mission
Build a secure personal control plane connecting Fedora and Android. Fedora is the compute node; Android is the control node.

## Mandatory reading order
1. `ORCHESTRATOR.md`
2. `STATE.md`
3. `docs/ARCHITECTURE.md`
4. `docs/SECURITY.md`
5. active phase under `docs/phases/`

## Non-negotiable security rules
- Never expose arbitrary shell execution over HTTP/WebSocket/MCP.
- Never run `bridge-api`, `device-agent`, or `codex-gateway` as root.
- Never add a route that accepts a raw command string from a remote client.
- Never store Fedora passwords, sudo passwords, Android lock PINs, API tokens, Tailscale auth keys, or Codex credentials in git.
- Never disable SELinux, firewalld, Codex sandboxing, or approval gates to make development easier.
- Never expose DeviceBridge or Sunshine directly to the public Internet as the default architecture.
- Remote access must use the private tailnet or an equivalently authenticated private overlay.
- Destructive actions require explicit confirmation and an audit record.
- Unlock capability is disabled by default. Do not implement password replay or auto-login.
- Never use Codex dangerous bypass flags in project automation.

## Architecture constraints
- TypeScript strict mode.
- Shared request/response schemas live in `packages/contracts`.
- Executable actions must be declared in `packages/command-registry`.
- System-specific adapters live behind interfaces; route handlers must not spawn arbitrary processes.
- Prefer user-level systemd units. Privileged helpers, if ever required, must be isolated, minimal, audited, and documented with a dedicated threat model.
- SQLite is the initial persistence layer. Do not add PostgreSQL/Redis/RabbitMQ until a measured requirement exists.

## API rules
- Validate every external input with Zod.
- Authentication is deny-by-default.
- Authorization is per action capability.
- Every state-changing action gets a request ID and audit event.
- Never leak process stdout/stderr containing secrets to mobile clients.

## Codex rules
- Codex work happens inside the project workspace.
- Keep project Codex configuration in `.codex/config.toml` where possible.
- Use approvals for commands or file mutations that cross established boundaries.
- Prefer MCP tools for stable DeviceBridge operations instead of shell commands.
- App Server approval requests must surface reason, working directory, command summary and risk class to the user.

## Definition of done
A task is not complete until applicable checks pass:

```bash
npm run typecheck
npm run lint
npm test
```

For infrastructure changes also run:

```bash
bash -n scripts/*.sh
```

Update `STATE.md` only after verification.
