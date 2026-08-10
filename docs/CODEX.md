# Codex Integration

## Goal
Use Fedora as the execution host while Android becomes a safe Codex cockpit.

## Codex Remote vs DeviceBridge
As of 2026-08-09, OpenAI documents Codex Remote in the ChatGPT mobile app for a connected **Mac or Windows PC**. Fedora/Linux is not listed as a connected-host target on that page. Therefore DeviceBridge keeps a custom Fedora-side Codex Gateway in the roadmap instead of assuming official Remote can control this Fedora laptop. Re-check this before Phase 06 because product support can change.


## Layers

### A. Codex CLI
Useful for local interactive work and `codex exec` workflows.

### B. Codex SDK
Use server-side to create/resume coding threads from the gateway.

### C. Codex App Server
Use when the mobile/web client needs richer thread state and approval requests. Approval requests can be forwarded to the phone instead of being auto-accepted.

### D. DeviceBridge MCP
Use MCP to expose narrow device capabilities to Codex:

```text
device_status
list_projects
start_dev_mode
stop_dev_mode
sunshine_status
start_game_mode
android_adb_status
```

## Approval UX

```text
Codex requests operation
        ↓
Codex Gateway classifies/display metadata
        ↓
Android receives pending approval
        ↓
User sees reason + cwd + command summary + risk
        ↓
Approve / Deny
        ↓
Gateway responds to Codex App Server
```

Do not implement an "always approve everything" mobile toggle.

## Project configuration
`.codex/config.toml` contains conservative project settings. User-level secrets/auth remain under the user's Codex home.

## AGENTS + Skills
- `AGENTS.md`: short permanent repository rules.
- `.agents/skills/*/SKILL.md`: specialized repeatable workflows.
- Use phase docs as execution plans, not as permanent global context.
