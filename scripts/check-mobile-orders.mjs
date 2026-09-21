import pg from "pg";

process.loadEnvFile("config-supabase.env");

const base = process.env.BASE_URL ?? "http://localhost:3000";
const connectionString = process.env.SUPABASE_POOLER_DB_URL || process.env.SUPABASE_DB_URL;
let token = "";
let orderId = "";
let itemId = "";

async function api(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(`${path}: ${payload.error?.message ?? response.status}`);
  return payload.data;
}

async function upload(path, filename) {
  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ files: [{ filename, name: filename, mimeType: "image/jpeg", dataBase64: Buffer.from([255,216,255,217]).toString("base64") }] }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(`${path}: ${payload.error?.message ?? response.status}`);
  return payload.data;
}

function check(label, condition) {
  if (!condition) throw new Error(label);
  console.log(`ok  ${label}`);
}

try {
  const login = await api("/api/mobile/v1/auth/login", { method: "POST", body: { country: "CG", phone: "061111111", password: "Atelier2026!" } });
  token = login.token;
  const clients = await api("/api/mobile/v1/clients?page=1&pageSize=10");
  check("client de test disponible", Boolean(clients.items[0]?.id));

  const created = await api("/api/mobile/v1/orders", {
    method: "POST",
    body: {
      clientId: clients.items[0].id,
      promisedDate: "2026-12-20",
      instructions: "Commande temporaire test mobile",
      orderTotalAmount: 2500,
      items: [{ category: "Test mobile", description: "Validation du parcours commandes", workType: "creation", quantity: 1, unitPriceAmount: 0, dueDate: "2026-12-19" }],
    },
  });
  orderId = created.orderId;
  itemId = created.order.items[0].id;
  check("creation commande", Boolean(orderId && itemId));
  check("montant global applique", created.order.balance?.orderTotal.amount === 2500);

  const detail = await api(`/api/mobile/v1/orders/${orderId}`);
  check("detail commande", detail.order.id === orderId);
  const uploaded = await upload(`/api/mobile/v1/orders/${orderId}/attachments`, "commande-test.png");
  const attachmentId = uploaded.items[0]?.id;
  check("piece jointe commande envoyee en JSON base64", Boolean(attachmentId));
  const withAttachment = await api(`/api/mobile/v1/orders/${orderId}`);
  check("piece jointe commande consultable", withAttachment.attachments.some((file) => file.id === attachmentId && file.signed_url));
  await api(`/api/mobile/v1/orders/${orderId}/attachments/${attachmentId}`, { method: "DELETE" });
  const withoutAttachment = await api(`/api/mobile/v1/orders/${orderId}`);
  check("piece jointe commande supprimee", !withoutAttachment.attachments.some((file) => file.id === attachmentId));

  const updated = await api(`/api/mobile/v1/orders/${orderId}`, { method: "PATCH", body: { action: "update", promisedDate: "2026-12-21", fittingDate: "2026-12-18", instructions: "Consignes modifiees" } });
  check("modification commande", updated.order.promised_date === "2026-12-21");

  await api(`/api/mobile/v1/orders/${orderId}/items/${itemId}`, { method: "PATCH", body: { status: "en_cours", dueDate: "2026-12-19", reason: "Demarrage du test", rowVersion: detail.items[0].row_version } });
  const afterStatus = await api(`/api/mobile/v1/orders/${orderId}`);
  check("transition article", afterStatus.items[0].status === "en_cours");

  const searched = await api(`/api/mobile/v1/orders?q=${encodeURIComponent(created.reference)}&filter=en_cours&page=1&pageSize=10`);
  check("recherche et filtre", searched.items.some((row) => row.order.id === orderId));

  const cancelled = await api(`/api/mobile/v1/orders/${orderId}`, { method: "PATCH", body: { action: "cancel", reason: "Nettoyage du test automatise" } });
  check("annulation commande", cancelled.state === "annulee");
} finally {
  if (connectionString && orderId) {
    const client = new pg.Client({ connectionString, ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : undefined });
    await client.connect();
    try {
      await client.query("begin");
      await client.query("delete from public.order_date_changes where order_id=$1", [orderId]);
      await client.query("delete from public.audit_log where entity_id=$1 or entity_id=$2", [orderId, itemId || null]);
      await client.query("delete from public.financial_movements where order_id=$1", [orderId]);
      await client.query("delete from public.order_items where order_id=$1", [orderId]);
      await client.query("delete from public.orders where id=$1", [orderId]);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      await client.end();
    }
  }
}
