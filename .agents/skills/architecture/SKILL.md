---
name: devicebridge-architecture
description: Apply DeviceBridge architecture boundaries and ADR discipline.
---
# Workflow
1. Read `docs/ARCHITECTURE.md` and `docs/SECURITY.md`.
2. Identify trust boundary crossed by the requested change.
3. Prefer typed application service + adapter over route-level OS calls.
4. Reject arbitrary shell as an architectural primitive.
5. Record meaningful architecture choices in `docs/DECISIONS.md`.
