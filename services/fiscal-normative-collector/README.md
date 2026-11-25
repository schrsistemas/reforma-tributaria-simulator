# Fiscal Normative Source Monitor

This service checks the availability and content hash of configured official source landing pages. The source-page checker does not crawl arbitrary URLs, archive legal documents, extract text, interpret legislation, or publish tax rules.

## Configuration

- DATABASE_URL: PostgreSQL connection string for the non-owner runtime role.
- FISCAL_SOURCE_ALLOWED_HOSTS: comma-separated exact hostnames, e.g. www.gov.br,www.planalto.gov.br,www.nfe.fazenda.gov.br,www.cte.fazenda.gov.br,www.mdfe.fazenda.gov.br,www.confaz.fazenda.gov.br,gnre.pe.gov.br.

The allowlist must contain the exact hostnames of the active registry URLs. It is not a suffix allowlist. The GNRE portal currently uses HTTPS on port 444.

Only HTTPS URLs whose hostname exactly matches the allowlist are requested. Redirects are blocked. Requests time out after 10 seconds and response bodies are capped at 3 MiB.

## Run

`pnpm --filter @rts/fiscal-normative-collector check:sources`

Discover candidate links from approved source landing pages with:

`pnpm --filter @rts/fiscal-normative-collector discover:artifacts`

Schedule from an external cron or VPS scheduler after configuring the runtime connection and allowlist. PostgreSQL session advisory lock (key pair 20261125/1) prevents overlapping runs across processes. The lock is held on the same checked-out database connection used for the full run and is released in a finally block.

## Registered source coverage

The registry is seeded through migrations 0004–0009 and now includes:

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

The checker stores two digests: `content_sha256` is the SHA-256 of the exact response bytes, while `normalized_content_sha256` is the versioned comparison fingerprint. For HTML/XHTML, `html-content-v1` excludes script/style/noscript blocks, comments, doctype and selected volatile attributes while preserving text and link targets. For non-HTML content, the normalized digest equals the raw digest. The raw digest is never discarded. A fingerprint algorithm change must use a new version identifier and must not be compared as if it were the previous algorithm.

## NFS-e Via source classes

Migration `0007_nfse_specific_normative_sources.sql` registers independent URLs for the NFS-e Via manuals/annexes, XSD index, official API links, the official notice about Ato Conjunto RFB/CGIBS nº 7/2026, and FAQ v1.5.

The FAQ is explanatory guidance, not a normative act. It must not overwrite a legal deadline or technical layout without review against the underlying act and the applicable official technical documentation.

## Artifact capture library

`src/capture.ts` captures an explicitly supplied official artifact URL. It enforces the exact-host HTTPS allowlist, blocks redirects, limits response size and time, accepts only PDF/HTML/XML/JSON content types, verifies the PDF signature, calculates SHA-256 and writes bytes to an S3-compatible object store. `src/s3-storage.ts` provides the S3-compatible storage adapter. `src/capture-service.ts` records immutable metadata in `fiscal.normative_artifact_captures` and treats an existing source/hash pair as a duplicate.

The source checker and discovery worker find links ending in .pdf, .xsd, .xml or .json from HTML/XHTML pages. It resolves relative URLs, decodes common HTML entities, removes fragments, deduplicates canonical URLs and accepts only HTTPS links whose exact hostname is in the same allowlist. Links with credentials, ports other than the default HTTPS port and GNRE's explicitly allowed port 444, unsupported schemes, IP literals or external hosts are discarded.

Discovered links are inserted into `fiscal.normative_artifact_candidates` with review status `PENDING`; conflicts refresh source-page/link metadata and last-seen time without changing human review decisions. The authenticated API exposes candidates at `GET /v1/normative/sources/:sourceId/candidates` and `GET /v1/normative/artifact-candidates`. OWNER/ADMIN users can approve or reject a candidate through `POST /v1/normative/artifact-candidates/:candidateId/review`; every decision is audited. Candidate discovery makes no requests to the linked documents. It does not download, capture, execute or interpret them. Approval does not trigger capture automatically.


## Approved artifact capture

Capture is a separate worker and processes only candidates in `APPROVED` state. It requires:

- `S3_BUCKET`
- `S3_REGION`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- Optional `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE` for S3-compatible providers such as Cloudflare R2.

Run manually after provisioning the object store and applying migrations:

`pnpm --filter @rts/fiscal-normative-collector capture:approved`

The worker stores the artifact, records SHA-256 metadata, links the capture ID to the candidate and moves it to `CAPTURED`. Failures leave the candidate `APPROVED` for retry and increment `capture_attempts` with the last error code. Duplicate content reuses the existing capture record. A PostgreSQL advisory lock (key pair 20261125/3) prevents overlapping capture runs.


Capture configuration is separate from discovery. The approved-candidate worker requires `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`; `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE` are optional. `FISCAL_CAPTURE_BATCH_SIZE` defaults to 25 and is capped at 200. The worker is not scheduled automatically and must not be run until PostgreSQL migrations and the S3-compatible bucket are provisioned.
