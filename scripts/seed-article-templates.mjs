import fs from "node:fs";
import pg from "pg";

if (fs.existsSync("config-supabase.env")) {
  process.loadEnvFile("config-supabase.env");
}

const connectionString = process.env.SUPABASE_POOLER_DB_URL || process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error("SUPABASE_DB_URL absent.");

const templates = [
  {
    name: "Robe",
    type: "creation",
    description: "Robe simple ou ceremonie",
    fields: ["Poitrine", "Taille", "Hanche", "Epaule", "Longueur robe", "Longueur manche"],
  },
  {
    name: "Pantalon",
    type: "creation",
    description: "Pantalon homme ou femme",
    fields: ["Tour taille", "Bassin", "Longueur pantalon", "Cuisse", "Genou", "Bas"],
  },
  {
    name: "Chemise",
    type: "creation",
    description: "Chemise et haut ajuste",
    fields: ["Cou", "Poitrine", "Epaule", "Longueur manche", "Tour bras", "Longueur chemise"],
  },
  {
    name: "Kaftan",
    type: "creation",
    description: "Kaftan, boubou et tenue ample",
    fields: ["Poitrine", "Epaule", "Longueur", "Manche", "Tour bras", "Encolure"],
  },
  {
    name: "Retouche",
    type: "retouche",
    description: "Travaux de retouche courants",
    fields: ["Longueur actuelle", "Longueur souhaitee", "Tour taille", "A reprendre", "Ourlet", "Observation"],
  },
];

function fieldKey(label) {
  return label
    .toLocaleLowerCase("fr-FR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
});

await client.connect();

try {
  const workshops = await client.query(
    "select id, owner_user_id from public.workshops where status = $1 order by created_at",
    ["active"],
  );

  for (const workshop of workshops.rows) {
    let sortOrder = 10;
    for (const template of templates) {
      const existing = await client.query(
        `select id
         from public.workshop_article_types
         where workshop_id = $1
           and lower(btrim(name)) = lower(btrim($2))
           and deleted_at is null`,
        [workshop.id, template.name],
      );

      let articleTypeId = existing.rows[0]?.id;
      if (!articleTypeId) {
        const inserted = await client.query(
          `insert into public.workshop_article_types
            (workshop_id, name, description, default_work_type, active, sort_order, created_by)
           values ($1, $2, $3, $4, true, $5, $6)
           returning id`,
          [workshop.id, template.name, template.description, template.type, sortOrder, workshop.owner_user_id],
        );
        articleTypeId = inserted.rows[0].id;
      }

      const fields = template.fields.map((label, index) => ({
        key: fieldKey(label),
        label,
        unit: "cm",
        required: false,
        sortOrder: index + 1,
      }));

      await client.query(
        `insert into public.measurement_templates
          (workshop_id, article_type_id, name, fields_json, active, sort_order, created_by)
         values ($1, $2, $3, $4::jsonb, true, $5, $6)
         on conflict (article_type_id) where deleted_at is null do update set
           name = excluded.name,
           fields_json = excluded.fields_json,
           active = true,
           sort_order = excluded.sort_order,
           row_version = public.measurement_templates.row_version + 1`,
        [workshop.id, articleTypeId, template.name, JSON.stringify(fields), sortOrder, workshop.owner_user_id],
      );

      sortOrder += 10;
    }
  }

  console.log(`Seeded ${templates.length} templates for ${workshops.rowCount} workshop(s).`);
} finally {
  await client.end();
}
