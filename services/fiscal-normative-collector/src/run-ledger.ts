export interface RunLedgerClient {
  query<T = unknown>(sql: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

/**
 * Persists one worker execution. A run is created before work starts and is
 * finalized on both success and failure. Error details are reduced to a
 * stable code so credentials, URLs and response bodies cannot leak.
 */
export async function withWorkerRun<T>(
  client: RunLedgerClient,
  workerName: "SOURCE_MONITOR" | "ARTIFACT_DISCOVERY" | "ARTIFACT_CAPTURE",
  task: () => Promise<T>
): Promise<T> {
  const started = await client.query<{ id: string }>(
    `INSERT INTO fiscal.normative_collector_runs (worker_name, run_status)
     VALUES ($1, 'RUNNING') RETURNING id`,
    [workerName]
  );
  const runId = started.rows[0]?.id;
  if (!runId) throw new Error("WORKER_RUN_LEDGER_INSERT_FAILED");

  try {
    const result = await task();
    await client.query(
      `UPDATE fiscal.normative_collector_runs
          SET run_status = 'SUCCEEDED',
              finished_at = now(),
              counters = $2::jsonb,
              failure_code = NULL
        WHERE id = $1 AND run_status = 'RUNNING'`,
      [runId, JSON.stringify(result ?? {})]
    );
    return result;
  } catch (error) {
    try {
      await client.query(
        `UPDATE fiscal.normative_collector_runs
            SET run_status = 'FAILED',
                finished_at = now(),
                failure_code = 'WORKER_FAILED'
          WHERE id = $1 AND run_status = 'RUNNING'`,
        [runId]
      );
    } catch {
      // Preserve the worker's original exception; stale RUNNING rows remain diagnosable.
    }
    throw error;
  }
}
