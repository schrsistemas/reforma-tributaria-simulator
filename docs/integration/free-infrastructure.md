# Zero-Cost Integration Infrastructure

The architecture must remain functional without mandatory paid infrastructure.

## Primary free stack

- GitHub — source control and CI.
- Cloudflare Workers — HTTP/API execution within free limits.
- Cloudflare D1 — transactional catalog/state within free limits.
- Cloudflare R2 — evidence/document storage within free limits.
- Cloudflare Workflows — durable jobs within free limits.
- Cloudflare Queues — asynchronous processing within free limits where available.
- GitHub Actions — scheduled maintenance and CI where appropriate.

## Local development

Every important integration component should have a local equivalent.

Examples:

- D1 → local SQLite-compatible test database.
- R2 → local filesystem/object-store test double.
- Queue → in-memory or SQLite-backed test queue.
- Workflow → deterministic local runner.
- HTTP → local Worker runtime.

## No paid service in the domain core

The following must not be required by the fiscal domain:

- paid database;
- paid message broker;
- paid LLM;
- paid observability platform;
- paid object storage;
- paid API gateway.

Optional external services can be adapters.

## Free-tier safety

Production configuration should expose limits and health metrics for:

- requests;
- database reads/writes;
- object storage;
- queue operations;
- workflow steps;
- execution duration.

When a free-tier threshold approaches exhaustion, the system should degrade safely or pause non-critical work rather than unexpectedly generate a bill.

## Priority order under resource pressure

1. Preserve historical fiscal evidence.
2. Preserve immutable fiscal snapshots.
3. Preserve production calculation capability.
4. Preserve integration retries.
5. Continue critical source monitoring.
6. Delay non-critical analysis.
7. Delay exploratory AI processing.

## AI

AI is optional.

The Fiscal Knowledge Loop must be able to:

- collect;
- hash;
- compare;
- version;
- validate;
- publish deterministic rules

without an LLM.

An LLM can improve classification or explanation but cannot be a single point of failure for fiscal correctness.

## Vendor portability

Provider-specific services must be behind interfaces.

Example:

`EvidenceStore`

Implementations may include:

- Cloudflare R2;
- local filesystem;
- S3-compatible object storage.

The same principle applies to queues, schedulers and databases.

## Financial safety

No credential, account token, API key or billing credential belongs in:

- source code;
- Git history;
- frontend environment variables;
- README;
- migration files.

Secrets must remain deployment secrets or local environment variables.
