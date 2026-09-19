# Integration Ownership and Routing

Este documento define quem é responsável por cada tipo de informação e como mensagens atravessam a plataforma.

## Ownership

### Zynkronyx owns

- external connector configuration;
- credentials and connection lifecycle;
- endpoint/webhook integration;
- transport retry policy;
- integration health;
- external system mapping;
- tenant integration context;
- operational orchestration;
- delivery monitoring;
- cross-system correlation.

### Fiscal Domain owns

- fiscal operation semantics;
- tax rules;
- RuleSets;
- fiscal classifications;
- tax calculation;
- fiscal document validation rules;
- transition rules;
- credits/reductions;
- Split Payment fiscal allocation;
- fiscal snapshots;
- fiscal evidence and source lineage.

### External systems own

- their own source-of-truth operational data;
- their authentication protocol;
- their domain-specific identifiers;
- their business state.

The Zynkronyx does not become the source of truth merely because it transports the data.

## Routing decision

When a message enters Zynkronyx, routing should answer:

1. Which connector produced it?
2. Which tenant owns it?
3. Which domain owns its meaning?
4. Is it a command, event or query?
5. Is delivery synchronous or asynchronous?
6. What idempotency boundary applies?
7. What correlation ID must be preserved?

## Example: Marketplace order

`MARKETPLACE → ZYNKRONYX → ERP`

The marketplace remains the source of the order.

If fiscal calculation is required:

`MARKETPLACE → ZYNKRONYX → FISCAL_CALCULATE → FISCAL DOMAIN`

The fiscal result returns as:

`FISCAL_SIMULATION_COMPLETED → ZYNKRONYX → ERP`

## Example: Fiscal rule change

The direction is reversed:

`OFFICIAL SOURCE → FISCAL KNOWLEDGE LOOP → RULESET PUBLISHED`

Then:

`FISCAL_RULESET_PUBLISHED → ZYNKRONYX`

Zynkronyx can determine which connected tenants, integrations or workflows may need attention.

The Zynkronyx does not decide the legal meaning of the new rule.

## Example: External operational event

`GRANJA → ZYNKRONYX → ERP`

If the event requires fiscal treatment:

`ZYNKRONYX → FISCAL DOMAIN`

The fiscal domain returns the fiscal result/event.

Zynkronyx continues the integration workflow.

## Synchronous boundary

Use synchronous calls when the caller cannot continue without the fiscal answer.

Example:

`POST /api/v1/simulations → fiscal result`

## Asynchronous boundary

Use events/workflows when the operation can continue independently.

Examples:

- source collection;
- fiscal document processing;
- rule regression;
- RuleSet publication;
- Split Payment settlement;
- reconciliation;
- external synchronization.

## No universal bus requirement

The architecture must not require Kafka, RabbitMQ, a paid broker or another always-on infrastructure.

The first implementation can use:

- Cloudflare Queues when available within free limits;
- Cloudflare Workflows for durable execution;
- HTTP for synchronous commands;
- GitHub Actions for development/maintenance automation;
- local filesystem/SQLite-compatible test doubles during development.

The domain contracts remain independent of these transports.

## Failure boundary

A transport failure is not automatically a domain failure.

For example:

`FISCAL_SIMULATION_COMPLETED`

may already be persisted by the Fiscal Domain even if delivery to Zynkronyx fails.

The event must be retryable/replayable.

Likewise, Zynkronyx must not acknowledge an external event as processed until its required durable state has been recorded.

## Replay

Events should be replayable without recalculating historical fiscal results unless explicitly requested.

Historical fiscal snapshots are immutable.

A replay of an integration event must consume the existing snapshot rather than silently calculating against today's RuleSet.

## Architectural invariant

No component should need to know every other component.

Integration is performed through stable contracts, not direct knowledge of internal implementation.
