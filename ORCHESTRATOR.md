# DeviceBridge Orchestrator

## Purpose
This file is the deterministic execution contract for humans and coding agents.

## Loop

```text
READ STATE
   ↓
IDENTIFY ACTIVE PHASE
   ↓
CHECK PREREQUISITES
   ↓
CREATE SMALL EXEC PLAN
   ↓
IMPLEMENT ONE COHERENT SLICE
   ↓
TEST + SECURITY CHECK
   ↓
UPDATE STATE + DECISION LOG
   ↓
STOP OR CONTINUE WITHIN SAME PHASE
```

## Rules

1. Read `STATE.md` before any modification.
2. Work on only the phase named in `current_phase`.
3. Treat each checkbox in the phase document as a deliverable with evidence.
4. Make a Git checkpoint before risky changes.
5. Never solve a failing test by weakening authentication, authorization, sandboxing or validation.
6. Keep secrets outside the repository.
7. Any new action must include:
   - action ID;
   - risk class;
   - required capability;
   - input schema;
   - implementation adapter;
   - audit behavior;
   - test.
8. Any new remote-facing service must document:
   - bind address;
   - authentication;
   - transport;
   - exposure through Tailscale;
   - firewall expectations.
9. Any new privileged behavior requires an ADR in `docs/DECISIONS.md` before implementation.
10. A phase advances only when every exit criterion is met.

## Risk classes

| Class | Meaning | Examples | UX |
|---|---|---|---|
| R0 | Read-only | CPU, RAM, service status | no confirmation |
| R1 | Reversible user action | launch app, start dev mode | normal action |
| R2 | Session-affecting | lock, stop service, suspend | confirm |
| R3 | Security-sensitive/destructive | shutdown, unlock, firewall, package changes | step-up auth + confirm |
| R4 | Forbidden remote primitive | arbitrary shell, password replay | never expose |

## Phase completion protocol

When a phase is complete:

1. Run required tests.
2. Record evidence in `STATE.md`.
3. Record architectural changes in `docs/DECISIONS.md`.
4. Set `current_phase` to the next phase.
5. Commit with `phase(N): <summary>`.

## Agent stop conditions
Stop and leave a blocker in `STATE.md` when:

- hardware capability is required but not verified;
- a task would require weakening OS security;
- a dependency's current behavior is unknown and must be verified;
- a root helper would be required without an approved ADR;
- a secret is missing.
