import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

/**
 * Password hashing with scrypt from `node:crypto` — deliberately not bcrypt or
 * argon2, both of which need a native build step this environment cannot run.
 * scrypt is memory-hard and part of the standard library.
 */

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const derived = await scryptAsync(password, Buffer.from(saltHex, "hex"), expected.length);

  // Constant-time: a length mismatch must not short-circuit either.
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** Minimum policy for the pilot; tighten once the real threat model is set. */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  if (!/[a-zA-Z]/.test(password)) return "Le mot de passe doit contenir au moins une lettre.";
  if (!/\d/.test(password)) return "Le mot de passe doit contenir au moins un chiffre.";
  return null;
}
