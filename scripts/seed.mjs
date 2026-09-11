/**
 * Seed the development MongoDB database.
 *
 *   node scripts/seed.mjs
 *   (or: npm run db:seed)
 *
 * Creates staff accounts, public content, offers, platform payments and two
 * demo workshops with realistic clients, measurements, orders and payments.
 * The database is intentionally replaced to keep local demos deterministic.
 */

import { MongoClient } from "mongodb";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";

if (!process.env.MONGODB_URI) process.loadEnvFile("atlas-credentials.env");
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI est absent.");

const mongo = new MongoClient(process.env.MONGODB_URI);
await mongo.connect();

const databaseName = process.env.MONGODB_DB ?? "fileo";
const db = mongo.db(databaseName);
await db.dropDatabase();

const collections = new Map();
const ids = {
  users: {},
  workshops: {},
  plans: {},
  subscriptions: {},
  clients: {},
  orders: {},
};

const now = () => new Date().toISOString();
const day = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};
const isoDaysAgo = (offset = 0) => `${day(-offset)}T09:00:00.000Z`;
const phoneSearch = (phone) => (phone ? phone.replace(/\D/g, "") : null);

/** Mirrors hashPassword() in src/lib/auth/password.ts. */
function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function push(collection, row) {
  if (!collections.has(collection)) collections.set(collection, []);
  collections.get(collection).push(row);
  return row.id;
}

function user(key, row) {
  const id = randomUUID();
  const { password, ...userRow } = row;
  ids.users[key] = id;
  push("users", {
    id,
    phone_verified_at: now(),
    status: "active",
    platform_roles: "[]",
    created_at: now(),
    updated_at: now(),
    ...userRow,
    password_hash: hashPassword(password),
  });
  return id;
}

function workshop(key, row) {
  const id = randomUUID();
  ids.workshops[key] = id;
  push("workshops", {
    id,
    receipt_footer: "Merci de votre confiance.",
    status: "active",
    created_at: now(),
    updated_at: now(),
    ...row,
  });
  return id;
}

function membership(workshopId, userId, row = {}) {
  push("memberships", {
    id: randomUUID(),
    workshop_id: workshopId,
    user_id: userId,
    role: "collaborator",
    can_view_money: 0,
    status: "active",
    created_at: now(),
    updated_at: now(),
    ...row,
  });
}

function plan(key, row) {
  const id = randomUUID();
  ids.plans[key] = id;
  push("plans", {
    id,
    period_months: 1,
    version: 1,
    effective_from: day(-30),
    archived_at: null,
    created_at: now(),
    ...row,
  });
  return id;
}

function subscription(key, row) {
  const id = randomUUID();
  ids.subscriptions[key] = id;
  push("subscriptions", {
    id,
    status: "trial",
    trial_ends_at: day(14),
    current_period_end: day(14),
    grace_ends_at: null,
    created_at: now(),
    updated_at: now(),
    row_version: 1,
    ...row,
  });
  return id;
}

function client(key, row) {
  const id = randomUUID();
  ids.clients[key] = id;
  push("clients", {
    id,
    phone_search: phoneSearch(row.phone_e164),
    other_contact: null,
    guardian_name: null,
    guardian_phone: null,
    notes: null,
    archived_at: null,
    deleted_at: null,
    created_at: now(),
    updated_at: now(),
    row_version: 1,
    ...row,
  });
  return id;
}

function measurement(row) {
  const { values, ...measurementRow } = row;
  push("measurement_records", {
    id: randomUUID(),
    template_id: null,
    unit: "cm",
    notes: null,
    created_at: now(),
    ...measurementRow,
    values_json: JSON.stringify(values),
  });
}

function order(key, row) {
  const id = randomUUID();
  ids.orders[key] = id;
  push("orders", {
    id,
    discount_amount: 0,
    discount_reason: null,
    instructions: null,
    promised_date: null,
    fitting_date: null,
    cancelled_at: null,
    created_at: now(),
    updated_at: now(),
    row_version: 1,
    ...row,
  });
  return id;
}

function orderItem(row) {
  push("order_items", {
    id: randomUUID(),
    quantity: 1,
    status: "a_realiser",
    due_date: null,
    delivered_quantity: 0,
    delivered_at: null,
    assignee_user_id: null,
    measurement_snapshot: null,
    cancelled_at: null,
    sort_order: 0,
    created_at: now(),
    updated_at: now(),
    row_version: 1,
    ...row,
  });
}

function movement(row) {
  push("financial_movements", {
    id: randomUUID(),
    kind: "payment",
    method: "cash",
    reference: null,
    effective_date: day(0),
    status: "confirmed",
    idempotency_key: randomUUID(),
    created_at: now(),
    ...row,
  });
}

function audit(row) {
  push("audit_log", {
    id: randomUUID(),
    workshop_id: null,
    actor_user_id: null,
    entity_id: null,
    reason: null,
    before: null,
    after: null,
    created_at: now(),
    ...row,
  });
}

function content(row) {
  push("contents", {
    id: randomUUID(),
    locale: "fr",
    summary: null,
    body: null,
    task_key: null,
    duration_seconds: null,
    transcript: null,
    video_url: null,
    status: "published",
    published_at: now(),
    created_by: ids.users.admin,
    created_at: now(),
    updated_at: now(),
    ...row,
  });
}

console.log(`Base MongoDB : ${databaseName}`);

// --- Accounts ---------------------------------------------------------------
user("admin", {
  full_name: "Equipe Fileo",
  phone_e164: "+242060000001",
  email: "admin@fileo.app",
  password: "Fileo2026!",
  platform_roles: JSON.stringify(["admin", "support", "content_manager"]),
});
user("ownerElegance", {
  full_name: "Amelie Nkouka",
  phone_e164: "+242061111111",
  email: "amelie@atelier-elegance.cg",
  password: "Atelier2026!",
});
user("collabElegance", {
  full_name: "Serge Mabiala",
  phone_e164: "+242062222222",
  email: "serge@atelier-elegance.cg",
  password: "Atelier2026!",
});
user("tailorElegance", {
  full_name: "Prisca Mavoungou",
  phone_e164: "+242063333333",
  email: "prisca@atelier-elegance.cg",
  password: "Atelier2026!",
});
user("ownerKiese", {
  full_name: "Mireille Bintsamou",
  phone_e164: "+242065555555",
  email: "mireille@kiese-mode.cg",
  password: "Atelier2026!",
});
user("collabKiese", {
  full_name: "Junior Ondongo",
  phone_e164: "+242066666666",
  email: "junior@kiese-mode.cg",
  password: "Atelier2026!",
});

// --- Workshops, offers and subscriptions -----------------------------------
const eleganceId = workshop("elegance", {
  name: "Atelier Elegance (demo)",
  owner_user_id: ids.users.ownerElegance,
  country_code: "CG",
  city: "Brazzaville",
  phone_e164: "+242061111111",
  currency: "XAF",
  timezone: "Africa/Brazzaville",
});
const kieseId = workshop("kiese", {
  name: "Kiese Mode (demo)",
  owner_user_id: ids.users.ownerKiese,
  country_code: "CG",
  city: "Pointe-Noire",
  phone_e164: "+242065555555",
  currency: "XAF",
  timezone: "Africa/Brazzaville",
});

membership(eleganceId, ids.users.ownerElegance, { role: "owner", can_view_money: 1 });
membership(eleganceId, ids.users.collabElegance, { can_view_money: 0 });
membership(eleganceId, ids.users.tailorElegance, { can_view_money: 1 });
membership(kieseId, ids.users.ownerKiese, { role: "owner", can_view_money: 1 });
membership(kieseId, ids.users.collabKiese, { can_view_money: 0 });

plan("essentiel", {
  code: "essentiel",
  label: "Fileo Essentiel",
  country_code: "CG",
  currency: "XAF",
  price_amount: 2500,
  limits_json: JSON.stringify({ members: 5, storageMb: 2000, orders: null }),
});
plan("pro", {
  code: "pro",
  label: "Fileo Pro",
  country_code: "CG",
  currency: "XAF",
  price_amount: 5000,
  limits_json: JSON.stringify({ members: 10, storageMb: 5000, orders: null }),
});
plan("atelier_plus", {
  code: "atelier_plus",
  label: "Fileo Atelier Plus",
  country_code: "CG",
  currency: "XAF",
  price_amount: 8500,
  limits_json: JSON.stringify({ members: 25, storageMb: 12000, orders: null }),
});

subscription("elegance", {
  workshop_id: eleganceId,
  plan_id: ids.plans.pro,
  status: "active",
  trial_ends_at: day(-16),
  current_period_end: day(18),
});
subscription("kiese", {
  workshop_id: kieseId,
  plan_id: ids.plans.essentiel,
  status: "trial",
  trial_ends_at: day(6),
  current_period_end: day(6),
});

// --- Clients ----------------------------------------------------------------
[
  ["loemba", "Chancelvie Loemba", "+242064000001", "Cliente VIP, prefere les essayages le matin."],
  ["bouiti", "Grace Bouiti", "+242064000002", "A prevenir par WhatsApp."],
  ["samba", "Rodrigue Samba", null, "Contact via son frere Serge."],
  ["makaya", "Nadine Makaya", "+242064000004", "Mariage civil prevu ce mois-ci."],
  ["matondo", "Jean Matondo", "+242064000005", "Costumes de travail."],
  ["ngoma", "Sarah Ngoma", "+242064000006", "Acompte souvent par mobile money."],
  ["diafouka", "Cynthia Diafouka", "+242064000007", "Archivee apres remise complete.", day(-1)],
  ["massengo", "Kevin Massengo", "+242064000008", "Client supprime pour verifier les filtres.", null, day(-2)],
].forEach(([key, name, phone, notes, archivedAt = null, deletedAt = null], index) => {
  client(key, {
    workshop_id: eleganceId,
    display_name: name,
    phone_e164: phone,
    notes,
    archived_at: archivedAt,
    deleted_at: deletedAt,
    created_by: ids.users.ownerElegance,
    created_at: isoDaysAgo(45 - index),
    updated_at: now(),
  });
});

[
  ["mabiala", "Ariane Mabiala", "+242067000001", "Robes enfants et uniformes."],
  ["nlandu", "Brice Nlandu", "+242067000002", "Prefere recevoir les recus par SMS."],
  ["mpemba", "Clarisse Mpemba", "+242067000003", "A une retouche en attente."],
  ["itoua", "Gael Itoua", null, "Commande corporate."],
].forEach(([key, name, phone, notes], index) => {
  client(key, {
    workshop_id: kieseId,
    display_name: name,
    phone_e164: phone,
    notes,
    created_by: ids.users.ownerKiese,
    created_at: isoDaysAgo(25 - index),
    updated_at: now(),
  });
});

measurement({
  workshop_id: eleganceId,
  client_id: ids.clients.loemba,
  category: "robe",
  version: 1,
  values: { epaules: 38, poitrine: 92, taille: 74, bassin: 98, longueur_totale: 132 },
  notes: "Mesures prises avant retouche.",
  taken_at: day(-40),
  created_by: ids.users.ownerElegance,
});
measurement({
  workshop_id: eleganceId,
  client_id: ids.clients.loemba,
  category: "robe",
  version: 2,
  values: { epaules: 38, poitrine: 93, taille: 75, bassin: 99, longueur_totale: 134 },
  notes: "Nouvelle longueur demandee.",
  taken_at: day(-7),
  created_by: ids.users.tailorElegance,
});
measurement({
  workshop_id: eleganceId,
  client_id: ids.clients.matondo,
  category: "costume",
  version: 1,
  values: { epaules: 46, poitrine: 104, taille: 92, manche: 64, pantalon: 108 },
  taken_at: day(-12),
  created_by: ids.users.ownerElegance,
});
measurement({
  workshop_id: kieseId,
  client_id: ids.clients.mabiala,
  category: "enfant",
  version: 1,
  values: { poitrine: 62, taille: 58, longueur_totale: 72 },
  taken_at: day(-5),
  created_by: ids.users.ownerKiese,
});

// --- Orders and workshop payments ------------------------------------------
const orderSpecs = [
  {
    key: "cmd0001",
    workshop_id: eleganceId,
    client_id: ids.clients.loemba,
    reference: "CMD-0001",
    currency: "XAF",
    instructions: "Tissu wax fourni par la cliente.",
    promised_date: day(3),
    fitting_date: day(1),
    created_by: ids.users.ownerElegance,
    created_at: isoDaysAgo(9),
    items: [
      { category: "robe", description: "Robe de ceremonie", quantity: 1, unit_price_amount: 20000, status: "en_cours", due_date: day(3), assignee_user_id: ids.users.tailorElegance },
    ],
    payments: [
      { amount: 5000, method: "cash", effective_date: day(-5), idempotency_key: "seed-pay-cmd0001-1" },
      { amount: 7500, method: "mobile_money", effective_date: day(-1), idempotency_key: "seed-pay-cmd0001-2" },
    ],
  },
  {
    key: "cmd0002",
    workshop_id: eleganceId,
    client_id: ids.clients.bouiti,
    reference: "CMD-0002",
    currency: "XAF",
    promised_date: day(-4),
    created_by: ids.users.ownerElegance,
    created_at: isoDaysAgo(14),
    items: [
      { category: "ensemble", description: "Ensemble pagne 2 pieces", quantity: 2, unit_price_amount: 15000, status: "pret", due_date: day(-4), assignee_user_id: ids.users.collabElegance },
    ],
    payments: [{ amount: 10000, method: "cash", effective_date: day(-10), idempotency_key: "seed-pay-cmd0002-1" }],
  },
  {
    key: "cmd0003",
    workshop_id: eleganceId,
    client_id: ids.clients.samba,
    reference: "CMD-0003",
    currency: "XAF",
    discount_amount: 2500,
    discount_reason: "Geste commercial fidele client",
    promised_date: day(0),
    created_by: ids.users.ownerElegance,
    created_at: isoDaysAgo(4),
    items: [
      { category: "chemise", description: "Chemises manches longues", quantity: 3, unit_price_amount: 7000, status: "a_essayer", due_date: day(0), assignee_user_id: ids.users.tailorElegance },
      { category: "pantalon", description: "Pantalon droit", quantity: 1, unit_price_amount: 9000, status: "a_realiser", due_date: day(2), assignee_user_id: ids.users.collabElegance, sort_order: 1 },
    ],
    payments: [{ amount: 15000, method: "mobile_money", effective_date: day(-3), idempotency_key: "seed-pay-cmd0003-1" }],
  },
  {
    key: "cmd0004",
    workshop_id: eleganceId,
    client_id: ids.clients.makaya,
    reference: "CMD-0004",
    currency: "XAF",
    promised_date: day(8),
    created_by: ids.users.ownerElegance,
    created_at: isoDaysAgo(2),
    items: [
      { category: "robe", description: "Robe civile blanche", quantity: 1, unit_price_amount: 45000, status: "a_realiser", due_date: day(8), assignee_user_id: ids.users.tailorElegance },
      { category: "voile", description: "Voile court", quantity: 1, unit_price_amount: 8000, status: "a_realiser", due_date: day(8), assignee_user_id: ids.users.tailorElegance, sort_order: 1 },
    ],
    payments: [{ amount: 25000, method: "bank_transfer", effective_date: day(-1), idempotency_key: "seed-pay-cmd0004-1" }],
  },
  {
    key: "cmd0005",
    workshop_id: eleganceId,
    client_id: ids.clients.matondo,
    reference: "CMD-0005",
    currency: "XAF",
    promised_date: day(-1),
    created_by: ids.users.ownerElegance,
    created_at: isoDaysAgo(20),
    items: [
      { category: "costume", description: "Costume complet bleu nuit", quantity: 1, unit_price_amount: 65000, status: "remis", due_date: day(-2), delivered_quantity: 1, delivered_at: now(), assignee_user_id: ids.users.tailorElegance },
    ],
    payments: [
      { amount: 65000, method: "cash", effective_date: day(-2), idempotency_key: "seed-pay-cmd0005-1" },
    ],
  },
  {
    key: "cmd0006",
    workshop_id: eleganceId,
    client_id: ids.clients.ngoma,
    reference: "CMD-0006",
    currency: "XAF",
    promised_date: day(12),
    cancelled_at: now(),
    created_by: ids.users.ownerElegance,
    created_at: isoDaysAgo(6),
    items: [
      { category: "jupe", description: "Jupe tailleur annulee", quantity: 1, unit_price_amount: 12000, status: "annule", due_date: day(12), cancelled_at: now() },
    ],
    payments: [
      { amount: 6000, method: "mobile_money", effective_date: day(-5), idempotency_key: "seed-pay-cmd0006-1" },
      { kind: "refund", amount: 6000, method: "mobile_money", effective_date: day(-4), idempotency_key: "seed-refund-cmd0006-1" },
    ],
  },
  {
    key: "kie001",
    workshop_id: kieseId,
    client_id: ids.clients.mabiala,
    reference: "KIE-0001",
    currency: "XAF",
    promised_date: day(5),
    created_by: ids.users.ownerKiese,
    created_at: isoDaysAgo(7),
    items: [
      { category: "uniforme", description: "Uniformes ecoliers", quantity: 4, unit_price_amount: 4500, status: "en_cours", due_date: day(5), assignee_user_id: ids.users.collabKiese },
    ],
    payments: [{ amount: 9000, method: "cash", effective_date: day(-6), idempotency_key: "seed-pay-kie001-1" }],
  },
  {
    key: "kie002",
    workshop_id: kieseId,
    client_id: ids.clients.nlandu,
    reference: "KIE-0002",
    currency: "XAF",
    promised_date: day(-2),
    created_by: ids.users.ownerKiese,
    created_at: isoDaysAgo(13),
    items: [
      { category: "retouche", description: "Retouche veste", quantity: 1, unit_price_amount: 6000, status: "pret", due_date: day(-2), assignee_user_id: ids.users.ownerKiese },
    ],
    payments: [{ amount: 6000, method: "mobile_money", effective_date: day(-11), idempotency_key: "seed-pay-kie002-1" }],
  },
];

for (const spec of orderSpecs) {
  const orderId = order(spec.key, {
    workshop_id: spec.workshop_id,
    client_id: spec.client_id,
    reference: spec.reference,
    currency: spec.currency,
    discount_amount: spec.discount_amount ?? 0,
    discount_reason: spec.discount_reason ?? null,
    instructions: spec.instructions ?? null,
    promised_date: spec.promised_date,
    fitting_date: spec.fitting_date ?? null,
    cancelled_at: spec.cancelled_at ?? null,
    created_by: spec.created_by,
    created_at: spec.created_at,
    updated_at: now(),
  });

  for (const [index, item] of spec.items.entries()) {
    orderItem({
      workshop_id: spec.workshop_id,
      order_id: orderId,
      currency: spec.currency,
      sort_order: index,
      created_at: spec.created_at,
      updated_at: now(),
      ...item,
    });
  }

  for (const payment of spec.payments ?? []) {
    movement({
      workshop_id: spec.workshop_id,
      order_id: orderId,
      currency: spec.currency,
      created_by: spec.created_by,
      reference: `${spec.reference}-${payment.kind === "refund" ? "REM" : "PAY"}`,
      ...payment,
    });
  }
}

push("order_date_changes", {
  id: randomUUID(),
  workshop_id: eleganceId,
  order_id: ids.orders.cmd0002,
  order_item_id: collections.get("order_items").find((item) => item.order_id === ids.orders.cmd0002).id,
  previous_due_date: day(-7),
  new_due_date: day(-4),
  reason: "Cliente indisponible au premier essayage.",
  changed_by: ids.users.ownerElegance,
  changed_at: isoDaysAgo(5),
});

// --- Platform payments, tickets and audit ----------------------------------
push("platform_payments", {
  id: randomUUID(),
  workshop_id: eleganceId,
  subscription_id: ids.subscriptions.elegance,
  amount: 5000,
  currency: "XAF",
  channel: "mobile_money",
  external_reference: "MTN-VAL-202609",
  status: "validated",
  idempotency_key: "platform-elegance-2026-09",
  declared_at: day(-12),
  reviewed_at: day(-11),
  reviewed_by: ids.users.admin,
  review_note: "Reglement valide depuis le seed.",
});
push("platform_payments", {
  id: randomUUID(),
  workshop_id: kieseId,
  subscription_id: ids.subscriptions.kiese,
  amount: 2500,
  currency: "XAF",
  channel: "airtel_money",
  external_reference: "AIR-PENDING-202609",
  status: "declared",
  idempotency_key: "platform-kiese-2026-09",
  declared_at: day(-1),
  reviewed_at: null,
  reviewed_by: null,
  review_note: null,
});

push("tickets", {
  id: randomUUID(),
  workshop_id: eleganceId,
  requester_user_id: ids.users.ownerElegance,
  requester_name: "Amelie Nkouka",
  requester_contact: "+242061111111",
  category: "billing",
  subject: "Recu de renouvellement",
  body: "Merci de renvoyer le recu du dernier paiement.",
  status: "open",
  assignee_user_id: ids.users.admin,
  created_at: isoDaysAgo(2),
  updated_at: isoDaysAgo(2),
});
push("tickets", {
  id: randomUUID(),
  workshop_id: kieseId,
  requester_user_id: ids.users.ownerKiese,
  requester_name: "Mireille Bintsamou",
  requester_contact: "+242065555555",
  category: "support",
  subject: "Invitation collaborateur",
  body: "Besoin d'aide pour inviter un second collaborateur.",
  status: "resolved",
  assignee_user_id: ids.users.admin,
  created_at: isoDaysAgo(10),
  updated_at: isoDaysAgo(8),
});

audit({
  workshop_id: eleganceId,
  actor_user_id: ids.users.ownerElegance,
  action: "seed.demo.created",
  entity_kind: "workshop",
  entity_id: eleganceId,
  after: { name: "Atelier Elegance (demo)" },
});
audit({
  workshop_id: kieseId,
  actor_user_id: ids.users.ownerKiese,
  action: "seed.demo.created",
  entity_kind: "workshop",
  entity_id: kieseId,
  after: { name: "Kiese Mode (demo)" },
});

// --- Public content ---------------------------------------------------------
[
  ["essai-gratuit", "Comment fonctionne la periode d'essai ?", "L'essai dure 14 jours a compter de la creation de l'atelier. Aucun moyen de paiement n'est demande pour demarrer."],
  ["sans-reseau", "Puis-je travailler sans reseau ?", "L'application mobile permet de consulter et d'enregistrer les operations essentielles hors connexion, puis de les synchroniser au retour du reseau."],
  ["client-compte", "Mes clients doivent-ils creer un compte ?", "Non. Le client final n'a besoin ni de compte ni d'application."],
  ["droits-financiers", "Puis-je masquer les prix a certains collaborateurs ?", "Oui. Les droits financiers se reglent par membre afin que les collaborateurs sans autorisation ne voient ni prix ni encaissements."],
  ["donnees-securisees", "Ou sont stockees les donnees ?", "Les donnees applicatives sont stockees dans MongoDB Atlas, avec une separation par atelier et des index d'integrite."],
].forEach(([slug, title, body], index) => content({ kind: "faq", slug, title, body, sort_order: index + 1 }));

[
  ["creer-son-atelier", "Creer son atelier", "onboarding", 45, "Renseignez le nom de l'atelier, le pays, la devise, puis validez."],
  ["ajouter-un-client", "Ajouter un client", "clients", 40, "Depuis Clients, appuyez sur Ajouter un client et saisissez au minimum un nom."],
  ["prendre-les-mesures", "Versionner des mesures", "measurements", 55, "Ouvrez la fiche client, ajoutez un releve et conservez l'historique des versions."],
  ["creer-commande", "Creer une commande", "orders", 60, "Choisissez le client, ajoutez les pieces, les dates et les consignes d'atelier."],
  ["enregistrer-un-acompte", "Enregistrer un acompte", "payments", 50, "Ouvrez la commande, choisissez Enregistrer un encaissement puis saisissez le montant recu."],
].forEach(([slug, title, task_key, duration_seconds, transcript], index) => {
  content({ kind: "tutorial", slug, title, task_key, duration_seconds, transcript, sort_order: index + 1 });
});

[
  {
    slug: "ouverture-du-pilote",
    title: "Ouverture du pilote a Brazzaville",
    summary: "Les premiers ateliers rejoignent Fileo pour valider les parcours sur le terrain.",
    body: "Le pilote demarre avec un nombre limite d'ateliers afin de mesurer l'usage reel avant l'ouverture commerciale.",
  },
  {
    slug: "suivi-des-encaissements",
    title: "Nouveau suivi des encaissements",
    summary: "Les acomptes, soldes et remboursements sont maintenant visibles depuis la commande.",
    body: "Cette mise a jour renforce le controle financier sans exposer les montants aux collaborateurs non autorises.",
  },
].forEach((row, index) => content({ kind: "news", sort_order: index + 1, ...row }));

// --- Persist ----------------------------------------------------------------
for (const [name, rows] of collections.entries()) {
  if (rows.length > 0) {
    await db.collection(name).insertMany(rows, { ordered: true });
    console.log(`${name.padEnd(24)} ${rows.length}`);
  }
}

await Promise.all([
  db.collection("users").createIndex({ id: 1 }, { unique: true }),
  db.collection("users").createIndex({ phone_e164: 1 }, { unique: true }),
  db.collection("sessions").createIndex({ id: 1 }, { unique: true }),
  db.collection("sessions").createIndex({ token_hash: 1 }, { unique: true }),
  db.collection("sessions").createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }),
  db.collection("workshops").createIndex({ id: 1 }, { unique: true }),
  db.collection("memberships").createIndex({ id: 1 }, { unique: true }),
  db.collection("memberships").createIndex({ workshop_id: 1, user_id: 1 }, { unique: true }),
  db.collection("clients").createIndex({ id: 1 }, { unique: true }),
  db.collection("clients").createIndex({ workshop_id: 1, deleted_at: 1, archived_at: 1 }),
  db.collection("clients").createIndex({ workshop_id: 1, phone_search: 1 }),
  db.collection("measurement_records").createIndex({ id: 1 }, { unique: true }),
  db.collection("orders").createIndex({ id: 1 }, { unique: true }),
  db.collection("orders").createIndex({ workshop_id: 1, reference: 1 }, { unique: true }),
  db.collection("order_items").createIndex({ id: 1 }, { unique: true }),
  db.collection("order_items").createIndex({ workshop_id: 1, due_date: 1, status: 1 }),
  db.collection("order_date_changes").createIndex({ id: 1 }, { unique: true }),
  db.collection("financial_movements").createIndex({ id: 1 }, { unique: true }),
  db.collection("financial_movements").createIndex(
    { workshop_id: 1, idempotency_key: 1 },
    { unique: true, partialFilterExpression: { idempotency_key: { $type: "string" } } },
  ),
  db.collection("plans").createIndex({ id: 1 }, { unique: true }),
  db.collection("plans").createIndex({ code: 1, version: 1 }, { unique: true }),
  db.collection("subscriptions").createIndex({ id: 1 }, { unique: true }),
  db.collection("platform_payments").createIndex({ id: 1 }, { unique: true }),
  db.collection("platform_payments").createIndex(
    { idempotency_key: 1 },
    { unique: true, partialFilterExpression: { idempotency_key: { $type: "string" } } },
  ),
  db.collection("contents").createIndex({ id: 1 }, { unique: true }),
  db.collection("contents").createIndex({ kind: 1, slug: 1, locale: 1 }, { unique: true }),
  db.collection("tickets").createIndex({ id: 1 }, { unique: true }),
  db.collection("audit_log").createIndex({ id: 1 }, { unique: true }),
]);

console.log(`
Jeu de donnees cree.

  Back-office   +242 06 000 00 01 / Fileo2026!
  Responsable   +242 06 111 11 11 / Atelier2026!
  Collaborateur +242 06 222 22 22 / Atelier2026!   (sans droit financier)
  Couturiere    +242 06 333 33 33 / Atelier2026!   (avec droit financier)
  Atelier 2     +242 06 555 55 55 / Atelier2026!

Le collaborateur sert a verifier REC-12 : aucun prix ne doit lui etre transmis.
`);

await mongo.close();
