export interface AdvisoryLockClient {
  query<T = unknown>(
    sql: string,
    values?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

/**
 * Serializes the normative source monitor across processes and scheduler
 * instances. PostgreSQL session advisory locks are held by the connection,
 * so callers must use one checked-out client for the whole task.
 */
export async function withNormativeMonitorLock<T>(
  client: AdvisoryLockClient,
  task: () => Promise<T>
): Promise<{ acquired: boolean; value?: T }> {
  const lock = await client.query<{ locked: boolean }>(
    "SELECT pg_try_advisory_lock(20261125, 1) AS locked"
  );

  if (lock.rows[0]?.locked !== true) {
    return { acquired: false };
  }

  try {
    return { acquired: true, value: await task() };
  } finally {
    await client.query("SELECT pg_advisory_unlock(20261125, 1)");
  }
}
