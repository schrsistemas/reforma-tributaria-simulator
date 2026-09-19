# Split Payment API

## Create

POST `/api/v1/split-payments`

Required headers: `X-Correlation-Id`, `X-Zynkronyx-Tenant`, `Idempotency-Key`.

The request carries the payment gross amount and the IBS/CBS amounts from the immutable fiscal result. The API rejects allocations above gross amount and persists the payment, allocations and initial ledger events atomically.

## Read

GET `/api/v1/split-payments/:paymentId`

Reads are tenant-scoped and return the payment, allocations and append-only event history.

Settlement and reversal are intentionally separate transitions; an existing event is never updated in place.
