import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  MongoClient,
  type ClientSession,
  type Collection,
  type Db,
  type Document,
} from "mongodb";

const LOCAL_CREDENTIALS = join(process.cwd(), "atlas-credentials.env");

if (!process.env.MONGODB_URI && existsSync(LOCAL_CREDENTIALS)) {
  process.loadEnvFile(LOCAL_CREDENTIALS);
}

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB ?? "fileo";

if (!uri) {
  throw new Error(
    "MONGODB_URI est absent. Renseignez-le dans l'environnement ou dans atlas-credentials.env.",
  );
}

declare global {
  var __fileoMongoClient: MongoClient | undefined;
  var __fileoMongoDbPromise: Promise<Db> | undefined;
}

function client(): MongoClient {
  if (!globalThis.__fileoMongoClient) {
    globalThis.__fileoMongoClient = new MongoClient(uri!, {
      maxPoolSize: 20,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 10_000,
      retryReads: true,
      retryWrites: true,
    });
  }
  return globalThis.__fileoMongoClient;
}

async function initialise(): Promise<Db> {
  const mongo = client();
  await mongo.connect();
  const db = mongo.db(databaseName);

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
    db.collection("attachments").createIndex({ id: 1 }, { unique: true }),
    db.collection("attachments").createIndex({ workshop_id: 1, order_id: 1, deleted_at: 1 }),
    db.collection("audit_log").createIndex({ id: 1 }, { unique: true }),
  ]);

  return db;
}

export function getDb(): Promise<Db> {
  if (!globalThis.__fileoMongoDbPromise) {
    globalThis.__fileoMongoDbPromise = initialise().catch((error) => {
      globalThis.__fileoMongoDbPromise = undefined;
      throw error;
    });
  }
  return globalThis.__fileoMongoDbPromise;
}

export async function collection<T extends Document = Document>(name: string): Promise<Collection<T>> {
  return (await getDb()).collection<T>(name);
}

export async function withTransaction<T>(
  work: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = client().startSession();
  try {
    return await session.withTransaction(() => work(session), {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
  } finally {
    await session.endSession();
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function newId(): string {
  return crypto.randomUUID();
}

export function toBool(value: unknown): boolean {
  return value === 1 || value === true;
}

export function fromBool(value: boolean): number {
  return value ? 1 : 0;
}
