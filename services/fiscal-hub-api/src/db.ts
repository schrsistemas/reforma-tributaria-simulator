import { Pool, type PoolClient, type QueryResultRow } from "pg";

export function createPool(connectionString: string): Pool {
  return new Pool({
    connectionString, max: 10, idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000, statement_timeout: 15_000,
    application_name: "fiscal-intelligence-hub"
  });
}

/** Tenant-scoped transaction; app.tenant_id is transaction-local and cannot leak via the pool. */
export async function withTenant<T extends QueryResultRow>(
  pool: Pick<Pool, "connect">,
  tenantId: string,
  operation: (client: PoolClient) => Promise<T[]>
): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
