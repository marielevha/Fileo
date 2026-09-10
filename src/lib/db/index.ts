import "server-only";

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Database access.
 *
 * Currently SQLite through Node's built-in `node:sqlite` — no native module to
 * compile, which matters on locked-down machines. Everything above this file
 * talks in plain rows, so swapping in PostgreSQL means reimplementing this
 * module and the repositories, not the pages.
 *
 * NOTE: `node:sqlite` is still flagged experimental upstream. It is stable
 * enough for development; revisit before production alongside the Postgres
 * migration the cahier des charges calls for (§15.2).
 */

const DB_PATH = process.env.FILEO_DB_PATH ?? join(process.cwd(), "data", "fileo.db");
const SCHEMA_PATH = join(process.cwd(), "src", "lib", "db", "schema.sql");

declare global {
  // Survives hot reload in dev; otherwise each recompile opens a new handle.
  var __fileoDb: DatabaseSync | undefined;
}

function open(): DatabaseSync {
  mkdirSync(dirname(DB_PATH), { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(readFileSync(SCHEMA_PATH, "utf8"));

  // Forward migration for databases created before client soft deletion.
  const clientColumns = db.prepare("PRAGMA table_info(clients)").all() as { name: string }[];
  if (!clientColumns.some((column) => column.name === "deleted_at")) {
    db.exec("ALTER TABLE clients ADD COLUMN deleted_at TEXT");
  }

  const itemColumns = db.prepare("PRAGMA table_info(order_items)").all() as { name: string }[];
  if (!itemColumns.some((column) => column.name === "delivered_at")) {
    db.exec("ALTER TABLE order_items ADD COLUMN delivered_at TEXT");
    db.exec("UPDATE order_items SET delivered_at = updated_at WHERE status = 'remis'");
  }

  const dateChangeColumns = db.prepare("PRAGMA table_info(order_date_changes)").all() as { name: string }[];
  if (!dateChangeColumns.some((column) => column.name === "order_item_id")) {
    db.exec("ALTER TABLE order_date_changes ADD COLUMN order_item_id TEXT REFERENCES order_items(id)");
  }
  db.exec("CREATE INDEX IF NOT EXISTS idx_order_date_changes_item ON order_date_changes(order_item_id, changed_at DESC)");

  return db;
}

export function getDb(): DatabaseSync {
  if (!globalThis.__fileoDb) {
    globalThis.__fileoDb = open();
  }
  return globalThis.__fileoDb;
}

/* ---------------------------------------------------------------
   Thin query helpers
   --------------------------------------------------------------- */

type Params = ReadonlyArray<string | number | null | bigint | Uint8Array>;

export function query<T = Record<string, unknown>>(sql: string, params: Params = []): T[] {
  return getDb()
    .prepare(sql)
    .all(...params) as T[];
}

export function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: Params = [],
): T | null {
  const row = getDb()
    .prepare(sql)
    .get(...params);
  return (row as T) ?? null;
}

export function execute(sql: string, params: Params = []) {
  return getDb()
    .prepare(sql)
    .run(...params);
}

/**
 * Runs `fn` inside a transaction. Financial writes must always go through
 * this — a half-applied payment is worse than a rejected one (§8.7).
 */
export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/* ---------------------------------------------------------------
   Shared column helpers
   --------------------------------------------------------------- */

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}

/** SQLite has no boolean type; business code should never see 0/1. */
export function toBool(value: unknown): boolean {
  return value === 1 || value === true;
}

export function fromBool(value: boolean): number {
  return value ? 1 : 0;
}
