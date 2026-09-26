import pg from "pg";

process.loadEnvFile("config-supabase.env");

const base = process.env.BASE_URL ?? "http://localhost:3000";
const connectionString = process.env.SUPABASE_POOLER_DB_URL || process.env.SUPABASE_DB_URL;
let token = "";
let orderId = "";

async function request(path, method = "GET", body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, payload: await response.json() };
}

async function api(path, method = "GET", body) {
  const result = await request(path, method, body);
  if (result.status >= 400 || !result.payload.ok) throw new Error(`${path}: ${result.payload.error?.message ?? result.status}`);
  return result.payload.data;
}

function check(label, condition) {
  if (!condition) throw new Error(label);
  console.log(`ok  ${label}`);
}

try {
  const login = await api("/api/mobile/v1/auth/login", "POST", { country: "CG", phone: "061111111", password: "Atelier2026!" });
  token = login.token;
  const clients = await api("/api/mobile/v1/clients?page=1&pageSize=1");
  check("client de test disponible", Boolean(clients.items[0]?.id));
  const created = await api("/api/mobile/v1/orders", "POST", {
    clientId: clients.items[0].id,
    orderTotalAmount: 2500,
    items: [
      { category: "Robe test", description: "Cloture mobile", workType: "creation", quantity: 1, unitPriceAmount: 0 },
      { category: "Veste test", description: "Cloture mobile", workType: "retouche", quantity: 1, unitPriceAmount: 0 },
    ],
  });
  orderId = created.orderId;
  check("commande de test creee", Boolean(orderId && created.order.items.length === 2));

  const path = `/api/mobile/v1/orders/${orderId}/close`;
  const missingConfirmation = await request(path, "POST", { articlesHandedOver: true });
  check("double confirmation obligatoire", missingConfirmation.status === 400);
  const unpaid = await request(path, "POST", { articlesHandedOver: true, paymentConfirmed: true });
  check("solde non encaisse bloque la cloture", unpaid.status === 409);
  const before = await api(`/api/mobile/v1/orders/${orderId}`);
  check("aucun article remis apres refus", before.items.every((item) => item.status !== "remis"));

  await api("/api/mobile/v1/payments/record", "POST", {
    orderId, amount: 2500, method: "cash", effectiveDate: new Date().toISOString().slice(0, 10),
    idempotencyKey: `test-close:${orderId}`,
  });
  const closed = await api(path, "POST", { articlesHandedOver: true, paymentConfirmed: true });
  check("cloture reussie", closed.result === "closed" && closed.order.state === "remise");
  check("tous les articles remis", closed.order.items.every((item) => item.status === "remis"));
  check("solde nul", closed.order.balance?.remainingDue.amount === 0);
  const again = await api(path, "POST", { articlesHandedOver: true, paymentConfirmed: true });
  check("cloture idempotente", again.result === "already_closed");
} finally {
  if (connectionString && orderId) {
    const db = new pg.Client({ connectionString, ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : undefined });
    await db.connect();
    try {
      await db.query("begin");
      await db.query("delete from public.audit_log where entity_id=$1 or entity_id in (select id from public.order_items where order_id=$1) or entity_id in (select id from public.financial_movements where order_id=$1)", [orderId]);
      await db.query("delete from public.financial_movements where order_id=$1", [orderId]);
      await db.query("delete from public.order_items where order_id=$1", [orderId]);
      await db.query("delete from public.orders where id=$1", [orderId]);
      await db.query("commit");
    } catch (error) {
      await db.query("rollback");
      throw error;
    } finally {
      await db.end();
    }
  }
}
