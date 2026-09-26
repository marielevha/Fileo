import { createHash } from "node:crypto";
import { closeMongo, mongoDb as db } from "./mongodb.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
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

const [item] = await db.collection("order_items").aggregate([
  { $sort: { created_at: 1 } },
  { $lookup: { from: "orders", localField: "order_id", foreignField: "id", as: "order" } },
  { $unwind: "$order" }, { $match: { "order.cancelled_at": null } },
  { $set: { reference: "$order.reference" } }, { $limit: 1 },
]).toArray();
const collaborator = await db.collection("users").findOne({ phone_e164: "+242062222222" }, { projection: { id: 1 } });

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

  const updated = await db.collection("order_items").findOne({ id: item.id }, { projection: { status: 1, due_date: 1, assignee_user_id: 1, row_version: 1 } });
  check("échéance modifiée", updated.due_date === newDate);
  check("collaborateur affecté", updated.assignee_user_id === collaborator.id);
  check("état prêt enregistré", updated.status === "pret");
  check(
    "changement de date historisé",
    Boolean(await db.collection("order_date_changes").findOne({ order_item_id: item.id, changed_at: { $gte: startedAt } })),
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
  const delivered = await db.collection("order_items").findOne({ id: item.id }, { projection: { status: 1, delivered_at: 1, delivered_quantity: 1 } });
  check("date de remise renseignée", delivered.status === "remis" && Boolean(delivered.delivered_at));
  check("quantité remise cohérente", delivered.delivered_quantity === item.quantity);
  check(
    "changements audités",
    await db.collection("audit_log").countDocuments({ entity_id: item.id, created_at: { $gte: startedAt } }) >= 3,
  );

  const deliveredPage = await get(`/fr/atelier/planning?statut=remis&q=${encodeURIComponent(item.reference)}`);
  check("remise visible dans le planning", deliveredPage.html.includes("Remise") && deliveredPage.html.includes(item.reference));
  console.log("\nTout est conforme.\n");
} finally {
  await db.collection("order_items").updateOne({ id: item.id }, { $set: { status: item.status, due_date: item.due_date ?? null, assignee_user_id: item.assignee_user_id ?? null, delivered_at: item.delivered_at ?? null, delivered_quantity: item.delivered_quantity ?? 0, cancelled_at: item.cancelled_at ?? null, updated_at: item.updated_at, row_version: item.row_version } });
  await db.collection("order_date_changes").deleteMany({ order_item_id: item.id, changed_at: { $gte: startedAt } });
  await db.collection("audit_log").deleteMany({ entity_id: item.id, created_at: { $gte: startedAt } });
  if (sessionToken) {
    const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
    await db.collection("sessions").deleteOne({ token_hash: tokenHash });
  }
  await closeMongo();
}
