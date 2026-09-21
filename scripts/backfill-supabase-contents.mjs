import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

process.loadEnvFile("atlas-credentials.env");
process.loadEnvFile("config-supabase.env");

const postgresUrl = process.env.SUPABASE_POOLER_DB_URL || process.env.SUPABASE_DB_URL;
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI est absent.");
if (!postgresUrl) throw new Error("SUPABASE_DB_URL ou SUPABASE_POOLER_DB_URL est absent.");

const mongo = new MongoClient(process.env.MONGODB_URI);
const postgres = new pg.Client({
  connectionString: postgresUrl,
  ssl: postgresUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
});

await Promise.all([mongo.connect(), postgres.connect()]);

try {
  const contents = await mongo
    .db(process.env.MONGODB_DB ?? "fileo")
    .collection("contents")
    .find({}, { projection: { _id: 0 } })
    .toArray();

  await postgres.query("begin");
  try {
    const migration = readFileSync(
      join(process.cwd(), "supabase", "migrations", "20260920172550_align_contents_schema.sql"),
      "utf8",
    );
    await postgres.query(migration);

    for (const row of contents) {
      const result = await postgres.query(
        `update public.contents
         set kind = $2::public.content_kind,
             slug = $3,
             locale = $4,
             title = $5,
             summary = $6,
             body = $7,
             task_key = $8,
             duration_seconds = $9,
             transcript = $10,
             video_url = $11,
             sort_order = $12,
             status = $13,
             created_by = $14,
             body_json = $15::jsonb,
             published_at = $16,
             updated_at = $17
         where id = $1`,
        [
          row.id,
          databaseKind(row.kind),
          row.slug,
          row.locale ?? "fr",
          row.title,
          row.summary ?? null,
          row.body ?? null,
          row.task_key ?? null,
          row.duration_seconds ?? null,
          row.transcript ?? null,
          row.video_url ?? null,
          row.sort_order ?? 0,
          contentStatus(row.status),
          row.created_by ?? null,
          JSON.stringify({ ...(row.body_json ?? {}), source_kind: row.kind }),
          row.published_at ?? null,
          row.updated_at ?? new Date().toISOString(),
        ],
      );

      if (result.rowCount !== 1) {
        throw new Error(`Contenu Supabase introuvable : ${row.id} (${row.slug})`);
      }
    }

    await postgres.query("commit");
    console.log(`${contents.length} contenus restaurés dans Supabase.`);
  } catch (error) {
    await postgres.query("rollback");
    throw error;
  }
} finally {
  await Promise.all([mongo.close(), postgres.end()]);
}

function databaseKind(kind) {
  if (kind === "tutorial") return "guide";
  if (kind === "faq" || kind === "guide") return kind;
  return "page";
}

function contentStatus(status) {
  return ["draft", "published", "archived"].includes(status) ? status : "draft";
}
