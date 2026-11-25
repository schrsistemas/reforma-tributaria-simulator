import type { ArtifactStorage } from "./capture.js";
import type { ArtifactCaptureQuery } from "./capture-service.js";

export interface ReconciliationSummary {
  examined: number;
  finalized: number;
  retryable: number;
  skipped: number;
  failed: number;
}

interface PendingCapture {
  id: string;
  source_id: string;
  source_url: string;
  content_sha256: string;
  storage_key: string;
  capture_started_at: string;
}

export interface InspectableArtifactStorage extends ArtifactStorage {
  headObject(key: string): Promise<Record<string, string> | null>;
}

function isExpectedObjectMetadata(
  metadata: Record<string, string>,
  capture: PendingCapture
): boolean {
  const normalized = Object.fromEntries(
    Object.entries(metadata).map(([key, value]) => [key.toLowerCase(), value])
  );
  return normalized.sha256 === capture.content_sha256 &&
    normalized.sourceid === capture.source_id;
}

/**
 * Reconciles stale PENDING metadata after interrupted uploads.
 *
 * Existing objects are finalized and linked to the approved candidate in a
 * database transaction. Missing objects become ERROR and the candidate is
 * made retryable. Unexpected storage errors leave the row untouched.
 */
export async function reconcilePendingCaptures(
  db: ArtifactCaptureQuery,
  storage: InspectableArtifactStorage,
  options: { staleMinutes?: number; batchSize?: number } = {}
): Promise<ReconciliationSummary> {
  const staleMinutes = options.staleMinutes ?? 15;
  const batchSize = options.batchSize ?? 100;
  if (!Number.isInteger(staleMinutes) || staleMinutes < 1 || staleMinutes > 1440) {
    throw new Error("INVALID_RECONCILIATION_STALE_MINUTES");
  }
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new Error("INVALID_RECONCILIATION_BATCH_SIZE");
  }

  const pending = await db.query<PendingCapture>(
    `SELECT id, source_id, source_url, content_sha256, storage_key, capture_started_at
       FROM fiscal.normative_artifact_captures
      WHERE capture_status = 'PENDING'
        AND capture_started_at <= now() - make_interval(mins => $1)
      ORDER BY capture_started_at ASC
      LIMIT $2`,
    [staleMinutes, batchSize]
  );

  const summary: ReconciliationSummary = {
    examined: pending.rows.length,
    finalized: 0,
    retryable: 0,
    skipped: 0,
    failed: 0
  };

  for (const capture of pending.rows) {
    let metadata: Record<string, string> | null;
    try {
      metadata = await storage.headObject(capture.storage_key);
    } catch {
      summary.failed += 1;
      continue;
    }

    if (metadata && !isExpectedObjectMetadata(metadata, capture)) {
      summary.failed += 1;
      continue;
    }

    try {
      await db.query("BEGIN");
      if (metadata) {
        const finalized = await db.query<{ id: string }>(
          `UPDATE fiscal.normative_artifact_captures
              SET capture_status = 'CAPTURED',
                  captured_at = now(),
                  capture_error_code = NULL
            WHERE id = $1 AND capture_status = 'PENDING'
            RETURNING id`,
          [capture.id]
        );
        if ((finalized.rowCount ?? 0) === 0) {
          await db.query("ROLLBACK");
          summary.skipped += 1;
          continue;
        }

        await db.query(
          `UPDATE fiscal.normative_artifact_candidates
              SET review_status = 'CAPTURED',
                  capture_id = $2,
                  capture_attempts = capture_attempts + 1,
                  last_capture_attempt_at = now(),
                  last_capture_error = NULL,
                  next_capture_attempt_at = NULL
            WHERE source_id = $1
              AND artifact_url = $3
              AND review_status = 'APPROVED'
              AND capture_id IS NULL`,
          [capture.source_id, capture.id, capture.source_url]
        );
        await db.query("COMMIT");
        summary.finalized += 1;
      } else {
        const failed = await db.query<{ id: string }>(
          `UPDATE fiscal.normative_artifact_captures
              SET capture_status = 'ERROR',
                  capture_error_code = 'OBJECT_NOT_FOUND'
            WHERE id = $1 AND capture_status = 'PENDING'
            RETURNING id`,
          [capture.id]
        );
        if ((failed.rowCount ?? 0) === 0) {
          await db.query("ROLLBACK");
          summary.skipped += 1;
          continue;
        }

        await db.query(
          `UPDATE fiscal.normative_artifact_candidates
              SET capture_attempts = capture_attempts + 1,
                  last_capture_attempt_at = now(),
                  last_capture_error = 'OBJECT_NOT_FOUND',
                  next_capture_attempt_at = now() + make_interval(
                    secs => LEAST(86400, (60 * power(2, LEAST(capture_attempts, 10)))::integer)
                  )
            WHERE source_id = $1
              AND artifact_url = $2
              AND review_status = 'APPROVED'
              AND capture_id IS NULL`,
          [capture.source_id, capture.source_url]
        );
        await db.query("COMMIT");
        summary.retryable += 1;
      }
    } catch {
      try {
        await db.query("ROLLBACK");
      } catch {
        // Preserve the original transaction failure in the summary.
      }
      summary.failed += 1;
    }
  }

  return summary;
}
