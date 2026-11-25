import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12) throw new Error("PASSWORD_TOO_SHORT");
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64) as Buffer;
  return "scrypt$" + salt.toString("hex") + "$" + derived.toString("hex");
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, saltHex, hashHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltHex || !hashHex ||
      !/^[a-f0-9]+$/i.test(saltHex) || !/^[a-f0-9]+$/i.test(hashHex)) return false;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scrypt(password, Buffer.from(saltHex, "hex"), expected.length) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
