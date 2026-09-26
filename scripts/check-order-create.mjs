import { closeMongo, mongoDb as db } from "./mongodb.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const cookies = new Map();
let createdOrderId = null;
let createdMovementId = null;
let createdClientId = null;

function decodeHtml(value = "") {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&amp;", "&");
}

function visibleText(html) {
  return decodeHtml(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ");
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

async function submit(path, formHtml, entries) {
  const body = new FormData();
  for (const match of formHtml.matchAll(/<input\s+type="hidden"\s+name="([^"]+)"(?:\s+value="([^"]*)")?\s*\/>/g)) {
    body.append(match[1], decodeHtml(match[2]));
  }
  for (const [key, value] of entries) body.append(key, value);
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
  console.log("\nCommandes - creation complete\n");

  const loginPage = await get("/fr/connexion");
  const loginResponse = await submit(
    "/fr/connexion",
    findForm(loginPage.html, "Se connecter"),
    [
      ["country", "CG"],
      ["phone", "+242061111111"],
      ["password", "Atelier2026!"],
    ],
  );
  check("connexion responsable", loginResponse.status === 303);

  const owner = await db.collection("users").findOne(
    { phone_e164: "+242061111111" },
    { projection: { id: 1 } },
  );
  const membership = await db.collection("memberships").findOne(
    { user_id: owner.id, status: "active" },
    { projection: { workshop_id: 1 } },
  );
  const createPage = await get("/fr/atelier/commandes/nouvelle");
  check("formulaire de commande accessible", createPage.response.status === 200);

  const category = `Uniforme test ${Date.now()}`;
  const description = `Article test ${Date.now()}`;
  const clientName = `Client commande ${Date.now()}`;
  const reference = `ACOMPTE-${Date.now()}`;
  const createResponse = await submit(
    "/fr/atelier/commandes/nouvelle",
    findForm(createPage.html, "Creer la commande"),
    [
      ["clientMode", "new"],
      ["newClientDisplayName", clientName],
      ["newClientPhone", ""],
      ["promisedDate", "2026-10-01"],
      ["fittingDate", "2026-09-25"],
      ["itemWorkType", "retouche"],
      ["itemCategory", category],
      ["itemDescription", description],
      ["itemWearerName", "Prince"],
      ["itemUnitPrice", "0"],
      ["itemDueDate", "2026-09-28"],
      ["itemMeasurements", "Tour poitrine: 62\nTour taille: 55\nLongueur pantalon: 70"],
      ["orderTotalAmount", "3000"],
      ["instructions", "Commande creee par check:order-create"],
      ["discountAmount", "500"],
      ["discountReason", "Geste commercial test"],
      ["initialPaymentAmount", "1000"],
      ["initialPaymentMethod", "mobile_money"],
      ["initialPaymentReference", reference],
      ["initialPaymentDate", new Date().toISOString().slice(0, 10)],
    ],
  );

  const location = createResponse.headers.get("location") ?? "";
  const creationHtml = await createResponse.text();
  createdOrderId = /\/atelier\/commandes\/([0-9a-f-]{36})/.exec(location || creationHtml)?.[1] ?? null;
  if (!(createResponse.status === 200 && Boolean(createdOrderId))) {
    console.log("  debug creation", createResponse.status, location, visibleText(creationHtml).slice(0, 1200));
  }
  check(
    "creation affiche une confirmation avec lien vers la fiche",
    createResponse.status === 200 &&
      Boolean(createdOrderId) &&
      visibleText(creationHtml).includes("Commande creee"),
  );

  const order = await db.collection("orders").findOne({ id: createdOrderId });
  createdClientId = order?.client_id ?? null;
  check("commande enregistree", Boolean(order));
  check(
    "client cree depuis la commande",
    Boolean(await db.collection("clients").findOne({ id: createdClientId, display_name: clientName, deleted_at: null })),
  );
  check("commande rattachee au nouveau client", Boolean(createdClientId) && order?.client_id === createdClientId);
  check("dates et remise conservees", order?.promised_date === "2026-10-01" && order?.discount_amount === 500);

  const item = await db.collection("order_items").findOne({ order_id: createdOrderId });
  check("article enregistre", item?.description === description && item?.quantity === 1 && item?.unit_price_amount === 3000);
  check("type de travail conserve", item?.work_type === "retouche");
  check("echeance article conservee", item?.due_date === "2026-09-28");
  const snapshot = JSON.parse(item?.measurement_snapshot ?? "{}");
  check("personne concernee conservee", item?.wearer_name === "Prince" && item?.wearer_relation === null);
  check(
    "mensurations article conservees",
    snapshot?.values?.["Tour poitrine"] === "62" &&
      snapshot?.values?.["Tour taille"] === "55" &&
      snapshot?.notes === null,
  );

  const movement = await db.collection("financial_movements").findOne({ order_id: createdOrderId, kind: "payment" });
  createdMovementId = movement?.id ?? null;
  check("acompte initial enregistre", movement?.amount === 1000 && movement?.method === "mobile_money");
  check("reference acompte conservee", movement?.reference === reference);

  check(
    "audit commande present",
    Boolean(await db.collection("audit_log").findOne({ entity_id: createdOrderId, action: "order.create" })),
  );
  check(
    "audit paiement present",
    Boolean(await db.collection("audit_log").findOne({ entity_id: createdMovementId, action: "payment.record" })),
  );

  const detailPage = await get(`/fr/atelier/commandes/${createdOrderId}`);
  check(
    "fiche creee consultable avec mensurations",
    detailPage.response.status === 200 &&
      detailPage.html.includes(description) &&
      detailPage.html.includes("Prince") &&
      detailPage.html.includes("Tour poitrine"),
  );

  console.log("\nTout est conforme.\n");
} finally {
  if (createdOrderId) {
    await db.collection("audit_log").deleteMany({
      $or: [{ entity_id: createdOrderId }, ...(createdMovementId ? [{ entity_id: createdMovementId }] : [])],
    });
    await db.collection("financial_movements").deleteMany({ order_id: createdOrderId });
    await db.collection("order_items").deleteMany({ order_id: createdOrderId });
    await db.collection("orders").deleteOne({ id: createdOrderId });
  }
  if (createdClientId) {
    await db.collection("audit_log").deleteMany({ entity_id: createdClientId });
    await db.collection("clients").deleteOne({ id: createdClientId });
  }
  await closeMongo();
}
