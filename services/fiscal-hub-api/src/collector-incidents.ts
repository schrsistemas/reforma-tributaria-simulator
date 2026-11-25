import type { Pool, QueryResultRow } from "pg";

type IncidentCondition = QueryResultRow & {
  incident_key: string;
  incident_type: string;
  severity: "WARNING" | "CRITICAL";
  summary: string;
  metadata: Record<string, unknown>;
};

export type IncidentEvaluationResult = {
  opened: number;
  updated: number;
  reopened: number;
  resolved: number;
  active: number;
};

/**
 * Evaluates collector health and persists a deduplicated incident snapshot.
 * The advisory transaction lock serializes concurrent evaluator executions.
 */
export async function evaluateCollectorIncidents(
  pool: Pick<Pool, "connect">,
  staleRunMinutes = 30,
  staleCaptureMinutes = 15
): Promise<IncidentEvaluationResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('fiscal.normative_collector_incidents'))");

    const conditions = await client.query<IncidentCondition>(
      `WITH worker_names(worker_name) AS (
         VALUES ('SOURCE_MONITOR'), ('ARTIFACT_DISCOVERY'), ('ARTIFACT_CAPTURE')
       ),
       latest_runs AS (
         SELECT DISTINCT ON (worker_name)
                worker_name, run_status, started_at, failure_code
           FROM fiscal.normative_collector_runs
          ORDER BY worker_name, started_at DESC
       ),
       worker_health AS (
         SELECT names.worker_name,
                COALESCE(latest.run_status, 'NEVER_RUN') AS latest_status,
                latest.started_at,
                latest.failure_code,
                COALESCE((
                  SELECT count(*)::integer
                    FROM fiscal.normative_collector_runs failed
                   WHERE failed.worker_name = names.worker_name
                     AND failed.run_status = 'FAILED'
                     AND failed.started_at > COALESCE((
                       SELECT max(success.started_at)
                         FROM fiscal.normative_collector_runs success
                        WHERE success.worker_name = names.worker_name
                          AND success.run_status = 'SUCCEEDED'
                     ), '-infinity'::timestamptz)
                ), 0) AS consecutive_failures
           FROM worker_names names
           LEFT JOIN latest_runs latest USING (worker_name)
       ),
       capture_health AS (
         SELECT count(*) FILTER (WHERE capture_status = 'ERROR')::integer AS errors,
                count(*) FILTER (
                  WHERE capture_status = 'PENDING'
                    AND capture_started_at < now() - ($2::integer * interval '1 minute')
                )::integer AS stale_pending
           FROM fiscal.normative_artifact_captures
       ),
       integrity_health AS (
         SELECT
           (SELECT count(*)::integer
              FROM fiscal.normative_artifact_candidates candidate
             WHERE candidate.review_status = 'CAPTURED'
               AND NOT EXISTS (
                 SELECT 1 FROM fiscal.normative_artifact_captures capture
                  WHERE capture.id = candidate.capture_id
                    AND capture.capture_status = 'CAPTURED'
               )) AS candidate_mismatch,
           (SELECT count(*)::integer
              FROM fiscal.normative_artifact_captures capture
             WHERE capture.capture_status = 'CAPTURED'
               AND NOT EXISTS (
                 SELECT 1 FROM fiscal.normative_artifact_candidates candidate
                  WHERE candidate.capture_id = capture.id
                    AND candidate.review_status = 'CAPTURED'
               )) AS capture_mismatch
       ),
       conditions AS (
         SELECT 'worker:' || worker_name || ':NEVER_RUN' AS incident_key,
                'WORKER_NEVER_RUN' AS incident_type,
                'WARNING' AS severity,
                'Collector worker has never completed a recorded execution' AS summary,
                jsonb_build_object('worker', worker_name) AS metadata
           FROM worker_health WHERE latest_status = 'NEVER_RUN'
         UNION ALL
         SELECT 'worker:' || worker_name || ':FAILED',
                'WORKER_FAILED', 'CRITICAL',
                'Latest collector worker execution failed',
                jsonb_build_object('worker', worker_name, 'failureCode', failure_code,
                                   'consecutiveFailures', consecutive_failures)
           FROM worker_health WHERE latest_status = 'FAILED'
         UNION ALL
         SELECT 'worker:' || worker_name || ':STALE_RUNNING',
                'WORKER_STALE_RUNNING', 'WARNING',
                'Collector worker execution is still running beyond its threshold',
                jsonb_build_object('worker', worker_name, 'startedAt', started_at)
           FROM worker_health
          WHERE latest_status = 'RUNNING'
            AND started_at < now() - ($1::integer * interval '1 minute')
         UNION ALL
         SELECT 'capture:errors', 'CAPTURE_ERRORS', 'WARNING',
                'One or more normative artifact captures are in ERROR state',
                jsonb_build_object('count', errors)
           FROM capture_health WHERE errors > 0
         UNION ALL
         SELECT 'capture:stale-pending', 'CAPTURE_STALE_PENDING', 'WARNING',
                'One or more normative artifact captures remain PENDING beyond the threshold',
                jsonb_build_object('count', stale_pending)
           FROM capture_health WHERE stale_pending > 0
         UNION ALL
         SELECT 'integrity:candidate-without-capture', 'CAPTURE_METADATA_INTEGRITY',
                'CRITICAL', 'Captured candidate has no matching CAPTURED metadata',
                jsonb_build_object('count', candidate_mismatch)
           FROM integrity_health WHERE candidate_mismatch > 0
         UNION ALL
         SELECT 'integrity:capture-without-candidate', 'CAPTURE_METADATA_INTEGRITY',
                'CRITICAL', 'CAPTURED metadata has no matching captured candidate',
                jsonb_build_object('count', capture_mismatch)
           FROM integrity_health WHERE capture_mismatch > 0
       )
       SELECT incident_key, incident_type, severity, summary, metadata FROM conditions`,
      [staleRunMinutes, staleCaptureMinutes]
    );

    const activeKeys: string[] = [];
    const result: IncidentEvaluationResult = {
      opened: 0, updated: 0, reopened: 0, resolved: 0, active: conditions.rows.length
    };

    for (const condition of conditions.rows) {
      activeKeys.push(condition.incident_key);
      const existing = await client.query<{
        id: string; status: string;
      }>(
        "SELECT id, status FROM fiscal.normative_collector_incidents WHERE incident_key = $1 FOR UPDATE",
        [condition.incident_key]
      );
      const previous = existing.rows[0];
      const upserted = await client.query<{ id: string }>(
        `INSERT INTO fiscal.normative_collector_incidents
           (incident_key, incident_type, severity, status, summary, metadata,
            first_seen_at, last_seen_at, resolved_at, occurrence_count)
         VALUES ($1, $2, $3, 'OPEN', $4, $5::jsonb, now(), now(), NULL, 1)
         ON CONFLICT (incident_key) DO UPDATE SET
           incident_type = EXCLUDED.incident_type,
           severity = EXCLUDED.severity,
           status = 'OPEN',
           summary = EXCLUDED.summary,
           metadata = EXCLUDED.metadata,
           last_seen_at = now(),
           resolved_at = NULL,
           occurrence_count = CASE
             WHEN fiscal.normative_collector_incidents.status = 'RESOLVED' THEN 1
             ELSE fiscal.normative_collector_incidents.occurrence_count + 1
           END
         RETURNING id`,
        [condition.incident_key, condition.incident_type, condition.severity,
         condition.summary, JSON.stringify(condition.metadata)]
      );
      const eventType = !previous ? "OPENED" : previous.status === "RESOLVED" ? "REOPENED" : "UPDATED";
      await client.query(
        `INSERT INTO fiscal.normative_collector_incident_events
           (incident_id, event_type, metadata)
         VALUES ($1, $2, $3::jsonb)`,
        [upserted.rows[0]!.id, eventType, JSON.stringify(condition.metadata)]
      );
      if (eventType === "OPENED") result.opened++;
      else if (eventType === "REOPENED") result.reopened++;
      else result.updated++;
    }

    const resolved = await client.query<{ id: string }>(
      `UPDATE fiscal.normative_collector_incidents
          SET status = 'RESOLVED', resolved_at = now(), last_seen_at = now()
        WHERE status = 'OPEN'
          AND NOT (incident_key = ANY($1::varchar[]))
        RETURNING id`,
      [activeKeys]
    );
    for (const incident of resolved.rows) {
      await client.query(
        `INSERT INTO fiscal.normative_collector_incident_events
           (incident_id, event_type, metadata)
         VALUES ($1, 'RESOLVED', '{}'::jsonb)`,
        [incident.id]
      );
    }
    result.resolved = resolved.rows.length;
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
