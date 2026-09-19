# Runtime

The public edge API is intentionally thin.

Business calculation belongs to the tax engine. Durable state transitions belong to Workflows. Financial events are asynchronous and idempotent.

Request path:

Client -> Worker -> application service -> domain/tax-engine.

Financial path:

Payment event -> Queue -> Workflow -> allocation ledger -> reconciliation.

The worker must not contain tax formulas.
