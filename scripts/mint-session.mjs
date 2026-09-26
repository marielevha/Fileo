/** Émet un jeton de session de développement pour un utilisateur MongoDB. */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { closeMongo, mongoDb as db } from "./mongodb.mjs";

const phone = process.argv[2];
if (!phone) {
  console.error("Usage: node scripts/mint-session.mjs <telephone_e164>");
  await closeMongo();
  process.exit(1);
}

const user = await db.collection("users").findOne(
  { phone_e164: phone },
  { projection: { id: 1, full_name: 1 } },
);
if (!user) {
  console.error(`Aucun utilisateur avec le numéro ${phone}`);
  await closeMongo();
  process.exit(1);
}

const token = randomBytes(32).toString("base64url");
const now = new Date().toISOString();
await db.collection("sessions").insertOne({
  id: randomUUID(), user_id: user.id,
  token_hash: createHash("sha256").update(token).digest("hex"),
  workshop_id: null, user_agent: "mint-session", created_at: now,
  last_seen_at: now, expires_at: new Date(Date.now() + 86_400_000).toISOString(),
  revoked_at: null,
});

console.log(token);
await closeMongo();
