import "server-only";

import { collection } from "@/lib/db";
import type { CurrencyCode } from "@/lib/money";

export type ContentKind = "page" | "faq" | "tutorial" | "news";
export type ContentRow = {
  id: string; kind: string; slug: string; locale: string; title: string;
  summary: string | null; body: string | null; task_key: string | null;
  duration_seconds: number | null; transcript: string | null; video_url: string | null;
  sort_order: number; status: string; published_at: string | null; updated_at: string;
};

export async function listPublished(kind: ContentKind, limit = 100): Promise<ContentRow[]> {
  const contents = await collection("contents");
  return contents.find(
    { kind, status: "published", locale: "fr" }, { projection: { _id: 0 } },
  ).sort({ sort_order: 1, published_at: -1 }).limit(limit).toArray() as unknown as Promise<ContentRow[]>;
}

export async function getPublished(kind: ContentKind, slug: string): Promise<ContentRow | null> {
  const contents = await collection("contents");
  return contents.findOne(
    { kind, slug, status: "published", locale: "fr" }, { projection: { _id: 0 } },
  ) as Promise<ContentRow | null>;
}

export async function listAllContents(kind?: ContentKind): Promise<ContentRow[]> {
  const contents = await collection("contents");
  return contents.find(kind ? { kind } : {}, { projection: { _id: 0 } })
    .sort({ kind: 1, sort_order: 1, updated_at: -1 }).toArray() as unknown as Promise<ContentRow[]>;
}

export type PlanRow = {
  id: string; code: string; label: string; country_code: string; currency: string;
  price_amount: number; period_months: number; limits_json: string; version: number;
  effective_from: string; archived_at: string | null;
};
export type PlanLimits = { members: number | null; storageMb: number | null; orders: number | null };
export function parseLimits(raw: string): PlanLimits {
  try {
    const parsed = JSON.parse(raw) as Partial<PlanLimits>;
    return { members: parsed.members ?? null, storageMb: parsed.storageMb ?? null, orders: parsed.orders ?? null };
  } catch { return { members: null, storageMb: null, orders: null }; }
}

export async function listActivePlans(): Promise<PlanRow[]> {
  const plans = await collection("plans");
  return plans.aggregate<PlanRow>([
    { $match: { archived_at: null } },
    { $sort: { version: -1 } },
    { $group: { _id: { code: "$code", country: "$country_code" }, plan: { $first: "$$ROOT" } } },
    { $replaceWith: "$plan" }, { $unset: "_id" },
    { $sort: { country_code: 1, price_amount: 1 } },
  ]).toArray();
}

export async function listAllPlans(): Promise<PlanRow[]> {
  const plans = await collection("plans");
  return plans.find({}, { projection: { _id: 0 } }).sort({ country_code: 1, code: 1, version: -1 }).toArray() as unknown as Promise<PlanRow[]>;
}

export function planCurrency(plan: PlanRow): CurrencyCode { return plan.currency as CurrencyCode; }
