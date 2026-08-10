import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const KEY_LEN = 64;

/** Hash a password with a random salt (scrypt). Format: saltHex:hashHex */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LEN).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored || stored === "BOOTSTRAP_PENDING" || !stored.includes(":")) {
    return false;
  }
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, KEY_LEN);
  const expected = Buffer.from(hash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
