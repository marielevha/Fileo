import "server-only";

import { existsSync } from "node:fs";
import { join } from "node:path";
import pg, { type PoolClient, type QueryResultRow } from "pg";

const { Pool } = pg;
const LOCAL_CONFIG = join(process.cwd(), "config-supabase.env");

if ((!process.env.SUPABASE_POOLER_DB_URL && !process.env.SUPABASE_DB_URL) && existsSync(LOCAL_CONFIG)) {
  process.loadEnvFile(LOCAL_CONFIG);
}

declare global {
  var __fileoPostgresPool: InstanceType<typeof Pool> | undefined;
}

function pool() {
  const connectionString = process.env.SUPABASE_POOLER_DB_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error("Configuration PostgreSQL Supabase absente.");
  if (!globalThis.__fileoPostgresPool) {
    globalThis.__fileoPostgresPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
    });
  }
  return globalThis.__fileoPostgresPool;
}

export type PgExecutor = Pick<PoolClient, "query">;

export async function sql<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
  executor: PgExecutor = pool(),
): Promise<T[]> {
  return (await executor.query<T>(text, values)).rows;
}

export async function sqlOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
  executor?: PgExecutor,
): Promise<T | null> {
  return (await sql<T>(text, values, executor))[0] ?? null;
}

export async function withPgTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
