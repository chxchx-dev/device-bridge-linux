---
name: devicebridge-fedora
description: Implement Fedora integrations conservatively using systemd, fixed adapters and least privilege.
---
# Rules
- Prefer user-session services.
- Do not disable SELinux or firewalld.
- OS actions must be fixed allowlisted invocations.
- Detect capabilities before assuming WOL, GPU encoding or desktop unlock behavior.
- Provide a rollback command for service/config changes.
