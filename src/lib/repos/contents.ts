import "server-only";

import { query, queryOne } from "@/lib/db";
import type { CurrencyCode } from "@/lib/money";

/**
 * Editorial content and public offers (§6, §12.3, §12.4).
 *
 * Public pages read only `published` rows, so a draft is never visible before
 * the back-office publishes it.
 */

export type ContentKind = "page" | "faq" | "tutorial" | "news";

export type ContentRow = {
  id: string;
  kind: string;
  slug: string;
  locale: string;
  title: string;
  summary: string | null;
  body: string | null;
  task_key: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  video_url: string | null;
  sort_order: number;
  status: string;
  published_at: string | null;
  updated_at: string;
};

export function listPublished(kind: ContentKind, limit = 100): ContentRow[] {
  return query<ContentRow>(
    `SELECT * FROM contents
      WHERE kind = ? AND status = 'published' AND locale = 'fr'
      ORDER BY sort_order, published_at DESC
      LIMIT ?`,
    [kind, limit],
  );
}

export function getPublished(kind: ContentKind, slug: string): ContentRow | null {
  return queryOne<ContentRow>(
    `SELECT * FROM contents
      WHERE kind = ? AND slug = ? AND status = 'published' AND locale = 'fr'`,
    [kind, slug],
  );
}

/** Every row, drafts included — back-office only. */
export function listAllContents(kind?: ContentKind): ContentRow[] {
  return query<ContentRow>(
    `SELECT * FROM contents
      WHERE (? IS NULL OR kind = ?)
      ORDER BY kind, sort_order, updated_at DESC`,
    [kind ?? null, kind ?? null],
  );
}

/* ---------------------------------------------------------------
   Offers (§11.1) — the price shown must be the price actually charged
   --------------------------------------------------------------- */

export type PlanRow = {
  id: string;
  code: string;
  label: string;
  country_code: string;
  currency: string;
  price_amount: number;
  period_months: number;
  limits_json: string;
  version: number;
  effective_from: string;
  archived_at: string | null;
};

export type PlanLimits = {
  members: number | null;
  storageMb: number | null;
  orders: number | null;
};

export function parseLimits(raw: string): PlanLimits {
  try {
    const parsed = JSON.parse(raw) as Partial<PlanLimits>;
    return {
      members: parsed.members ?? null,
      storageMb: parsed.storageMb ?? null,
      orders: parsed.orders ?? null,
    };
  } catch {
    return { members: null, storageMb: null, orders: null };
  }
}

/** Current live offers, newest effective version per code and country. */
export function listActivePlans(): PlanRow[] {
  return query<PlanRow>(
    `SELECT p.* FROM plans p
      WHERE p.archived_at IS NULL
        AND p.version = (
          SELECT MAX(p2.version) FROM plans p2
           WHERE p2.code = p.code AND p2.country_code = p.country_code
             AND p2.archived_at IS NULL
        )
      ORDER BY p.country_code, p.price_amount`,
    [],
  );
}

export function listAllPlans(): PlanRow[] {
  return query<PlanRow>(`SELECT * FROM plans ORDER BY country_code, code, version DESC`, []);
}

export function planCurrency(plan: PlanRow): CurrencyCode {
  return plan.currency as CurrencyCode;
}
