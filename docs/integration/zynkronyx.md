# Zynkronyx integration

Zynkronyx is the control plane. The Reforma Tributária Simulator is the fiscal domain engine.

## Boundary

Zynkronyx owns:
- identity and tenant context
- navigation/control center
- workflow orchestration
- operational monitoring
- user-facing commands

Fiscal Simulator owns:
- tax rule catalog
- fiscal classification
- IBS/CBS calculations
- credits
- transition scenarios
- split-payment calculation
- immutable fiscal calculation snapshots

## API contract

Zynkronyx calls the fiscal API using versioned commands.

POST /api/v1/simulations
POST /api/v1/simulations/{id}/split-payment
GET /api/v1/simulations/{id}

Required request metadata:
- X-Correlation-Id
- Idempotency-Key
- X-Zynkronyx-Tenant

The fiscal service never trusts tax rates supplied by the caller when a published RuleSet is requested. Rule resolution happens inside the fiscal boundary.

## Event contract

Fiscal events can be published back to Zynkronyx:

FISCAL_SIMULATION_COMPLETED
FISCAL_RULESET_PUBLISHED
FISCAL_SPLIT_PAYMENT_CREATED
FISCAL_RECONCILIATION_FAILED

Events are versioned and idempotent.
