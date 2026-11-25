# Fiscal Normative Source Monitor

Runtime: Node.js 22.x. Workspace package manager: pnpm 10.34.9 via Corepack; Vercel builds require `ENABLE_EXPERIMENTAL_COREPACK=1` to honor the root `packageManager` declaration.

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

`src/capture.ts` downloads and validates an explicitly supplied official artifact URL. It enforces the exact-host HTTPS allowlist, blocks redirects, limits response size and time, accepts only PDF/HTML/XML/JSON content types, verifies the PDF signature and calculates SHA-256. `src/capture-service.ts` first persists a durable PENDING metadata row, then uploads bytes to the deterministic S3 object key, and only after successful upload marks the row CAPTURED. Upload failures transition the row to ERROR; retries reuse the same source/hash row and object key. `src/s3-storage.ts` provides the S3-compatible storage adapter.

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

The worker stores the artifact through a durable PENDING → CAPTURED/ERROR lifecycle, links the capture ID to the candidate only after upload confirmation and moves the candidate to `CAPTURED`. Failures leave the candidate `APPROVED` for retry and increment `capture_attempts` with the last error code. Migration 0012 schedules the next eligible attempt with exponential backoff from 1 minute up to 24 hours; successful capture clears the retry deadline. Duplicate content reuses the existing capture record. A PostgreSQL advisory lock (key pair 20261125/3) prevents overlapping capture runs.


Capture configuration is separate from discovery. The approved-candidate worker requires `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`; `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE` are optional. `FISCAL_CAPTURE_BATCH_SIZE` defaults to 25 and is capped at 200. The worker is not scheduled automatically and must not be run until PostgreSQL migrations and the S3-compatible bucket are provisioned.

## Interrupted capture reconciliation

The approved-capture runner first reconciles stale PENDING metadata rows, then processes new eligible APPROVED candidates. Migration 0015 adds capture_started_at. The default stale threshold is 15 minutes and can be changed with FISCAL_CAPTURE_RECONCILE_STALE_MINUTES (integer 1–1440). The reconciliation batch is four times FISCAL_CAPTURE_BATCH_SIZE, capped at 500.

S3ArtifactStorage uses HeadObject to verify whether the deterministic object key exists and checks its sha256/sourceId metadata before finalizing a capture. If the object exists and metadata matches, the capture row and matching approved candidate are finalized in one PostgreSQL transaction. If the object is absent, the capture becomes ERROR and the candidate is scheduled for retry using the existing exponential backoff. Provider/network errors and metadata mismatches are reported without changing the row. Reconciliation never deletes objects and does not attempt to enumerate arbitrary bucket keys.

Run the same command to execute reconciliation and capture: `pnpm --filter @rts/fiscal-normative-collector capture:approved`. 


## Worker execution history

The source monitor, artifact discovery and approved-artifact capture runners record each locked execution in `fiscal.normative_collector_runs`. The ledger stores RUNNING/SUCCEEDED/FAILED, start/finish timestamps, generated duration in milliseconds, the worker's JSON summary counters and a stable failure code. A process terminated before finalization leaves a RUNNING row, which is intentionally visible as an abandoned/incomplete execution rather than being marked successful. Failure details are not copied into the ledger.

The authenticated API exposes the latest records at `GET /v1/normative/collector-runs`; access is limited to OWNER/ADMIN users in the configured `NORMATIVE_REVIEW_TENANT_ID`. Apply migration 0016 before deploying the instrumented workers or calling the endpoint. The ledger is not a scheduler: workers still require an external cron/VPS scheduler, and no automatic schedule is provisioned by this change.
