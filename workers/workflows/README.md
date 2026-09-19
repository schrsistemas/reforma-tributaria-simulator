# Cloudflare Workflows

Planned workflows:

1. `simulate-operation` — calculate and persist an immutable simulation snapshot.
2. `split-payment` — link payment, calculate allocations, settle and reconcile.
3. `reconcile-payment` — compare expected ledger allocation with settlement events.

All workflows must be idempotent and safe to resume.
