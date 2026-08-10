# Security Test Matrix

| Test | Expected |
|---|---|
| `/v1/device` without token | 401 |
| unknown action ID | 404 |
| disabled action | 403 |
| action payload with raw shell key | ignored/rejected by schema/adapter; never executed |
| Bridge bound to public interface by default | must fail review |
| real `.env` committed | must fail release |
| unlock enabled without step-up design | must fail review |
| Codex approval bypass added | must fail review |
| lost phone credential revoked | subsequent request denied |
