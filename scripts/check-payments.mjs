import { closeMongo, mongoDb as db } from "./mongodb.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const cookies = new Map();
let movementId = null;

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
  for (const [key, value] of Object.entries(values)) body.set(key, value);

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

try {
  console.log("\nEncaissements - ecriture et idempotence\n");

  const order = await db.collection("orders").findOne(
    { cancelled_at: null },
    { sort: { created_at: 1 }, projection: { id: 1, workshop_id: 1, currency: 1 } },
  );
  if (!order) throw new Error("Aucune commande active disponible pour le test.");

  const loginPage = await get("/fr/connexion");
  const loginResponse = await submit(
    "/fr/connexion",
    findForm(loginPage.html, "Se connecter"),
    { country: "CG", phone: "+242061111111", password: "Atelier2026!" },
  );
  check("connexion responsable", loginResponse.status === 303);

  const paymentsList = await get("/fr/atelier/paiements");
  check("liste des paiements accessible", paymentsList.response.status === 200);
  check(
    "synthese des soldes visible",
    paymentsList.html.includes("Reste") && paymentsList.html.includes("Encaisser"),
  );

  const filteredList = await get("/fr/atelier/paiements?filtre=a_encaisser");
  check("filtre a encaisser accessible", filteredList.response.status === 200);

  const path = `/fr/atelier/commandes/${order.id}/encaissement`;
  const paymentPage = await get(path);
  check("formulaire accessible", paymentPage.response.status === 200);
  const form = findForm(paymentPage.html, "Enregistrer l'encaissement");
  const reference = `CHECK-PAYMENT-${Date.now()}`;
  const values = {
    amount: "1000",
    effectiveDate: new Date().toISOString().slice(0, 10),
    method: "cash",
    reference,
  };

  const response = await submit(path, form, values);
  check(
    "enregistrement redirige vers la commande",
    response.status === 303 &&
      response.headers.get("location") === `/fr/atelier/commandes/${order.id}?encaissement=ok`,
  );

  const movement = await db.collection("financial_movements").findOne(
    { workshop_id: order.workshop_id, order_id: order.id, reference },
    { projection: { id: 1, amount: 1, currency: 1, method: 1, status: 1 } },
  );
  movementId = movement?.id ?? null;
  check(
    "mouvement confirme persiste",
    Boolean(movement) && movement.amount === 1000 && movement.currency === order.currency &&
      movement.method === "cash" && movement.status === "confirmed",
  );
  check(
    "ecriture inscrite dans l'audit",
    Boolean(await db.collection("audit_log").findOne({ entity_kind: "financial_movement", entity_id: movementId, action: "payment.record" })),
  );

  const replay = await submit(path, form, values);
  check("renvoi idempotent accepte", replay.status === 303);
  check(
    "renvoi ne duplique pas l'encaissement",
    await db.collection("financial_movements").countDocuments({ workshop_id: order.workshop_id, reference }) === 1,
  );

  const detail = await get(`/fr/atelier/commandes/${order.id}?encaissement=ok`);
  check("confirmation visible sur la commande", detail.html.includes("Encaissement enregistr"));
  check("mouvement visible dans l'historique", detail.html.includes(reference));

  console.log("\nTout est conforme.\n");
} finally {
  if (movementId) {
    await db.collection("audit_log").deleteMany({ entity_kind: "financial_movement", entity_id: movementId });
    await db.collection("financial_movements").deleteOne({ id: movementId });
  }
  await closeMongo();
}
