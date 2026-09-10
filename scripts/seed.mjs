/**
 * Seed the development database.
 *
 *   node --experimental-strip-types scripts/seed.mjs
 *   (or: npm run db:seed)
 *
 * Creates the Filéo staff account, the initial plans, published site content
 * and one demo workshop with realistic orders and payments. Demo data is
 * clearly labelled, per §5.1.
 */

import { DatabaseSync } from "node:sqlite";
import { randomUUID, randomBytes, scryptSync } from "node:crypto";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

const DB_PATH = process.env.FILEO_DB_PATH ?? join(process.cwd(), "data", "fileo.db");
const SCHEMA_PATH = join(process.cwd(), "src", "lib", "db", "schema.sql");

mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON;");
db.exec(readFileSync(SCHEMA_PATH, "utf8"));

const now = () => new Date().toISOString();
const day = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

/** Mirrors hashPassword() in src/lib/auth/password.ts. */
function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function insert(table, row) {
  const keys = Object.keys(row);
  const placeholders = keys.map(() => "?").join(", ");
  db.prepare(
    `INSERT OR IGNORE INTO ${table} (${keys.join(", ")}) VALUES (${placeholders})`,
  ).run(...keys.map((k) => row[k]));
}

console.log(`Base : ${DB_PATH}`);

// --- Comptes -----------------------------------------------------
const adminId = randomUUID();
const ownerId = randomUUID();
const collabId = randomUUID();

insert("users", {
  id: adminId,
  full_name: "Équipe Filéo",
  phone_e164: "+242060000001",
  phone_verified_at: now(),
  email: "admin@fileo.app",
  password_hash: hashPassword("Fileo2026!"),
  status: "active",
  platform_roles: JSON.stringify(["admin", "support", "content_manager"]),
  created_at: now(),
  updated_at: now(),
});

insert("users", {
  id: ownerId,
  full_name: "Amélie Nkouka",
  phone_e164: "+242061111111",
  phone_verified_at: now(),
  password_hash: hashPassword("Atelier2026!"),
  status: "active",
  platform_roles: "[]",
  created_at: now(),
  updated_at: now(),
});

insert("users", {
  id: collabId,
  full_name: "Serge Mabiala",
  phone_e164: "+242062222222",
  phone_verified_at: now(),
  password_hash: hashPassword("Atelier2026!"),
  status: "active",
  platform_roles: "[]",
  created_at: now(),
  updated_at: now(),
});

// --- Atelier de démonstration ------------------------------------
const workshopId = randomUUID();

insert("workshops", {
  id: workshopId,
  name: "Atelier Élégance (démo)",
  owner_user_id: ownerId,
  country_code: "CG",
  city: "Brazzaville",
  phone_e164: "+242061111111",
  currency: "XAF",
  timezone: "Africa/Brazzaville",
  receipt_footer: "Merci de votre confiance.",
  status: "active",
  created_at: now(),
  updated_at: now(),
});

insert("memberships", {
  id: randomUUID(),
  workshop_id: workshopId,
  user_id: ownerId,
  role: "owner",
  can_view_money: 1,
  status: "active",
  created_at: now(),
  updated_at: now(),
});

// Collaborateur SANS droit financier : sert à vérifier REC-12.
insert("memberships", {
  id: randomUUID(),
  workshop_id: workshopId,
  user_id: collabId,
  role: "collaborator",
  can_view_money: 0,
  status: "active",
  created_at: now(),
  updated_at: now(),
});

// --- Offres et abonnement ----------------------------------------
const planCgId = randomUUID();
const planCgProId = randomUUID();

insert("plans", {
  id: planCgId,
  code: "essentiel",
  label: "Filéo Essentiel",
  country_code: "CG",
  currency: "XAF",
  price_amount: 2500, // XAF : 0 décimale, donc 2500 et non 250000
  period_months: 1,
  limits_json: JSON.stringify({ members: 5, storageMb: 2000, orders: null }),
  version: 1,
  effective_from: day(-30),
  created_at: now(),
});

insert("plans", {
  id: planCgProId,
  code: "pro",
  label: "Filéo Pro",
  country_code: "CG",
  currency: "XAF",
  price_amount: 5000,
  period_months: 1,
  limits_json: JSON.stringify({ members: 10, storageMb: 5000, orders: null }),
  version: 1,
  effective_from: day(-30),
  created_at: now(),
});

insert("subscriptions", {
  id: randomUUID(),
  workshop_id: workshopId,
  plan_id: planCgId,
  status: "trial",
  trial_ends_at: day(14),
  current_period_end: day(14),
  created_at: now(),
  updated_at: now(),
});

// --- Clients ------------------------------------------------------
const clients = [
  { name: "Chancelvie Loemba", phone: "+242064000001" },
  { name: "Grâce Bouiti", phone: "+242064000002" },
  { name: "Rodrigue Samba", phone: null },
];

const clientIds = clients.map((client) => {
  const id = randomUUID();
  insert("clients", {
    id,
    workshop_id: workshopId,
    display_name: client.name,
    phone_e164: client.phone,
    phone_search: client.phone ? client.phone.replace(/\D/g, "") : null,
    created_by: ownerId,
    created_at: now(),
    updated_at: now(),
  });
  return id;
});

// Relevé de mesures versionné
insert("measurement_records", {
  id: randomUUID(),
  workshop_id: workshopId,
  client_id: clientIds[0],
  category: "robe",
  version: 1,
  values_json: JSON.stringify({
    epaules: 38,
    poitrine: 92,
    taille: 74,
    bassin: 98,
    longueur_totale: 132,
  }),
  unit: "cm",
  taken_at: day(-40),
  created_by: ownerId,
  created_at: now(),
});

// --- Commandes ----------------------------------------------------
// REC-03 : commande à 20 000 XAF, encaissements de 5 000 puis 7 500
// => encaissement net 12 500, reste à payer 7 500.
const orderId = randomUUID();

insert("orders", {
  id: orderId,
  workshop_id: workshopId,
  client_id: clientIds[0],
  reference: "CMD-0001",
  currency: "XAF",
  discount_amount: 0,
  instructions: "Tissu wax fourni par la cliente.",
  promised_date: day(3),
  created_by: ownerId,
  created_at: now(),
  updated_at: now(),
});

insert("order_items", {
  id: randomUUID(),
  workshop_id: workshopId,
  order_id: orderId,
  category: "robe",
  description: "Robe de cérémonie",
  quantity: 1,
  unit_price_amount: 20000,
  currency: "XAF",
  status: "en_cours",
  due_date: day(3),
  sort_order: 0,
  created_at: now(),
  updated_at: now(),
});

for (const [index, amount] of [5000, 7500].entries()) {
  insert("financial_movements", {
    id: randomUUID(),
    workshop_id: workshopId,
    order_id: orderId,
    kind: "payment",
    amount,
    currency: "XAF",
    method: index === 0 ? "cash" : "mobile_money",
    effective_date: day(index === 0 ? -5 : -1),
    status: "confirmed",
    idempotency_key: `seed-pay-${index}`,
    created_by: ownerId,
    created_at: now(),
  });
}

// Commande en retard, pour alimenter l'indicateur du tableau de bord.
const lateOrderId = randomUUID();

insert("orders", {
  id: lateOrderId,
  workshop_id: workshopId,
  client_id: clientIds[1],
  reference: "CMD-0002",
  currency: "XAF",
  promised_date: day(-4),
  created_by: ownerId,
  created_at: now(),
  updated_at: now(),
});

insert("order_items", {
  id: randomUUID(),
  workshop_id: workshopId,
  order_id: lateOrderId,
  category: "ensemble",
  description: "Ensemble pagne 2 pièces",
  quantity: 2,
  unit_price_amount: 15000,
  currency: "XAF",
  status: "pret",
  due_date: day(-4),
  sort_order: 0,
  created_at: now(),
  updated_at: now(),
});

// --- Contenus publics --------------------------------------------
const contents = [
  {
    kind: "faq",
    slug: "essai-gratuit",
    title: "Comment fonctionne la période d'essai ?",
    body: "L'essai dure 14 jours à compter de la création de l'atelier. Aucun moyen de paiement n'est demandé pour démarrer.",
    sort_order: 1,
  },
  {
    kind: "faq",
    slug: "sans-reseau",
    title: "Puis-je travailler sans réseau ?",
    body: "L'application mobile permet de consulter et d'enregistrer les opérations essentielles hors connexion, puis de les synchroniser au retour du réseau.",
    sort_order: 2,
  },
  {
    kind: "faq",
    slug: "client-compte",
    title: "Mes clients doivent-ils créer un compte ?",
    body: "Non. Le client final n'a besoin ni de compte ni d'application.",
    sort_order: 3,
  },
  {
    kind: "tutorial",
    slug: "creer-son-atelier",
    title: "Créer son atelier",
    task_key: "onboarding",
    duration_seconds: 45,
    transcript: "Renseignez le nom de l'atelier, le pays, la devise, puis validez.",
    sort_order: 1,
  },
  {
    kind: "tutorial",
    slug: "ajouter-un-client",
    title: "Ajouter un client",
    task_key: "clients",
    duration_seconds: 40,
    transcript: "Depuis Clients, appuyez sur Ajouter un client et saisissez au minimum un nom.",
    sort_order: 2,
  },
  {
    kind: "tutorial",
    slug: "enregistrer-un-acompte",
    title: "Enregistrer un acompte",
    task_key: "paiements",
    duration_seconds: 50,
    transcript: "Ouvrez la commande, choisissez Enregistrer un encaissement puis saisissez le montant reçu.",
    sort_order: 3,
  },
  {
    kind: "news",
    slug: "ouverture-du-pilote",
    title: "Ouverture du pilote à Brazzaville",
    summary: "Les premiers ateliers rejoignent Filéo pour valider les parcours sur le terrain.",
    body: "Le pilote démarre avec un nombre limité d'ateliers afin de mesurer l'usage réel avant l'ouverture commerciale.",
    sort_order: 1,
  },
];

for (const content of contents) {
  insert("contents", {
    id: randomUUID(),
    kind: content.kind,
    slug: content.slug,
    locale: "fr",
    title: content.title,
    summary: content.summary ?? null,
    body: content.body ?? null,
    task_key: content.task_key ?? null,
    duration_seconds: content.duration_seconds ?? null,
    transcript: content.transcript ?? null,
    sort_order: content.sort_order,
    status: "published",
    published_at: now(),
    created_by: adminId,
    created_at: now(),
    updated_at: now(),
  });
}

console.log(`
Jeu de données créé.

  Back-office   +242 06 000 00 01 / Fileo2026!
  Responsable   +242 06 111 11 11 / Atelier2026!
  Collaborateur +242 06 222 22 22 / Atelier2026!   (sans droit financier)

Le collaborateur sert à vérifier REC-12 : aucun prix ne doit lui être transmis.
`);

db.close();
