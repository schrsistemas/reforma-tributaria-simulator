# Fiscal Normative Source Monitor

This service checks the availability and content hash of configured official source landing pages. It does not crawl arbitrary URLs, download or archive legal documents, extract text, interpret legislation, or publish tax rules.

## Configuration

- DATABASE_URL: PostgreSQL connection string for the non-owner runtime role.
- FISCAL_SOURCE_ALLOWED_HOSTS: comma-separated exact hostnames, e.g. www.gov.br,www.planalto.gov.br,www.nfe.fazenda.gov.br,www.confaz.fazenda.gov.br.

Only HTTPS URLs whose hostname exactly matches the allowlist are requested. Redirects are blocked. Requests time out after 10 seconds and response bodies are capped at 3 MiB.

## Run

pnpm --filter @rts/fiscal-normative-collector check:sources

Schedule from an external cron or VPS scheduler only after configuring the runtime connection and allowlist. Do not run multiple concurrent checks against the same source.

## Status

- AVAILABLE: successful fetch and content hash equal to the previous successful hash, or no previous hash exists.
- CHANGED: successful fetch with a different content hash.
- UNAVAILABLE: HTTP response is not successful.
- REJECTED: source URL, redirect, content type or response size rejected.
- ERROR: network or timeout failure.

A CHANGED status indicates that the portal response changed; it does not prove that a new normative act was published. Every alert requires human review and document-level verification.
