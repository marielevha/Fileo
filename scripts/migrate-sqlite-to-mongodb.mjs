import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { MongoClient } from "mongodb";

const sourcePath = process.env.FILEO_DB_PATH ?? join(process.cwd(), "data", "fileo.db");
if (!existsSync(sourcePath)) throw new Error(`Base SQLite introuvable: ${sourcePath}`);
if (!process.env.MONGODB_URI) process.loadEnvFile("atlas-credentials.env");
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI est absent.");

const replace = process.argv.includes("--replace");
const mongo = new MongoClient(process.env.MONGODB_URI);
await mongo.connect();
const databaseName = process.env.MONGODB_DB ?? "fileo";
const target = mongo.db(databaseName);
const existingCollections = await target.listCollections({}, { nameOnly: true }).toArray();

if (existingCollections.length > 0 && !replace) {
  await mongo.close();
  throw new Error(`La base MongoDB ${databaseName} n'est pas vide. Relancez avec --replace pour la remplacer explicitement.`);
}
if (replace) await target.dropDatabase();

const sqlite = new DatabaseSync(sourcePath, { readOnly: true });
const tables = sqlite.prepare(`
  SELECT name FROM sqlite_master
   WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
   ORDER BY name
`).all().map((row) => row.name);

let total = 0;
for (const table of tables) {
  const rows = sqlite.prepare(`SELECT * FROM "${table.replaceAll('"', '""')}"`).all();
  if (rows.length > 0) await target.collection(table).insertMany(rows, { ordered: true });
  total += rows.length;
  console.log(`${table.padEnd(24)} ${rows.length}`);
}

sqlite.close();
await Promise.all([
  target.collection("users").createIndex({ id: 1 }, { unique: true }),
  target.collection("users").createIndex({ phone_e164: 1 }, { unique: true }),
  target.collection("sessions").createIndex({ id: 1 }, { unique: true }),
  target.collection("sessions").createIndex({ token_hash: 1 }, { unique: true }),
  target.collection("memberships").createIndex({ workshop_id: 1, user_id: 1 }, { unique: true }),
  target.collection("clients").createIndex({ id: 1 }, { unique: true }),
  target.collection("clients").createIndex({ workshop_id: 1, deleted_at: 1, archived_at: 1 }),
  target.collection("measurement_records").createIndex({ id: 1 }, { unique: true }),
  target.collection("orders").createIndex({ id: 1 }, { unique: true }),
  target.collection("orders").createIndex({ workshop_id: 1, reference: 1 }, { unique: true }),
  target.collection("order_items").createIndex({ id: 1 }, { unique: true }),
  target.collection("order_date_changes").createIndex({ id: 1 }, { unique: true }),
  target.collection("financial_movements").createIndex({ id: 1 }, { unique: true }),
  target.collection("financial_movements").createIndex({ workshop_id: 1, idempotency_key: 1 }, { unique: true, partialFilterExpression: { idempotency_key: { $type: "string" } } }),
  target.collection("plans").createIndex({ id: 1 }, { unique: true }),
  target.collection("plans").createIndex({ code: 1, version: 1 }, { unique: true }),
  target.collection("subscriptions").createIndex({ id: 1 }, { unique: true }),
  target.collection("platform_payments").createIndex({ idempotency_key: 1 }, { unique: true, partialFilterExpression: { idempotency_key: { $type: "string" } } }),
  target.collection("contents").createIndex({ kind: 1, slug: 1, locale: 1 }, { unique: true }),
]);

await mongo.close();
console.log(`\nMigration terminée: ${total} documents vers MongoDB/${databaseName}.`);
