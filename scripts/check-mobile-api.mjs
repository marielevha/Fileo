import { closeMongo, mongoDb as db } from "./mongodb.mjs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const LOGIN_PHONE = "+242061111111";
const PASSWORD = "Atelier2026!";

let token = null;
let createdClientId = null;
let createdOrderId = null;
let createdMovementId = null;
let createdMeasurementId = null;

function check(label, condition) {
  console.log(`  ${condition ? "ok  " : "FAIL"} ${label}`);
  if (!condition) throw new Error(label);
}

async function api(path, options = {}) {
  const headers = {
    ...(options.body && !(options.body instanceof FormData) ? { "content-type": "application/json" } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  };
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { response, json };
}

try {
  console.log("\nAPI mobile - parcours principal\n");

  const index = await api("/api/mobile/v1");
  check("index API accessible", index.response.status === 200 && index.json?.data?.version === "v1");
  check("index expose la documentation", index.json?.data?.documentation?.swagger === "GET /api/mobile/v1/docs");

  const openapi = await api("/api/mobile/v1/openapi.json");
  check("spec OpenAPI accessible", openapi.response.status === 200 && openapi.json?.openapi === "3.0.3");
  check("spec OpenAPI expose le login", Boolean(openapi.json?.paths?.["/auth/login"]?.post));

  const docs = await fetch(`${BASE}/api/mobile/v1/docs`);
  const docsText = await docs.text();
  check("Swagger UI accessible", docs.status === 200 && docsText.includes("SwaggerUIBundle"));

  const preflight = await fetch(`${BASE}/api/mobile/v1/auth/login`, {
    method: "OPTIONS",
    headers: {
      origin: "http://localhost:8082",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type",
    },
  });
  check("preflight CORS mobile", preflight.status === 204 && Boolean(preflight.headers.get("access-control-allow-origin")));

  const login = await api("/api/mobile/v1/auth/login", {
    method: "POST",
    body: { country: "CG", phone: LOGIN_PHONE, password: PASSWORD },
  });
  token = login.json?.data?.token ?? null;
  check("login mobile retourne un token", login.response.status === 200 && typeof token === "string" && token.length > 20);
  check("contexte atelier retourne", Boolean(login.json?.data?.workshop?.id));

  const me = await api("/api/mobile/v1/me");
  check("me authentifie", me.response.status === 200 && me.json?.data?.user?.phone === LOGIN_PHONE);

  const bootstrap = await api("/api/mobile/v1/bootstrap");
  check("bootstrap dashboard", bootstrap.response.status === 200 && typeof bootstrap.json?.data?.dashboard?.counts?.late === "number");

  const unique = Date.now();
  const createdClient = await api("/api/mobile/v1/clients", {
    method: "POST",
    body: { displayName: `Mobile API ${unique}`, notes: "Cree par check:mobile-api" },
  });
  createdClientId = createdClient.json?.data?.id ?? null;
  check("creation client API", createdClient.response.status === 201 && Boolean(createdClientId));

  const clientList = await api(`/api/mobile/v1/clients?q=${encodeURIComponent(`Mobile API ${unique}`)}`);
  check("liste clients filtre", clientList.response.status === 200 && clientList.json?.data?.items?.some((row) => row.id === createdClientId));

  const updatedClient = await api(`/api/mobile/v1/clients/${createdClientId}`, {
    method: "PATCH",
    body: { displayName: `Mobile API modifie ${unique}`, notes: "Modifie par check:mobile-api" },
  });
  check("modification client API", updatedClient.response.status === 200);

  const measurement = await api(`/api/mobile/v1/clients/${createdClientId}/measurements`, {
    method: "POST",
    body: {
      category: "uniforme",
      values: { poitrine: 62, taille: 55 },
      notes: "Mesures test API mobile",
      takenAt: new Date().toISOString().slice(0, 10),
    },
  });
  createdMeasurementId = measurement.json?.data?.id ?? null;
  check("creation mesure API", measurement.response.status === 201 && Boolean(createdMeasurementId));

  const order = await api("/api/mobile/v1/orders", {
    method: "POST",
    body: {
      clientId: createdClientId,
      promisedDate: "2026-10-20",
      fittingDate: "2026-10-18",
      items: [
        {
          category: "Uniforme test",
          description: `Commande mobile ${unique}`,
          workType: "creation",
          wearerName: "Enfant",
          unitPriceAmount: 3500,
          dueDate: "2026-10-19",
          measurementValues: { poitrine: "62", taille: "55" },
        },
      ],
    },
  });
  createdOrderId = order.json?.data?.orderId ?? null;
  check("creation commande API", order.response.status === 201 && Boolean(createdOrderId));

  const orderDetail = await api(`/api/mobile/v1/orders/${createdOrderId}`);
  check("detail commande API", orderDetail.response.status === 200 && orderDetail.json?.data?.order?.id === createdOrderId);

  const payment = await api("/api/mobile/v1/payments/record", {
    method: "POST",
    body: {
      orderId: createdOrderId,
      amount: 1000,
      method: "cash",
      reference: `MOBILE-${unique}`,
      effectiveDate: new Date().toISOString().slice(0, 10),
      idempotencyKey: `mobile-api:${unique}`,
    },
  });
  createdMovementId = payment.json?.data?.movementId ?? null;
  check("encaissement API", payment.response.status === 200 && Boolean(createdMovementId));

  const payments = await api("/api/mobile/v1/payments?filter=a_encaisser");
  check("liste paiements API", payments.response.status === 200 && typeof payments.json?.data?.stats?.totalOrders === "number");

  const planning = await api("/api/mobile/v1/planning");
  check("planning API", planning.response.status === 200 && Array.isArray(planning.json?.data?.items));

  const logout = await api("/api/mobile/v1/auth/logout", { method: "POST" });
  check("logout API", logout.response.status === 200);

  console.log("\nTout est conforme.\n");
} finally {
  if (createdMeasurementId) {
    await db.collection("measurement_records").deleteOne({ id: createdMeasurementId });
    await db.collection("audit_log").deleteMany({ entity_id: createdMeasurementId });
  }
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
  if (token) {
    const { createHash } = await import("node:crypto");
    await db.collection("sessions").deleteMany({ token_hash: createHash("sha256").update(token).digest("hex") });
  }
  await closeMongo();
}
