# Split Payment

The simulator models payment segregation as a financial process, not as a tax-rate shortcut.

Core concepts:

- payment transaction
- fiscal operation
- tax calculation snapshot
- allocation/split instruction
- settlement event
- reversal/refund
- reconciliation
- idempotency

Every event carries correlationId, idempotencyKey, eventType and schemaVersion.
