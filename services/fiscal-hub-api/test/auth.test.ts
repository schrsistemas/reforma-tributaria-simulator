import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/auth.js";

test("password hashes use a random salt and verify correctly", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("correct horse battery staple", first), true);
  assert.equal(await verifyPassword("incorrect password", first), false);
});

test("malformed password hashes are rejected", async () => {
  assert.equal(await verifyPassword("anything", "plain-text"), false);
  assert.equal(await verifyPassword("anything", "scrypt$$"), false);
});

test("password policy rejects short passwords", async () => {
  await assert.rejects(() => hashPassword("short"), /PASSWORD_TOO_SHORT/);
});
