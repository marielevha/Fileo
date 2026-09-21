import pg from "pg";

process.loadEnvFile("config-supabase.env");
const connectionString = process.env.SUPABASE_POOLER_DB_URL || process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error("Configuration PostgreSQL Supabase absente.");

const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
});

await client.connect();
try {
  const checks = [
    ["counts", "select (select count(*) from public.workshops)::int workshops, (select count(*) from public.orders)::int orders"],
    ["clients", "select c.id, count(o.id)::int order_count from public.clients c left join public.orders o on o.client_id=c.id where c.deleted_at is null group by c.id limit 2"],
    ["planning", "select i.id from public.order_items i join public.orders o on o.id=i.order_id where o.cancelled_at is null limit 2"],
    ["subscriptions", "select s.id, p.label from public.subscriptions s left join public.plans p on p.id=s.current_plan_id limit 2"],
  ];
  for (const [name, query] of checks) {
    const result = await client.query(query);
    console.log(`${name}: ok (${result.rowCount} rows)`);
  }
} finally {
  await client.end();
}
