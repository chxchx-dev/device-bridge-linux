# Development Guide

## Requirements
- Fedora workstation.
- Node.js 20+.
- npm.
- Git.

Recommended device tools:
- `android-tools` (ADB).
- KDE Connect.
- scrcpy from its supported packaging method.
- Tailscale.
- Sunshine.
- Codex CLI.

## Repository workflow

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run dev:bridge
```

## Branching

```text
main
feature/phase-00-foundation
feature/phase-01-connectivity
...
```

## Commit convention

```text
phase(2): add authenticated health API
security: reject raw shell action inputs
docs: document WOL relay requirement
```

## Environment
Copy `.env.example` to `.env`. Generate a random development token; never commit it.

## Logging
Logs must be structured. Never log authorization headers or secret values.
