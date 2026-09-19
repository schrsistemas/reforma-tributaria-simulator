# ADR-001 — Money and versioned rules

## Decision

The domain represents monetary values as decimal strings and performs exact arithmetic using integer cents in the initial engine.

Tax rules are externalized and versioned with validity dates, source and version.

## Reason

Tax calculations require deterministic reproduction. Floating-point arithmetic and implicit current rules create audit and regression risks.
