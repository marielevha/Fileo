-- =============================================================
-- Filéo — schéma relationnel (cahier des charges §16)
--
-- Cible actuelle : SQLite (via node:sqlite). Le SQL reste
-- volontairement proche du standard pour que la bascule vers
-- PostgreSQL ne touche que les types et les index.
--
-- Conventions :
--   * identifiants : TEXT (UUID) — stables entre appareils (§10.2)
--   * montants     : INTEGER en unité mineure + colonne devise (§15.3)
--   * dates        : TEXT ISO-8601 UTC ; les dates métier gardent
--                    aussi une date locale atelier quand elle compte
--   * row_version  : entier incrémenté à chaque écriture (§10.3)
--   * chaque table métier porte workshop_id (§16)
-- =============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------
-- Identité et organisation
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  full_name         TEXT NOT NULL,
  phone_e164        TEXT NOT NULL UNIQUE,
  phone_verified_at TEXT,
  email             TEXT,
  email_verified_at TEXT,
  password_hash     TEXT NOT NULL,
  -- 'active' | 'suspended' | 'deletion_requested'
  status            TEXT NOT NULL DEFAULT 'active',
  -- Habilitations équipe Filéo, hors atelier (§4.1). JSON array.
  platform_roles    TEXT NOT NULL DEFAULT '[]',
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  row_version       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash     TEXT NOT NULL UNIQUE,
  -- Atelier actif de la session ; NULL pour un membre de l'équipe Filéo.
  workshop_id    TEXT REFERENCES workshops(id) ON DELETE SET NULL,
  user_agent     TEXT,
  created_at     TEXT NOT NULL,
  last_seen_at   TEXT NOT NULL,
  expires_at     TEXT NOT NULL,
  revoked_at     TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS workshops (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  owner_user_id     TEXT NOT NULL REFERENCES users(id),
  country_code      TEXT NOT NULL,           -- 'CG' | 'CD'
  city              TEXT,
  phone_e164        TEXT,
  address           TEXT,
  -- Devise métier de l'atelier (§2.3). Verrouillée après la 1re transaction.
  currency          TEXT NOT NULL,
  currency_locked_at TEXT,
  timezone          TEXT NOT NULL DEFAULT 'Africa/Brazzaville',
  logo_media_id     TEXT,
  receipt_footer    TEXT,
  -- 'active' | 'suspended'
  status            TEXT NOT NULL DEFAULT 'active',
  suspended_reason  TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  row_version       INTEGER NOT NULL DEFAULT 1
);

-- Appartenance : un utilisateur dans un atelier, avec ses droits (§4.2).
CREATE TABLE IF NOT EXISTS memberships (
  id             TEXT PRIMARY KEY,
  workshop_id    TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 'owner' | 'collaborator'
  role           TEXT NOT NULL,
  -- Droit financier attribué explicitement à un collaborateur (§4.1).
  can_view_money INTEGER NOT NULL DEFAULT 0,
  -- 'active' | 'disabled' | 'invited'
  status         TEXT NOT NULL DEFAULT 'active',
  invited_at     TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  row_version    INTEGER NOT NULL DEFAULT 1,
  UNIQUE (workshop_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);

-- ---------------------------------------------------------------
-- Métier atelier
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clients (
  id             TEXT PRIMARY KEY,
  workshop_id    TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  display_name   TEXT NOT NULL,
  phone_e164     TEXT,
  -- Forme normalisée pour la recherche (§8.2) : chiffres uniquement.
  phone_search   TEXT,
  other_contact  TEXT,
  -- Contact parent/tuteur pour un enfant, sans imposer de date de naissance.
  guardian_name  TEXT,
  guardian_phone TEXT,
  notes          TEXT,
  archived_at    TEXT,
  created_by     TEXT NOT NULL REFERENCES users(id),
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  row_version    INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_clients_workshop ON clients(workshop_id, archived_at);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(workshop_id, phone_search);

-- Modèle de mesures : liste de champs par type de vêtement (§8.3).
CREATE TABLE IF NOT EXISTS measurement_templates (
  id           TEXT PRIMARY KEY,
  -- NULL = modèle commun fourni par Filéo.
  workshop_id  TEXT REFERENCES workshops(id) ON DELETE CASCADE,
  category     TEXT NOT NULL,          -- 'haut' | 'pantalon' | 'robe' | 'ensemble' | 'personnalise'
  label        TEXT NOT NULL,
  -- JSON: [{ key, label, unit, optional }]
  fields       TEXT NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

-- Relevé de mesures : versionné, jamais écrasé (§8.3).
CREATE TABLE IF NOT EXISTS measurement_records (
  id           TEXT PRIMARY KEY,
  workshop_id  TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  client_id    TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  template_id  TEXT REFERENCES measurement_templates(id),
  category     TEXT NOT NULL,
  version      INTEGER NOT NULL,
  -- JSON: { [fieldKey]: number | null }. Une valeur absente reste NULL,
  -- elle ne devient jamais 0 (§8.3).
  values_json  TEXT NOT NULL,
  unit         TEXT NOT NULL DEFAULT 'cm',
  notes        TEXT,
  taken_at     TEXT NOT NULL,
  created_by   TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL,
  UNIQUE (client_id, category, version)
);

CREATE INDEX IF NOT EXISTS idx_measurements_client ON measurement_records(client_id, category, version DESC);

CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,
  workshop_id     TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  client_id       TEXT NOT NULL REFERENCES clients(id),
  -- Référence lisible, unique par atelier (§8.4).
  reference       TEXT NOT NULL,
  currency        TEXT NOT NULL,
  -- Réduction commande en unité mineure ; jamais négative (§8.4).
  discount_amount INTEGER NOT NULL DEFAULT 0,
  discount_reason TEXT,
  instructions    TEXT,
  promised_date   TEXT,
  fitting_date    TEXT,
  owner_user_id   TEXT REFERENCES users(id),
  cancelled_at    TEXT,
  cancel_reason   TEXT,
  created_by      TEXT NOT NULL REFERENCES users(id),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  row_version     INTEGER NOT NULL DEFAULT 1,
  UNIQUE (workshop_id, reference)
);

CREATE INDEX IF NOT EXISTS idx_orders_workshop ON orders(workshop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_promised ON orders(workshop_id, promised_date);

CREATE TABLE IF NOT EXISTS order_items (
  id                 TEXT PRIMARY KEY,
  workshop_id        TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  order_id           TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  category           TEXT NOT NULL,
  description        TEXT NOT NULL,
  quantity           INTEGER NOT NULL DEFAULT 1,
  unit_price_amount  INTEGER NOT NULL DEFAULT 0,
  currency           TEXT NOT NULL,
  -- Instantané des mesures utilisées (§8.3) : copie, jamais une référence.
  measurement_snapshot TEXT,
  measurement_record_id TEXT REFERENCES measurement_records(id),
  assignee_user_id   TEXT REFERENCES users(id),
  due_date           TEXT,
  -- 'a_realiser' | 'en_cours' | 'a_essayer' | 'pret' | 'remis' | 'annule'
  status             TEXT NOT NULL DEFAULT 'a_realiser',
  delivered_quantity INTEGER NOT NULL DEFAULT 0,
  cancelled_at       TEXT,
  sort_order         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  row_version        INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_items_due ON order_items(workshop_id, due_date, status);

-- Historique des changements d'échéance : ancienne date, nouvelle, motif (§8.4).
CREATE TABLE IF NOT EXISTS order_date_changes (
  id           TEXT PRIMARY KEY,
  workshop_id  TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  order_id     TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  previous_date TEXT,
  new_date     TEXT,
  reason       TEXT,
  changed_by   TEXT NOT NULL REFERENCES users(id),
  changed_at   TEXT NOT NULL
);

-- ---------------------------------------------------------------
-- Finance atelier (§8.7) — registre en ajout seul
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS financial_movements (
  id              TEXT PRIMARY KEY,
  workshop_id     TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  -- 'payment' | 'refund' | 'correction'
  kind            TEXT NOT NULL,
  -- Toujours strictement positif ; le sens vient de `kind` (§8.7).
  amount          INTEGER NOT NULL,
  currency        TEXT NOT NULL,
  -- 'cash' | 'mobile_money' | 'transfer' | 'other'
  method          TEXT NOT NULL DEFAULT 'cash',
  reference       TEXT,
  effective_date  TEXT NOT NULL,
  -- 'pending' (saisi hors ligne) | 'confirmed' | 'voided'
  status          TEXT NOT NULL DEFAULT 'confirmed',
  -- Contre-écriture : pointe le mouvement neutralisé (§8.7).
  reverses_id     TEXT REFERENCES financial_movements(id),
  void_reason     TEXT,
  -- Clé d'idempotence : un renvoi ne crée jamais deux encaissements (§8.7).
  idempotency_key TEXT,
  created_by      TEXT NOT NULL REFERENCES users(id),
  created_at      TEXT NOT NULL,
  row_version     INTEGER NOT NULL DEFAULT 1,
  UNIQUE (workshop_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_movements_order ON financial_movements(order_id, status);
CREATE INDEX IF NOT EXISTS idx_movements_workshop ON financial_movements(workshop_id, effective_date DESC);

CREATE TABLE IF NOT EXISTS expenses (
  id           TEXT PRIMARY KEY,
  workshop_id  TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  category     TEXT,
  amount       INTEGER NOT NULL,
  currency     TEXT NOT NULL,
  method       TEXT,
  spent_on     TEXT NOT NULL,
  media_id     TEXT,
  created_by   TEXT NOT NULL REFERENCES users(id),
  created_at   TEXT NOT NULL,
  row_version  INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_expenses_workshop ON expenses(workshop_id, spent_on DESC);

CREATE TABLE IF NOT EXISTS receipts (
  id           TEXT PRIMARY KEY,
  workshop_id  TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  movement_id  TEXT NOT NULL REFERENCES financial_movements(id) ON DELETE CASCADE,
  reference    TEXT NOT NULL,
  -- 'provisional' | 'final' | 'cancelled' (§8.8)
  status       TEXT NOT NULL DEFAULT 'final',
  issued_at    TEXT NOT NULL,
  UNIQUE (workshop_id, reference)
);

-- ---------------------------------------------------------------
-- Médias (§8.5) — stockage privé, jamais d'URL publique permanente
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS media (
  id            TEXT PRIMARY KEY,
  workshop_id   TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  owner_kind    TEXT NOT NULL,      -- 'order_item' | 'expense' | 'workshop_logo'
  owner_id      TEXT NOT NULL,
  role          TEXT,               -- 'tissu' | 'modele' | 'justificatif'
  storage_key   TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  byte_size     INTEGER NOT NULL,
  width         INTEGER,
  height        INTEGER,
  -- 'pending' | 'stored' | 'failed'
  upload_status TEXT NOT NULL DEFAULT 'stored',
  created_by    TEXT NOT NULL REFERENCES users(id),
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_owner ON media(workshop_id, owner_kind, owner_id);

-- ---------------------------------------------------------------
-- Abonnements Filéo (§11)
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS plans (
  id             TEXT PRIMARY KEY,
  code           TEXT NOT NULL,
  label          TEXT NOT NULL,
  country_code   TEXT NOT NULL,
  currency       TEXT NOT NULL,
  price_amount   INTEGER NOT NULL,
  period_months  INTEGER NOT NULL DEFAULT 1,
  -- JSON: { members: n|null, storageMb: n|null, orders: n|null }
  limits_json    TEXT NOT NULL DEFAULT '{}',
  -- Versionné : archiver une offre ne modifie pas les abonnements en cours (§12.3).
  version        INTEGER NOT NULL DEFAULT 1,
  effective_from TEXT NOT NULL,
  archived_at    TEXT,
  created_at     TEXT NOT NULL,
  UNIQUE (code, version)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id             TEXT PRIMARY KEY,
  workshop_id    TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  plan_id        TEXT NOT NULL REFERENCES plans(id),
  -- 'trial' | 'active' | 'renewal_due' | 'grace' | 'expired' | 'suspended'
  status         TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at  TEXT,
  current_period_end TEXT,
  grace_ends_at  TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
  cancelled_at   TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  row_version    INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_workshop ON subscriptions(workshop_id);

-- Règlement de l'abonnement Filéo — distinct des paiements clients (§8.7, §11.3).
CREATE TABLE IF NOT EXISTS platform_payments (
  id               TEXT PRIMARY KEY,
  subscription_id  TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  workshop_id      TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  amount           INTEGER NOT NULL,
  currency         TEXT NOT NULL,
  channel          TEXT NOT NULL,     -- 'mobile_money' | 'cash' | 'transfer'
  external_reference TEXT,
  -- 'declared' | 'validated' | 'rejected' (§11.3 : validation humaine en P0)
  status           TEXT NOT NULL DEFAULT 'declared',
  declared_at      TEXT NOT NULL,
  reviewed_at      TEXT,
  reviewed_by      TEXT REFERENCES users(id),
  review_note      TEXT,
  -- Empêche une double activation sur la même référence (REC-17).
  idempotency_key  TEXT,
  UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_platform_payments_status ON platform_payments(status, declared_at DESC);

-- ---------------------------------------------------------------
-- Contenus éditoriaux et assistance (§12.4, §12.5)
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS contents (
  id           TEXT PRIMARY KEY,
  -- 'page' | 'faq' | 'tutorial' | 'news'
  kind         TEXT NOT NULL,
  slug         TEXT NOT NULL,
  locale       TEXT NOT NULL DEFAULT 'fr',
  title        TEXT NOT NULL,
  summary      TEXT,
  body         TEXT,
  -- Tutoriels : tâche couverte, durée, transcription (§13.2)
  task_key     TEXT,
  duration_seconds INTEGER,
  transcript   TEXT,
  video_url    TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  -- 'draft' | 'published'
  status       TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  created_by   TEXT REFERENCES users(id),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  UNIQUE (kind, slug, locale)
);

CREATE INDEX IF NOT EXISTS idx_contents_kind ON contents(kind, status, sort_order);

CREATE TABLE IF NOT EXISTS tickets (
  id            TEXT PRIMARY KEY,
  workshop_id   TEXT REFERENCES workshops(id) ON DELETE SET NULL,
  requester_user_id TEXT REFERENCES users(id),
  requester_name  TEXT,
  requester_contact TEXT,
  category      TEXT NOT NULL,
  subject       TEXT NOT NULL,
  body          TEXT NOT NULL,
  -- 'open' | 'in_progress' | 'waiting' | 'resolved'
  status        TEXT NOT NULL DEFAULT 'open',
  assignee_user_id TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status, created_at DESC);

-- ---------------------------------------------------------------
-- Audit et synchronisation (§17.1, §10.2)
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_log (
  id            TEXT PRIMARY KEY,
  workshop_id   TEXT REFERENCES workshops(id) ON DELETE SET NULL,
  actor_user_id TEXT REFERENCES users(id),
  action        TEXT NOT NULL,
  entity_kind   TEXT NOT NULL,
  entity_id     TEXT,
  reason        TEXT,
  -- Valeurs avant/après pour les actions sensibles (§12.2). JSON.
  before_json   TEXT,
  after_json    TEXT,
  ip_address    TEXT,
  created_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_workshop ON audit_log(workshop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_kind, entity_id);

-- Journal des opérations de synchronisation mobile. Alimenté par l'API de
-- synchronisation ; la table existe dès maintenant pour que les identifiants
-- et versions soient cohérents avant l'arrivée du client Expo.
CREATE TABLE IF NOT EXISTS sync_operations (
  id            TEXT PRIMARY KEY,
  workshop_id   TEXT NOT NULL REFERENCES workshops(id) ON DELETE CASCADE,
  device_id     TEXT NOT NULL,
  user_id       TEXT NOT NULL REFERENCES users(id),
  entity_kind   TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  base_version  INTEGER,
  -- 'applied' | 'conflict' | 'rejected'
  outcome       TEXT NOT NULL,
  error_code    TEXT,
  payload_json  TEXT,
  received_at   TEXT NOT NULL,
  UNIQUE (workshop_id, device_id, id)
);

CREATE INDEX IF NOT EXISTS idx_sync_workshop ON sync_operations(workshop_id, received_at DESC);
