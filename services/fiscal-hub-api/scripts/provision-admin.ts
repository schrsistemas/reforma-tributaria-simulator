import { createPool } from "../src/db.js";
import { hashPassword } from "../src/auth.js";

const required = [
  "DATABASE_URL",
  "BOOTSTRAP_TENANT_NAME",
  "BOOTSTRAP_TENANT_SLUG",
  "BOOTSTRAP_ADMIN_EMAIL",
  "BOOTSTRAP_ADMIN_NAME",
  "BOOTSTRAP_ADMIN_PASSWORD"
] as const;

for (const key of required) {
  if (!process.env[key]) throw new Error("Missing required environment variable: " + key);
}

const tenantName = process.env.BOOTSTRAP_TENANT_NAME!;
const tenantSlug = process.env.BOOTSTRAP_TENANT_SLUG!;
const email = process.env.BOOTSTRAP_ADMIN_EMAIL!.trim().toLowerCase();
const displayName = process.env.BOOTSTRAP_ADMIN_NAME!;
const passwordHash = await hashPassword(process.env.BOOTSTRAP_ADMIN_PASSWORD!);
const pool = createPool(process.env.DATABASE_URL!);
const client = await pool.connect();

try {
  await client.query("BEGIN");
  const tenant = await client.query<{ id: string }>(
    "INSERT INTO fiscal.tenants (name, slug) VALUES ($1, $2) RETURNING id",
    [tenantName, tenantSlug]
  );
  const user = await client.query<{ id: string }>(
    "INSERT INTO fiscal.users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id",
    [email, displayName, passwordHash]
  );
  await client.query(
    "INSERT INTO fiscal.tenant_memberships (tenant_id, user_id, roles) VALUES ($1, $2, ARRAY['OWNER','ADMIN']::text[])",
    [tenant.rows[0]!.id, user.rows[0]!.id]
  );
  await client.query("COMMIT");
  process.stdout.write(JSON.stringify({
    created: true,
    tenantId: tenant.rows[0]!.id,
    userId: user.rows[0]!.id,
    tenantSlug
  }) + "\n");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
