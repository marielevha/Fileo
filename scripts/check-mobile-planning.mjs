import pg from "pg";

process.loadEnvFile("config-supabase.env");

const base = process.env.BASE_URL ?? "http://localhost:3000";
const connectionString = process.env.SUPABASE_POOLER_DB_URL || process.env.SUPABASE_DB_URL;
let token = "";
let orderId = "";
let itemId = "";

async function request(path, options = {}) {
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
  return { response, payload };
}

async function api(path, options = {}) {
  const result = await request(path, options);
  if (!result.response.ok || !result.payload.ok) {
    throw new Error(`${path}: ${result.payload.error?.message ?? result.response.status}`);
  }
  return result.payload.data;
}

function check(label, condition) {
  if (!condition) throw new Error(label);
  console.log(`ok  ${label}`);
}

try {
  const login = await api("/api/mobile/v1/auth/login", {
    method: "POST",
    body: { country: "CG", phone: "061111111", password: "Atelier2026!" },
  });
  token = login.token;

  const clients = await api("/api/mobile/v1/clients?page=1&pageSize=10");
  check("client de test disponible", Boolean(clients.items[0]?.id));

  const created = await api("/api/mobile/v1/orders", {
    method: "POST",
    body: {
      clientId: clients.items[0].id,
      promisedDate: "2026-12-20",
      instructions: "Commande temporaire test planning mobile",
      items: [{
        category: "Test planning",
        description: "Validation affectation et replanification",
        workType: "creation",
        quantity: 1,
        unitPriceAmount: 2500,
        dueDate: "2026-12-19",
      }],
    },
  });
  orderId = created.orderId;
  itemId = created.order.items[0].id;

  const planning = await api(`/api/mobile/v1/planning?q=${encodeURIComponent(created.reference)}&status=all`);
  const item = planning.items.find((entry) => entry.item_id === itemId);
  const member = planning.members[0];
  check("commande visible dans le planning", Boolean(item));
  check("collaborateur disponible", Boolean(member?.id));

  await api(`/api/mobile/v1/planning/${itemId}`, {
    method: "PATCH",
    body: {
      status: "en_cours",
      dueDate: "2026-12-21",
      assigneeId: member.id,
      reason: "Replanification du test mobile",
      rowVersion: item.row_version,
    },
  });

  const updatedPlanning = await api(`/api/mobile/v1/planning?q=${encodeURIComponent(created.reference)}&status=en_cours&assignee=${member.id}`);
  const updated = updatedPlanning.items.find((entry) => entry.item_id === itemId);
  check("statut modifie", updated?.status === "en_cours");
  check("echeance modifiee", updated?.explicit_due_date === "2026-12-21");
  check("collaborateur affecte", updated?.assignee_user_id === member.id);

  const conflict = await request(`/api/mobile/v1/planning/${itemId}`, {
    method: "PATCH",
    body: {
      status: "pret",
      dueDate: "2026-12-21",
      assigneeId: member.id,
      reason: "Version volontairement obsolete",
      rowVersion: item.row_version,
    },
  });
  check("conflit de version detecte", conflict.response.status === 409 && conflict.payload.error?.code === "conflict");

  const invalidFilter = await request("/api/mobile/v1/planning?status=inconnu");
  check("filtre invalide refuse", invalidFilter.response.status === 400);
} finally {
  if (connectionString && orderId) {
    const client = new pg.Client({
      connectionString,
      ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
    });
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
