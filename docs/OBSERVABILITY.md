# Observability

## Audit events
Every state-changing action records:
- timestamp;
- request ID;
- paired device ID;
- action ID;
- risk class;
- authorization result;
- execution status;
- duration;
- sanitized failure code.

Never record passwords, bearer tokens, Codex auth material or full sensitive stdout.

## Operational metrics
- bridge uptime;
- WebSocket connected clients;
- action latency/error counts;
- adapter health;
- tailnet reachability indicators;
- Codex gateway state.

## Logs
Use structured JSON in production. Separate security audit events from verbose development logs.
