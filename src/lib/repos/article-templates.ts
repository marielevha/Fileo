import "server-only";

import { randomUUID } from "node:crypto";
import { recordAudit } from "@/lib/audit";
import { sql, sqlOne, withPgTransaction } from "@/lib/supabase/postgres";

export type MeasurementTemplateField = {
  key: string;
  label: string;
  unit: string;
  required: boolean;
  sortOrder: number;
};

export type ArticleTemplate = {
  id: string;
  name: string;
  description: string | null;
  defaultWorkType: "creation" | "retouche";
  active: boolean;
  sortOrder: number;
  fields: MeasurementTemplateField[];
  rowVersion: number;
};

type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  default_work_type: "creation" | "retouche";
  active: boolean;
  sort_order: number;
  fields_json: string | null;
  row_version: number;
};

function toTemplate(row: TemplateRow): ArticleTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    defaultWorkType: row.default_work_type,
    active: row.active,
    sortOrder: row.sort_order,
    fields: parseFields(row.fields_json),
    rowVersion: row.row_version,
  };
}

function parseFields(value: string | null): MeasurementTemplateField[] {
  if (!value) return [];
  try {
    const rows = JSON.parse(value) as MeasurementTemplateField[];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export async function listArticleTemplates(workshopId: string, options: { includeInactive?: boolean } = {}) {
  const rows = await sql<TemplateRow>(`
    select a.id, a.name, a.description, a.default_work_type, a.active, a.sort_order,
      coalesce(t.fields_json, '[]'::jsonb)::text as fields_json, a.row_version
    from public.workshop_article_types a
    left join public.measurement_templates t on t.article_type_id = a.id and t.deleted_at is null
    where a.workshop_id = $1 and a.deleted_at is null
      and ($2::boolean or a.active)
    order by a.sort_order, a.name, a.id`, [workshopId, Boolean(options.includeInactive)]);
  return rows.map(toTemplate);
}

export type SaveArticleTemplateInput = {
  workshopId: string;
  actorUserId: string;
  id?: string | null;
  name: string;
  description?: string | null;
  defaultWorkType: "creation" | "retouche";
  active: boolean;
  sortOrder: number;
  fields: MeasurementTemplateField[];
};

export async function saveArticleTemplate(input: SaveArticleTemplateInput): Promise<string> {
  const id = input.id ?? randomUUID();
  const fields = input.fields
    .map((field, index) => ({
      key: field.key.trim().slice(0, 80),
      label: field.label.trim().slice(0, 80),
      unit: (field.unit.trim() || "cm").slice(0, 12),
      required: Boolean(field.required),
      sortOrder: index + 1,
    }))
    .filter((field) => field.key && field.label);

  await withPgTransaction(async (client) => {
    const existing = input.id
      ? await sqlOne<{ id: string; name: string }>(
          "select id,name from public.workshop_article_types where workshop_id=$1 and id=$2 and deleted_at is null for update",
          [input.workshopId, input.id],
          client,
        )
      : null;
    if (input.id && !existing) throw new Error("Modele introuvable.");

    await sql(`
      insert into public.workshop_article_types
        (id, workshop_id, name, description, default_work_type, active, sort_order, created_by)
      values ($1,$2,$3,$4,$5,$6,$7,$8)
      on conflict (id) do update set
        name=excluded.name,
        description=excluded.description,
        default_work_type=excluded.default_work_type,
        active=excluded.active,
        sort_order=excluded.sort_order,
        row_version=public.workshop_article_types.row_version+1`,
      [
        id,
        input.workshopId,
        input.name.trim(),
        input.description?.trim() || null,
        input.defaultWorkType,
        input.active,
        input.sortOrder,
        input.actorUserId,
      ],
      client,
    );

    await sql(`
      insert into public.measurement_templates
        (id, workshop_id, article_type_id, name, fields_json, active, sort_order, created_by)
      values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)
      on conflict (article_type_id) where deleted_at is null do update set
        name=excluded.name,
        fields_json=excluded.fields_json,
        active=excluded.active,
        sort_order=excluded.sort_order,
        row_version=public.measurement_templates.row_version+1`,
      [
        randomUUID(),
        input.workshopId,
        id,
        input.name.trim(),
        JSON.stringify(fields),
        input.active,
        input.sortOrder,
        input.actorUserId,
      ],
      client,
    );

    await recordAudit({
      workshopId: input.workshopId,
      actorUserId: input.actorUserId,
      action: "template.update",
      entityKind: "article_template",
      entityId: id,
      after: { name: input.name.trim(), fields: fields.length, active: input.active },
    }, client);
  });
  return id;
}

export async function deleteArticleTemplate(params: { workshopId: string; actorUserId: string; id: string }) {
  await withPgTransaction(async (client) => {
    const rows = await sql<{ id: string }>(
      "update public.workshop_article_types set deleted_at=now(), row_version=row_version+1 where workshop_id=$1 and id=$2 and deleted_at is null returning id",
      [params.workshopId, params.id],
      client,
    );
    if (!rows.length) return;
    await sql(
      "update public.measurement_templates set deleted_at=now(), row_version=row_version+1 where workshop_id=$1 and article_type_id=$2 and deleted_at is null",
      [params.workshopId, params.id],
      client,
    );
    await recordAudit({
      workshopId: params.workshopId,
      actorUserId: params.actorUserId,
      action: "template.delete",
      entityKind: "article_template",
      entityId: params.id,
    }, client);
  });
}
