export interface AdvisoryLockClient {
  query<T = unknown>(sql: string, values?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
}

/** Holds a PostgreSQL session advisory lock on the caller's checked-out connection. */
export async function withAdvisoryLock<T>(client: AdvisoryLockClient, key1: number, key2: number, task: () => Promise<T>): Promise<{ acquired: boolean; value?: T }> {
  const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1, $2) AS locked", [key1, key2]);
  if (lock.rows[0]?.locked !== true) return { acquired: false };
  try { return { acquired: true, value: await task() }; }
  finally { await client.query("SELECT pg_advisory_unlock($1, $2)", [key1, key2]); }
}

/** Serializes source availability/hash checks across scheduler instances. */
export function withNormativeMonitorLock<T>(client: AdvisoryLockClient, task: () => Promise<T>) {
  return withAdvisoryLock(client, 20261125, 1, task);
}

/** Discovery uses a distinct lock and can run independently of source monitoring. */
export function withArtifactDiscoveryLock<T>(client: AdvisoryLockClient, task: () => Promise<T>) {
  return withAdvisoryLock(client, 20261125, 2, task);
}

/** Serializes S3 capture workers independently of source checks and discovery. */
export function withArtifactCaptureLock<T>(client: AdvisoryLockClient, task: () => Promise<T>) {
  return withAdvisoryLock(client, 20261125, 3, task);
}
