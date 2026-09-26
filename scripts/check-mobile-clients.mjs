import pg from "pg";

process.loadEnvFile("config-supabase.env");

const base = process.env.BASE_URL ?? "http://localhost:3000";
const connectionString = process.env.SUPABASE_POOLER_DB_URL || process.env.SUPABASE_DB_URL;
let token = "";
let clientId = "";
let measurementId = "";

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

async function upload(path, filename) {
  const form = new FormData();
  form.append("files", new File([new Uint8Array([137,80,78,71,13,10,26,10])], filename, { type: "image/png" }));
  const response = await fetch(`${base}${path}`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: form });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(`${path}: ${payload.error?.message ?? response.status}`);
  return payload.data;
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
  const unique = Date.now();
  const alphaSuffix = String(unique).split("").map((digit) => String.fromCharCode(65 + Number(digit))).join("");
  const name = `Denver ${alphaSuffix}`;

  const created = await api("/api/mobile/v1/clients", {
    method: "POST",
    body: {
      displayName: name,
      phone: "06 123 45 67",
      otherContact: "contact test",
      guardianName: "Responsable test",
      guardianPhone: "06 987 65 43",
      notes: "Créé par check:mobile-clients",
    },
  });
  clientId = created.id;
  check("creation client", Boolean(clientId));

  const listed = await api(`/api/mobile/v1/clients?q=${encodeURIComponent(name)}&page=1&pageSize=10&sort=name&direction=asc`);
  check("recherche et pagination", listed.total === 1 && listed.items[0]?.id === clientId);
  const alphabeticalSearch = await api(`/api/mobile/v1/clients?q=${encodeURIComponent(alphaSuffix)}&page=1&pageSize=10`);
  check("recherche alphabetique exacte", alphabeticalSearch.total === 1 && alphabeticalSearch.items[0]?.id === clientId);

  const detail = await api(`/api/mobile/v1/clients/${clientId}`);
  check("detail client", detail.display_name === name && detail.phone_e164 === "+242061234567");

  const updatedName = `${name} modifié`;
  await api(`/api/mobile/v1/clients/${clientId}`, {
    method: "PATCH",
    body: {
      displayName: updatedName,
      phone: "061234567",
      otherContact: "contact modifié",
      guardianName: "Responsable test",
      guardianPhone: "069876543",
      notes: "Fiche modifiée",
    },
  });
  const updated = await api(`/api/mobile/v1/clients/${clientId}`);
  check("modification client", updated.display_name === updatedName && updated.other_contact === "contact modifié");

  const measurement = await api(`/api/mobile/v1/clients/${clientId}/measurements`, {
    method: "POST",
    body: { category: "Robe", values: { poitrine: 92, taille: 74 }, notes: "Version test", takenAt: "2026-09-20" },
  });
  measurementId = measurement.id;
  const uploaded = await upload(`/api/mobile/v1/clients/${clientId}/measurements/${measurementId}/attachments`, "mensuration-test.png");
  const attachmentId = uploaded.items[0]?.id;
  check("photo de mensuration envoyee", Boolean(attachmentId));
  const measurements = await api(`/api/mobile/v1/clients/${clientId}/measurements`);
  check("mensurations versionnees", measurements.items.some((row) => row.id === measurementId && row.version === 1));
  check("photo rattachee a la bonne version", measurements.items.find((row) => row.id === measurementId)?.attachments?.some((file) => file.id === attachmentId && file.signed_url));
  await api(`/api/mobile/v1/clients/${clientId}/measurements/${measurementId}/attachments/${attachmentId}`, { method: "DELETE" });
  const withoutAttachment = await api(`/api/mobile/v1/clients/${clientId}/measurements`);
  check("photo de mensuration supprimee", !withoutAttachment.items.find((row) => row.id === measurementId)?.attachments?.length);

  await api(`/api/mobile/v1/clients/${clientId}/archive`, { method: "PATCH", body: { archived: true } });
  const activeList = await api(`/api/mobile/v1/clients?q=${encodeURIComponent(updatedName)}`);
  const archivedList = await api(`/api/mobile/v1/clients?q=${encodeURIComponent(updatedName)}&includeArchived=true`);
  check("archivage masque le client actif", !activeList.items.some((row) => row.id === clientId));
  check("client archive consultable", archivedList.items.some((row) => row.id === clientId && row.archived_at));

  await api(`/api/mobile/v1/clients/${clientId}/archive`, { method: "PATCH", body: { archived: false } });
  const restored = await api(`/api/mobile/v1/clients/${clientId}`);
  check("restauration client", restored.archived_at === null);

  await api(`/api/mobile/v1/clients/${clientId}`, { method: "DELETE" });
  const deleted = await request(`/api/mobile/v1/clients/${clientId}`);
  check("suppression logique", deleted.response.status === 404);
} finally {
  if (connectionString && clientId) {
    const db = new pg.Client({ connectionString, ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : undefined });
    await db.connect();
    try {
      await db.query("begin");
      await db.query("delete from public.audit_log where entity_id=$1 or entity_id=$2", [clientId, measurementId || null]);
      await db.query("delete from public.measurement_records where client_id=$1", [clientId]);
      await db.query("delete from public.clients where id=$1", [clientId]);
      await db.query("commit");
    } catch (error) {
      await db.query("rollback");
      throw error;
    } finally {
      await db.end();
    }
  }
}
