import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const db = new DatabaseSync(join(process.cwd(), "data", "fileo.db"));
const cookies = new Map();
const startedAt = new Date().toISOString();
let sessionToken = null;

function decodeHtml(value = "") {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
}

function rememberCookies(response) {
  const values = response.headers.getSetCookie?.() ?? [response.headers.get("set-cookie")];
  for (const value of values) {
    if (!value) continue;
    const [pair] = value.split(";");
    const separator = pair.indexOf("=");
    cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  sessionToken = cookies.get("fileo_session") ?? sessionToken;
}

function cookieHeader() {
  return [...cookies].map(([key, value]) => `${key}=${value}`).join("; ");
}

async function get(path) {
  const response = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    headers: cookieHeader() ? { cookie: cookieHeader() } : {},
  });
  rememberCookies(response);
  return { response, html: await response.text() };
}

function findForm(html, buttonText) {
  const forms = [...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form>/g)].map((match) => match[0]);
  const form = forms.find((candidate) => decodeHtml(candidate).includes(buttonText));
  if (!form) throw new Error(`Formulaire introuvable: ${buttonText}`);
  return form;
}

async function submit(path, formHtml, values) {
  const body = new FormData();
  for (const match of formHtml.matchAll(/<input\s+type="hidden"\s+name="([^"]+)"(?:\s+value="([^"]*)")?\s*\/>/g)) {
    body.append(match[1], decodeHtml(match[2]));
  }
  for (const [key, value] of Object.entries(values)) body.append(key, value);
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    body,
    redirect: "manual",
    headers: { cookie: cookieHeader(), origin: BASE },
  });
  rememberCookies(response);
  return response;
}

function check(label, condition) {
  console.log(`  ${condition ? "ok  " : "FAIL"} ${label}`);
  if (!condition) throw new Error(label);
}

const item = db.prepare(
  `SELECT oi.*, o.reference
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
    WHERE o.cancelled_at IS NULL
    ORDER BY oi.created_at
    LIMIT 1`,
).get();
const collaborator = db.prepare(
  "SELECT id FROM users WHERE phone_e164 = ?",
).get("+242062222222");

try {
  console.log("\nPlanning - replanification et suivi\n");
  const loginPage = await get("/fr/connexion");
  const loginResponse = await submit(
    "/fr/connexion",
    findForm(loginPage.html, "Se connecter"),
    { country: "CG", phone: "+242061111111", password: "Atelier2026!" },
  );
  check("connexion responsable", loginResponse.status === 303);

  const planningPath = `/fr/atelier/planning?statut=all&q=${encodeURIComponent(item.reference)}`;
  const planningPage = await get(planningPath);
  check("éditeur de tâche accessible", planningPage.response.status === 200 && planningPage.html.includes("Mettre à jour"));

  const currentDate = item.due_date ?? new Date().toISOString().slice(0, 10);
  const date = new Date(`${currentDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  const newDate = date.toISOString().slice(0, 10);
  const firstResponse = await submit(
    planningPath,
    findForm(planningPage.html, "Enregistrer"),
    {
      status: "pret",
      assigneeId: collaborator.id,
      dueDate: newDate,
      reason: "Replanification du test automatique",
    },
  );
  check("mise à jour acceptée", firstResponse.status === 303);

  const updated = db.prepare(
    "SELECT status, due_date, assignee_user_id, row_version FROM order_items WHERE id = ?",
  ).get(item.id);
  check("échéance modifiée", updated.due_date === newDate);
  check("collaborateur affecté", updated.assignee_user_id === collaborator.id);
  check("état prêt enregistré", updated.status === "pret");
  check(
    "changement de date historisé",
    Boolean(db.prepare("SELECT 1 FROM order_date_changes WHERE order_item_id = ? AND changed_at >= ?").get(item.id, startedAt)),
  );

  const refreshedPage = await get(planningPath);
  const deliveryResponse = await submit(
    planningPath,
    findForm(refreshedPage.html, "Enregistrer"),
    {
      status: "remis",
      assigneeId: collaborator.id,
      dueDate: newDate,
      reason: "Remise validée par le test automatique",
    },
  );
  check("remise acceptée", deliveryResponse.status === 303);
  const delivered = db.prepare(
    "SELECT status, delivered_at, delivered_quantity FROM order_items WHERE id = ?",
  ).get(item.id);
  check("date de remise renseignée", delivered.status === "remis" && Boolean(delivered.delivered_at));
  check("quantité remise cohérente", delivered.delivered_quantity === item.quantity);
  check(
    "changements audités",
    db.prepare("SELECT COUNT(*) AS total FROM audit_log WHERE entity_id = ? AND created_at >= ?").get(item.id, startedAt).total >= 3,
  );

  const deliveredPage = await get(`/fr/atelier/planning?statut=remis&q=${encodeURIComponent(item.reference)}`);
  check("remise visible dans le planning", deliveredPage.html.includes("Remise") && deliveredPage.html.includes(item.reference));
  console.log("\nTout est conforme.\n");
} finally {
  db.prepare(
    `UPDATE order_items
        SET status = ?, due_date = ?, assignee_user_id = ?, delivered_at = ?,
            delivered_quantity = ?, cancelled_at = ?, updated_at = ?, row_version = ?
      WHERE id = ?`,
  ).run(
    item.status,
    item.due_date,
    item.assignee_user_id,
    item.delivered_at,
    item.delivered_quantity,
    item.cancelled_at,
    item.updated_at,
    item.row_version,
    item.id,
  );
  db.prepare("DELETE FROM order_date_changes WHERE order_item_id = ? AND changed_at >= ?").run(item.id, startedAt);
  db.prepare("DELETE FROM audit_log WHERE entity_id = ? AND created_at >= ?").run(item.id, startedAt);
  if (sessionToken) {
    const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
  }
  db.close();
}
