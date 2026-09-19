# Split Payment Ledger

The ledger is append-only at event level.

## Aggregate

PaymentSettlement links a financial transaction to a fiscal operation and contains the allocation snapshot generated from a specific tax calculation version.

## Events

- PAYMENT_CREATED
- PAYMENT_LINKED
- ALLOCATION_CREATED
- ALLOCATION_SETTLED
- SUPPLIER_SETTLED
- ALLOCATION_REVERSED
- RECONCILIATION_PASSED
- RECONCILIATION_FAILED

## Invariants

- A settlement cannot be applied twice for the same idempotency key.
- Reversal references the original allocation.
- A calculation snapshot cannot be mutated after allocation.
- Every event has a correlation ID.
