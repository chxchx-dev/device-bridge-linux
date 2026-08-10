---
name: devicebridge-release
description: Prepare a DeviceBridge release with tests, rollback, recovery and security checks.
---
# Workflow
1. Run typecheck/lint/tests.
2. Run shell syntax checks.
3. Review changed actions and risk classes.
4. Verify `.env` and secrets are untracked.
5. Test upgrade/restart/reconnect.
6. Update STATE and release notes.
