# ADR-002 — Split Payment as an independent financial workflow

## Decision

Tax calculation and payment settlement are separate bounded processes.

The tax engine produces an immutable calculation snapshot. A payment workflow consumes that snapshot and creates allocation/settlement events.

## Consequences

- Tax rules can evolve independently from payment adapters.
- Financial retries do not recalculate taxes implicitly.
- Reversals can reference the original allocation.
- Reconciliation becomes observable and testable.
