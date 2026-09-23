import "server-only";

import { randomUUID } from "node:crypto";
import type { Locale } from "@/lib/i18n/config";
import { recordAudit } from "@/lib/audit";
import { sql, sqlOne, withPgTransaction } from "@/lib/supabase/postgres";

export type FaqStatus = "draft" | "published" | "archived";

export type FaqTranslation = {
  id: string;
  slug: string;
  locale: Locale;
  title: string;
  body: string | null;
  sort_order: number;
  status: FaqStatus;
  row_version: number;
  updated_at: string;
};

export async function listFaqTranslations(): Promise<FaqTranslation[]> {
  return sql<FaqTranslation>(`select id, slug, locale, title, body, sort_order, status, row_version, updated_at
    from public.contents where kind = 'faq' order by sort_order, slug, locale`);
}

export async function saveFaqTranslation(input: {
  slug: string;
  locale: Locale;
  title: string;
  body: string;
  sortOrder: number;
  status: FaqStatus;
  rowVersion: number | null;
  actorUserId: string;
}): Promise<void> {
  await withPgTransaction(async (client) => {
    const existing = await sqlOne<FaqTranslation>(`select id, slug, locale, title, body, sort_order, status, row_version, updated_at
      from public.contents where kind = 'faq' and slug = $1 and locale = $2`,
      [input.slug, input.locale], client);

    if (existing && (input.rowVersion === null || input.rowVersion !== existing.row_version)) {
      throw new Error("Cette traduction a été modifiée depuis son ouverture. Rechargez la page.");
    }
    if (!existing && input.rowVersion !== null) {
      throw new Error("Cette traduction n'existe plus. Rechargez la page.");
    }

    const row = existing
      ? await sqlOne<{ id: string }>(`update public.contents
          set title = $2, body = $3, sort_order = $4, status = $5,
              published_at = case when $5 = 'published' then coalesce(published_at, now()) else published_at end,
              row_version = row_version + 1
          where id = $1 and row_version = $6 returning id`,
        [existing.id, input.title, input.body, input.sortOrder, input.status, input.rowVersion], client)
      : await sqlOne<{ id: string }>(`insert into public.contents
          (id, kind, slug, locale, title, body, sort_order, status, published_at, created_by)
          values ($1, 'faq', $2, $3, $4, $5, $6, $7,
            case when $7 = 'published' then now() else null end, $8)
          on conflict (kind, slug, locale) do nothing returning id`,
        [randomUUID(), input.slug, input.locale, input.title, input.body, input.sortOrder,
          input.status, input.actorUserId], client);

    if (!row) throw new Error("Cette traduction a changé. Rechargez la page.");
    await recordAudit({
      actorUserId: input.actorUserId,
      action: existing?.status !== input.status && input.status === "published"
        ? "content.publish" : "content.update",
      entityKind: "faq",
      entityId: row.id,
      before: existing ? { locale: existing.locale, status: existing.status, rowVersion: existing.row_version } : null,
      after: { slug: input.slug, locale: input.locale, status: input.status, sortOrder: input.sortOrder },
    }, client);
  });
}
