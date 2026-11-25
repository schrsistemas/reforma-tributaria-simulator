# Fiscal Normative Source Monitor

This service checks the availability and content hash of configured official source landing pages. The source-page checker does not crawl arbitrary URLs, archive legal documents, extract text, interpret legislation, or publish tax rules.

## Configuration

- DATABASE_URL: PostgreSQL connection string for the non-owner runtime role.
- FISCAL_SOURCE_ALLOWED_HOSTS: comma-separated exact hostnames, e.g. www.gov.br,www.planalto.gov.br,www.nfe.fazenda.gov.br,www.cte.fazenda.gov.br,www.mdfe.fazenda.gov.br,www.confaz.fazenda.gov.br,gnre.pe.gov.br.

The allowlist must contain the exact hostnames of the active registry URLs. It is not a suffix allowlist. The GNRE portal currently uses HTTPS on port 444.

Only HTTPS URLs whose hostname exactly matches the allowlist are requested. Redirects are blocked. Requests time out after 10 seconds and response bodies are capped at 3 MiB.

## Run

`pnpm --filter @rts/fiscal-normative-collector check:sources`

Schedule from an external cron or VPS scheduler after configuring the runtime connection and allowlist. PostgreSQL session advisory lock (key pair 20261125/1) prevents overlapping runs across processes. The lock is held on the same checked-out database connection used for the full run and is released in a finally block.

## Registered source coverage

The registry is seeded through migrations 0004–0008 and now includes:

- Federal legislation, Receita Federal, Ministério da Fazenda and CONFAZ.
- NF-e and NFC-e national portal.
- CT-e and CT-e OS national portal.
- MDF-e national portal.
- NFS-e Nacional and NFS-e Via technical material, XSD schemas, API directory and official notices.
- SPED's official index of fiscal documents, including BP-e, BP-e TM, NFCom, NF3e, DC-e, GTV-e, NFAg, NFGas and DeRE.
- GNRE national tax-collection portal.
- ANTT CIOT legal/orientation page, technical integration documentation and FAQ.

These sources do not all have the same legal nature. CIOT is a transport-regulatory registration under ANTT, not a DF-e. GNRE is a tax-collection guide, not an invoice. FAQ and explanatory pages are reference material and must not be treated as normative acts.

## Source monitor status

- AVAILABLE: successful fetch and content hash equal to the previous successful hash, or no previous hash exists.
- CHANGED: successful fetch with a different content hash.
- UNAVAILABLE: HTTP response is not successful.
- REJECTED: source URL, redirect, content type or response size rejected.
- ERROR: network or timeout failure.

A CHANGED status indicates that the portal response changed; it does not prove that a new normative act was published. Every alert requires human review and document-level verification.

## NFS-e Via source classes

Migration `0007_nfse_specific_normative_sources.sql` registers independent URLs for the NFS-e Via manuals/annexes, XSD index, official API links, the official notice about Ato Conjunto RFB/CGIBS nº 7/2026, and FAQ v1.5.

The FAQ is explanatory guidance, not a normative act. It must not overwrite a legal deadline or technical layout without review against the underlying act and the applicable official technical documentation.

## Artifact capture library

`src/capture.ts` captures an explicitly supplied official artifact URL. It enforces the exact-host HTTPS allowlist, blocks redirects, limits response size and time, accepts only PDF/HTML/XML/JSON content types, verifies the PDF signature, calculates SHA-256 and writes bytes to an S3-compatible object store. `src/s3-storage.ts` provides the S3-compatible storage adapter. `src/capture-service.ts` records immutable metadata in `fiscal.normative_artifact_captures` and treats an existing source/hash pair as a duplicate.

The capture library is not called automatically by the source-page checker and does not yet discover or queue candidate document links. Discovery policy, object-store provisioning and human approval of candidate documents must be configured before scheduled ingestion. The service does not execute or interpret downloaded content.
