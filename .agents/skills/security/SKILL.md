---
name: devicebridge-security
description: Threat-model DeviceBridge changes and verify authorization, secrets, remote exposure and audit behavior.
---
# Checklist
- Is input schema validated?
- Is capability checked server-side?
- Is action replayable?
- Is there any shell string construction?
- Could logs expose secrets?
- Does this add a public listener?
- Does it weaken Codex approvals/sandbox?
- Does it affect unlock or privilege boundaries?
