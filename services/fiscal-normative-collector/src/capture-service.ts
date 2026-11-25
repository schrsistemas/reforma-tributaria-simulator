import { prepareOfficialArtifact, type ArtifactCaptureOptions, type ArtifactCaptureResult } from "./capture.js";

export interface ArtifactCaptureQuery {
  query<T = unknown>(sql: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

interface CaptureRecord {
  id: string;
  capture_status: "PENDING" | "CAPTURED" | "ERROR" | "REJECTED";
  storage_key: string;
}

function errorResult(result: ArtifactCaptureResult, errorCode: string, captureId: string | null = null): ArtifactCaptureResult {
  return { ...result, status: "ERROR", errorCode, captureId };
}

/**
 * Durable lifecycle:
 * 1. Download and validate bytes.
 * 2. Insert/reuse a PENDING metadata row.
 * 3. Upload to the deterministic object key.
 * 4. Mark the row CAPTURED.
 *
 * If the process stops after step 2 or 3, the next run reuses the same row/key.
 */
export async function captureAndRecordArtifact(
  db: ArtifactCaptureQuery,
  sourceId: string,
  sourceUrl: string,
  options: ArtifactCaptureOptions
): Promise<ArtifactCaptureResult> {
  const prepared = await prepareOfficialArtifact(sourceId, sourceUrl, options);
  const captured = prepared.result;
  if (captured.status !== "CAPTURED" || !prepared.body || !captured.sha256 ||
      !captured.objectKey || !captured.contentType || captured.byteLength === null) {
    return captured;
  }

  const values = [sourceId, sourceUrl, captured.contentType, captured.byteLength, captured.sha256, captured.objectKey];
  const inserted = await db.query<CaptureRecord>(
    `INSERT INTO fiscal.normative_artifact_captures
       (source_id, source_url, content_type, byte_length, content_sha256, storage_key, capture_status, captured_at)
     VALUES ($1,$2,$3,$4,$5,$6,'PENDING',NULL)
     ON CONFLICT (source_id, content_sha256) DO NOTHING
     RETURNING id, capture_status, storage_key`,
    values
  );

  let record = inserted.rows[0];
  if (!record) {
    const existing = await db.query<CaptureRecord>(
      `SELECT id, capture_status, storage_key
         FROM fiscal.normative_artifact_captures
        WHERE source_id = $1 AND content_sha256 = $2
        LIMIT 1`,
      [sourceId, captured.sha256]
    );
    record = existing.rows[0];
    if (!record) return errorResult(captured, "CAPTURE_METADATA_MISSING");

    if (record.capture_status === "CAPTURED") {
      return { ...captured, status: "DUPLICATE", captureId: record.id };
    }

    const resumed = await db.query<CaptureRecord>(
      `UPDATE fiscal.normative_artifact_captures
          SET capture_status = 'PENDING', captured_at = NULL, capture_error_code = NULL, capture_started_at = now()
        WHERE id = $1 AND capture_status IN ('PENDING','ERROR')
        RETURNING id, capture_status, storage_key`,
      [record.id]
    );
    if (!resumed.rows[0]) {
      const latest = await db.query<CaptureRecord>(
        `SELECT id, capture_status, storage_key
           FROM fiscal.normative_artifact_captures WHERE id = $1`,
        [record.id]
      );
      if (latest.rows[0]?.capture_status === "CAPTURED") {
        return { ...captured, status: "DUPLICATE", captureId: record.id };
      }
      return errorResult(captured, "CAPTURE_ALREADY_IN_PROGRESS", record.id);
    }
    record = resumed.rows[0];
  }

  try {
    await options.storage.putObject({
      key: record.storage_key,
      body: prepared.body,
      contentType: captured.contentType,
      metadata: { sourceId, sha256: captured.sha256, sourceUrl }
    });
  } catch {
    await db.query(
      `UPDATE fiscal.normative_artifact_captures
          SET capture_status = 'ERROR', capture_error_code = 'STORAGE_UPLOAD_FAILED'
        WHERE id = $1 AND capture_status <> 'CAPTURED'`,
      [record.id]
    );
    return errorResult(captured, "STORAGE_UPLOAD_FAILED", record.id);
  }

  const completed = await db.query<{ id: string }>(
    `UPDATE fiscal.normative_artifact_captures
        SET capture_status = 'CAPTURED', captured_at = now(), capture_error_code = NULL
      WHERE id = $1 AND capture_status <> 'CAPTURED'
      RETURNING id`,
    [record.id]
  );
  if (completed.rows[0]) return { ...captured, captureId: record.id };

  const latest = await db.query<CaptureRecord>(
    `SELECT id, capture_status, storage_key
       FROM fiscal.normative_artifact_captures WHERE id = $1`,
    [record.id]
  );
  if (latest.rows[0]?.capture_status === "CAPTURED") {
    return { ...captured, status: "DUPLICATE", captureId: record.id };
  }
  return errorResult(captured, "CAPTURE_FINALIZATION_FAILED", record.id);
}
