# Command Registry

## Principle
Remote clients choose an **action ID**, never an executable.

## Initial catalog

| Action | Risk | Capability | Default |
|---|---:|---|---|
| `system.status` | R0 | `system:read` | enabled |
| `system.lock` | R2 | `system:lock` | enabled after local test |
| `system.suspend` | R2 | `system:suspend` | disabled until tested |
| `system.shutdown` | R3 | `system:shutdown` | disabled |
| `gaming.sunshine.status` | R0 | `gaming:read` | planned |
| `gaming.sunshine.start` | R1 | `gaming:start` | planned |
| `android.adb.status` | R0 | `android:read` | planned |
| `codex.status` | R0 | `codex:read` | planned |
| `codex.approval.respond` | R3 | `codex:approve` | planned |
| `system.unlock` | R3 | `system:unlock` | **disabled by default** |

## Forbidden actions

```text
shell.exec
sudo.exec
bash.run
powershell.run
command.raw
filesystem.deleteArbitrary
```

If a feature seems to require one of these, create a narrower action instead.
