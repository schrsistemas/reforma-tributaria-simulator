import { loadConfig } from "./config.js";
import { createPool } from "./db.js";
import { buildApp } from "./app.js";

const config = loadConfig();
const pool = createPool(config.DATABASE_URL);
const app = await buildApp({ pool, jwtSecret: config.JWT_SECRET, corsOrigin: config.CORS_ORIGIN, logger: config.NODE_ENV !== "test" });
app.addHook("onClose", async () => { await pool.end(); });

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
