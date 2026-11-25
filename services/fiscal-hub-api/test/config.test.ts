import test from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "../src/config.js";

const base = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://fiscal_hub_app:local-test@localhost:5432/fiscal_hub",
  JWT_SECRET: "x".repeat(40)
};

test("loads without a global normative reviewer tenant and leaves review disabled", () => {
  const config = loadConfig(base as NodeJS.ProcessEnv);
  assert.equal(config.NORMATIVE_REVIEW_TENANT_ID, undefined);
});

test("accepts a valid global normative reviewer tenant UUID", () => {
  const config = loadConfig({
    ...base,
    NORMATIVE_REVIEW_TENANT_ID: "11111111-1111-4111-8111-111111111111"
  } as NodeJS.ProcessEnv);
  assert.equal(config.NORMATIVE_REVIEW_TENANT_ID, "11111111-1111-4111-8111-111111111111");
});

test("rejects an invalid global normative reviewer tenant identifier", () => {
  assert.throws(
    () => loadConfig({ ...base, NORMATIVE_REVIEW_TENANT_ID: "not-a-uuid" } as NodeJS.ProcessEnv),
    /Invalid configuration/
  );
});
