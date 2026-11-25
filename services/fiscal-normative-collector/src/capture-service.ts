import { captureOfficialArtifact, type ArtifactCaptureOptions, type ArtifactCaptureResult } from "./capture.js";

export interface ArtifactCaptureQuery {
  query<T = unknown>(
    sql: string,
    values?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

export async function captureAndRecordArtifact(
  db: ArtifactCaptureQuery,
  sourceId: string,
  sourceUrl: string,
  options: ArtifactCaptureOptions
): Promise<ArtifactCaptureResult> {
  const captured = await captureOfficialArtifact(sourceId, sourceUrl, options);
  if (captured.status !== "CAPTURED" || !captured.sha256 || !captured.objectKey ||
      !captured.contentType || captured.byteLength === null) {
    return captured;
  }

  const inserted = await db.query<{ id: string }>(
    `INSERT INTO fiscal.normative_artifact_captures
       (source_id, source_url, content_type, byte_length, content_sha256, storage_key, capture_status)
     VALUES ($1,$2,$3,$4,$5,$6,'CAPTURED')
     ON CONFLICT (source_id, content_sha256) DO NOTHING
     RETURNING id`,
    [sourceId, sourceUrl, captured.contentType, captured.byteLength, captured.sha256, captured.objectKey]
  );

  if (inserted.rowCount === 0) return { ...captured, status: "DUPLICATE" };
  return captured;
}
