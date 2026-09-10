import { createHash, randomBytes, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const db = new DatabaseSync(join(process.cwd(), "data", "fileo.db"));
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
  const owner = db.prepare("SELECT id FROM users WHERE phone_e164 = ?").get("+242061111111");
  const membership = db.prepare(
    "SELECT workshop_id FROM memberships WHERE user_id = ? AND status = 'active' LIMIT 1",
  ).get(owner.id);
  const client = db.prepare(
    "SELECT id FROM clients WHERE workshop_id = ? AND deleted_at IS NULL ORDER BY created_at LIMIT 1",
  ).get(membership.workshop_id);

  const token = randomBytes(32).toString("base64url");
  sessionId = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    sessionId,
    owner.id,
    createHash("sha256").update(token).digest("hex"),
    now,
    now,
    new Date(Date.now() + 60_000).toISOString(),
  );

  const prefix = `PAGE-${Date.now()}`;
  const insertOrder = db.prepare(
    `INSERT INTO orders (
       id, workshop_id, client_id, reference, currency, created_by, created_at, updated_at
     ) VALUES (?, ?, ?, ?, 'XAF', ?, ?, ?)`,
  );
  const baseTime = Date.now();
  for (let index = 1; index <= 11; index += 1) {
    const id = randomUUID();
    const createdAt = new Date(baseTime + index * 1_000).toISOString();
    orderIds.push(id);
    insertOrder.run(
      id,
      membership.workshop_id,
      client.id,
      `${prefix}-${String(index).padStart(2, "0")}`,
      owner.id,
      createdAt,
      createdAt,
    );
  }

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
  for (const id of orderIds) db.prepare("DELETE FROM orders WHERE id = ?").run(id);
  if (sessionId) db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  db.close();
}
