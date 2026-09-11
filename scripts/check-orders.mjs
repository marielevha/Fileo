import { createHash, randomBytes, randomUUID } from "node:crypto";
import { closeMongo, mongoDb as db } from "./mongodb.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const orderIds = [];
let sessionId = null;

function visibleText(html) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
}

function check(label, condition) {
  console.log(`  ${condition ? "ok  " : "FAIL"} ${label}`);
  if (!condition) throw new Error(label);
}

try {
  console.log("\nCommandes - pagination\n");
  const owner = await db.collection("users").findOne({ phone_e164: "+242061111111" }, { projection: { id: 1 } });
  const membership = await db.collection("memberships").findOne({ user_id: owner.id, status: "active" }, { projection: { workshop_id: 1 } });
  const client = await db.collection("clients").findOne({ workshop_id: membership.workshop_id, deleted_at: null }, { sort: { created_at: 1 }, projection: { id: 1 } });

  const token = randomBytes(32).toString("base64url");
  sessionId = randomUUID();
  const now = new Date().toISOString();
  await db.collection("sessions").insertOne({ id: sessionId, user_id: owner.id, token_hash: createHash("sha256").update(token).digest("hex"), workshop_id: null, user_agent: "check:orders", created_at: now, last_seen_at: now, expires_at: new Date(Date.now() + 60_000).toISOString(), revoked_at: null });

  const prefix = `PAGE-${Date.now()}`;
  const orderRows = [];
  const baseTime = Date.now();
  for (let index = 1; index <= 11; index += 1) {
    const id = randomUUID();
    const createdAt = new Date(baseTime + index * 1_000).toISOString();
    orderIds.push(id);
    orderRows.push({ id, workshop_id: membership.workshop_id, client_id: client.id, reference: `${prefix}-${String(index).padStart(2, "0")}`, currency: "XAF", discount_amount: 0, discount_reason: null, instructions: null, promised_date: null, fitting_date: null, cancelled_at: null, created_by: owner.id, created_at: createdAt, updated_at: createdAt, row_version: 1 });
  }
  await db.collection("orders").insertMany(orderRows);

  async function get(path) {
    const response = await fetch(`${BASE}${path}`, {
      headers: { cookie: `fileo_session=${token}` },
    });
    return { status: response.status, html: await response.text() };
  }

  const firstPage = await get("/fr/atelier/commandes?taille=10&page=1");
  check("première page accessible", firstPage.status === 200);
  check(
    "dix commandes affichées dans l'ordre attendu",
    firstPage.html.includes(`${prefix}-11`) &&
      firstPage.html.includes(`${prefix}-02`) &&
      !firstPage.html.includes(`${prefix}-01`),
  );
  check(
    "compteur et navigation affichés",
    /13\s+commande\s*s?\s+-\s+page\s+1\s+sur\s+2/.test(visibleText(firstPage.html)) &&
      firstPage.html.includes("page=2"),
  );

  const secondPage = await get("/fr/atelier/commandes?taille=10&page=2");
  check("deuxième page accessible", secondPage.status === 200);
  check(
    "commandes restantes affichées",
    secondPage.html.includes(`${prefix}-01`) && !secondPage.html.includes(`${prefix}-11`),
  );

  console.log("\nTout est conforme.\n");
} finally {
  await db.collection("orders").deleteMany({ id: { $in: orderIds } });
  if (sessionId) await db.collection("sessions").deleteOne({ id: sessionId });
  await closeMongo();
}
