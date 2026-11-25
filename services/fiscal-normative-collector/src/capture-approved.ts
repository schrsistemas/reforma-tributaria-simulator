import type { ArtifactStorage } from "./capture.js";
import { captureAndRecordArtifact, type ArtifactCaptureQuery } from "./capture-service.js";

export interface ApprovedArtifactCandidate {
  id: string;
  source_id: string;
  artifact_url: string;
}

export interface ApprovedCaptureSummary {
  selected: number;
  captured: number;
  duplicates: number;
  failed: number;
}

export interface ApprovedCaptureOptions {
  allowedHosts: ReadonlySet<string>;
  storage: ArtifactStorage;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  batchSize?: number;
}

/**
 * Captures only explicitly approved candidates. A failure leaves the candidate
 * APPROVED for retry and records attempt metadata; success links immutable
 * capture metadata and moves the candidate to CAPTURED.
 */
export async function captureApprovedArtifacts(
  db: ArtifactCaptureQuery,
  options: ApprovedCaptureOptions
): Promise<ApprovedCaptureSummary> {
  const batchSize = options.batchSize ?? 25;
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 200) {
    throw new Error("INVALID_CAPTURE_BATCH_SIZE");
  }

  const pending = await db.query<ApprovedArtifactCandidate>(
    `SELECT id, source_id, artifact_url
       FROM fiscal.normative_artifact_candidates
      WHERE review_status = 'APPROVED' AND capture_id IS NULL
      ORDER BY reviewed_at ASC NULLS LAST, first_discovered_at ASC
      LIMIT $1`,
    [batchSize]
  );

  const summary: ApprovedCaptureSummary = {
    selected: pending.rows.length,
    captured: 0,
    duplicates: 0,
    failed: 0
  };

  for (const candidate of pending.rows) {
    const result = await captureAndRecordArtifact(db, candidate.source_id, candidate.artifact_url, {
      allowedHosts: options.allowedHosts,
      storage: options.storage,
      fetcher: options.fetcher,
      timeoutMs: options.timeoutMs,
      maxBytes: options.maxBytes
    });

    if ((result.status === "CAPTURED" || result.status === "DUPLICATE") && result.captureId) {
      const updated = await db.query(
        `UPDATE fiscal.normative_artifact_candidates
            SET review_status = 'CAPTURED', capture_id = $2,
                last_capture_attempt_at = now(), last_capture_error = NULL
          WHERE id = $1 AND review_status = 'APPROVED' AND capture_id IS NULL`,
        [candidate.id, result.captureId]
      );
      if ((updated.rowCount ?? 0) > 0) {
        if (result.status === "DUPLICATE") summary.duplicates += 1;
        else summary.captured += 1;
      } else {
        summary.failed += 1;
      }
      continue;
    }

    const errorCode = result.errorCode ?? "CAPTURE_METADATA_MISSING";
    await db.query(
      `UPDATE fiscal.normative_artifact_candidates
          SET capture_attempts = capture_attempts + 1,
              last_capture_attempt_at = now(), last_capture_error = $2
        WHERE id = $1 AND review_status = 'APPROVED' AND capture_id IS NULL`,
      [candidate.id, errorCode]
    );
    summary.failed += 1;
  }

  return summary;
}
