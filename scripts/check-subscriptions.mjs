import { closeMongo, mongoDb as db } from "./mongodb.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LOGIN_PHONE = "+242061111111";
const cookies = new Map();
let paymentId = null;

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

async function selectablePlan() {
  const user = await db.collection("users").findOne(
    { phone_e164: LOGIN_PHONE },
    { projection: { id: 1 } },
  );
  const membership = user
    ? await db.collection("memberships").findOne(
        { user_id: user.id, status: "active" },
        { projection: { workshop_id: 1 } },
      )
    : null;
  if (!membership) throw new Error("atelier de test introuvable");

  const plans = await db.collection("plans").find(
    { country_code: "CG", currency: "XAF", archived_at: null },
    { projection: { id: 1, price_amount: 1, label: 1 }, sort: { price_amount: 1 } },
  ).toArray();

  for (const plan of plans) {
    const pending = await db.collection("platform_payments").findOne(
      { workshop_id: membership.workshop_id, plan_id: plan.id, status: "declared" },
      { projection: { id: 1 } },
    );
    if (!pending) return plan;
  }

  throw new Error("aucune offre sans paiement en attente");
}

try {
  console.log("\nAbonnement atelier - declaration manuelle\n");

  const loginPage = await get("/fr/connexion");
  const loginResponse = await submit(
    "/fr/connexion",
    findForm(loginPage.html, "Se connecter"),
    { country: "CG", phone: LOGIN_PHONE, password: "Atelier2026!" },
  );
  check("connexion responsable", loginResponse.status === 303);

  const page = await get("/fr/atelier/abonnement");
  check("page abonnement accessible", page.response.status === 200);
  check("offres visibles", page.html.includes("Offres disponibles"));
  check("formulaire visible", decodeHtml(page.html).includes("Déclarer le paiement"));

  const plan = await selectablePlan();
  const reference = `CHECK-SUB-${Date.now()}`;
  const response = await submit(
    "/fr/atelier/abonnement",
    findForm(page.html, "Déclarer le paiement"),
    {
      planId: plan.id,
      amount: String(plan.price_amount),
      channel: "mobile_money",
      externalReference: reference,
      declaredAt: new Date().toISOString().slice(0, 10),
      note: "Check automatique",
    },
  );
  check("declaration acceptee", response.status === 200);

  const payment = await db.collection("platform_payments").findOne(
    { external_reference: reference },
    { projection: { id: 1, status: 1, amount: 1, channel: 1, plan_id: 1 } },
  );
  paymentId = payment?.id ?? null;
  check(
    "paiement declare persiste",
    Boolean(payment) && payment.status === "declared" && payment.amount === plan.price_amount &&
      payment.channel === "mobile_money" && payment.plan_id === plan.id,
  );
  check(
    "declaration auditee",
    Boolean(await db.collection("audit_log").findOne({ action: "platform_payment.declare", entity_id: paymentId })),
  );

  const duplicate = await submit(
    "/fr/atelier/abonnement",
    findForm(page.html, "Déclarer le paiement"),
    {
      planId: plan.id,
      amount: String(plan.price_amount),
      channel: "mobile_money",
      externalReference: reference,
      declaredAt: new Date().toISOString().slice(0, 10),
    },
  );
  check("doublon reference refuse", duplicate.status === 200);
  check(
    "reference non dupliquee",
    await db.collection("platform_payments").countDocuments({ external_reference: reference }) === 1,
  );

  console.log("\nTout est conforme.\n");
} finally {
  if (paymentId) {
    await db.collection("audit_log").deleteMany({ entity_kind: "platform_payment", entity_id: paymentId });
    await db.collection("platform_payments").deleteOne({ id: paymentId });
  }
  await closeMongo();
}
