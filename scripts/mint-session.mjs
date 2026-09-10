/**
 * Émet un cookie de session valide pour un utilisateur, afin de tester les
 * pages protégées sans passer par un navigateur.
 *
 *   node scripts/mint-session.mjs +242061111111
 *
 * Outil de développement uniquement : il contourne la vérification du mot de
 * passe. Ne jamais l'exposer dans un environnement déployé.
 */

import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { join } from "node:path";

const phone = process.argv[2];
if (!phone) {
  console.error("Usage: node scripts/mint-session.mjs <telephone_e164>");
  process.exit(1);
}

const db = new DatabaseSync(process.env.FILEO_DB_PATH ?? join(process.cwd(), "data", "fileo.db"));

const user = db.prepare("SELECT id, full_name FROM users WHERE phone_e164 = ?").get(phone);
if (!user) {
  console.error(`Aucun utilisateur avec le numéro ${phone}`);
  process.exit(1);
}

const token = randomBytes(32).toString("base64url");
const now = new Date().toISOString();
const expires = new Date(Date.now() + 86_400_000).toISOString();

db.prepare(
  `INSERT INTO sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at)
   VALUES (?, ?, ?, ?, ?, ?)`,
).run(randomUUID(), user.id, createHash("sha256").update(token).digest("hex"), now, now, expires);

console.log(token);
db.close();
