import "server-only";

import { randomUUID } from "node:crypto";
import { recordAudit } from "@/lib/audit";
import { sql, sqlOne, type PgExecutor, withPgTransaction } from "@/lib/supabase/postgres";

export type AffiliateProfile = {
  id: string;
  user_id: string | null;
  code: string;
  display_name: string;
  phone_e164: string | null;
  email: string | null;
  status: "active" | "suspended";
  created_at: string;
};

export type AffiliateAttribution = {
  id: string;
  affiliate_id: string;
  workshop_id: string;
  referral_code: string;
  attributed_at: string;
  workshop_name?: string;
};

export type AffiliateCommission = {
  id: string;
  affiliate_id: string;
  workshop_id: string;
  platform_payment_id: string | null;
  milestone: "first_payment" | "sixth_month";
  amount: number;
  currency: string;
  rate_bp: number;
  status: "pending" | "paid" | "cancelled";
  due_at: string;
  paid_at: string | null;
  note: string | null;
  workshop_name?: string;
  affiliate_code?: string;
  affiliate_name?: string;
};

export type AffiliateCommissionType = "percent" | "fixed";

export type AffiliateProgramSettings = {
  enabled: boolean;
  affiliate_trial_days: number;
  first_payment_discount_bp: number;
  first_payment_rate_bp: number;
  first_payment_commission_type: AffiliateCommissionType;
  first_payment_fixed_amount: number;
  sixth_month_rate_bp: number;
  sixth_month_commission_type: AffiliateCommissionType;
  sixth_month_fixed_amount: number;
  sixth_month_threshold_months: number;
  payout_delay_days: number;
  public_title: string;
  public_description: string;
};

export type AffiliateOverview = {
  profile: AffiliateProfile | null;
  attributions: AffiliateAttribution[];
  commissions: AffiliateCommission[];
  totals: Array<{ currency: string; pending: number; paid: number }>;
  settings: Pick<AffiliateProgramSettings, "enabled" | "affiliate_trial_days" | "first_payment_discount_bp" | "first_payment_rate_bp" | "first_payment_commission_type" | "first_payment_fixed_amount" | "sixth_month_rate_bp" | "sixth_month_commission_type" | "sixth_month_fixed_amount" | "sixth_month_threshold_months" | "payout_delay_days" | "public_title" | "public_description">;
};

export class AffiliateCodeError extends Error {
  constructor(
    public code: "invalid_code" | "code_taken",
    message: string,
  ) {
    super(message);
    this.name = "AffiliateCodeError";
  }
}

export function normaliseAffiliateCode(value: string) {
  return value.trim().toUpperCase();
}

export async function findAffiliateByCode(code: string, executor?: PgExecutor): Promise<AffiliateProfile | null> {
  const normalised = normaliseAffiliateCode(code);
  if (!normalised) return null;
  return sqlOne<AffiliateProfile>(
    "select id,user_id,code,display_name,phone_e164,email,status,created_at from public.affiliate_profiles where code=$1 and status='active'",
    [normalised],
    executor,
  );
}

export async function getAffiliateProfileForUser(userId: string, executor?: PgExecutor): Promise<AffiliateProfile | null> {
  return sqlOne<AffiliateProfile>(
    "select id,user_id,code,display_name,phone_e164,email,status,created_at from public.affiliate_profiles where user_id=$1",
    [userId],
    executor,
  );
}

export async function createAffiliateProfile(input: {
  userId: string;
  displayName: string;
  phone?: string | null;
  email?: string | null;
  requestedCode?: string | null;
  autoGenerate?: boolean;
  actorUserId: string;
}, executor?: PgExecutor): Promise<AffiliateProfile> {
  const settings = await getAffiliateProgramSettings(executor);
  if (!settings.enabled) throw new Error("Le programme d'affiliation est temporairement ferme.");
  const existing = await getAffiliateProfileForUser(input.userId, executor);
  if (existing) return existing;

  const requested = normaliseAffiliateCode(input.requestedCode ?? "");
  const code = input.autoGenerate || !requested
    ? await availableCode(autoCodeBase(input.displayName), executor)
    : await reserveRequestedCode(requested, executor);
  const row = await sqlOne<AffiliateProfile>(`
    insert into public.affiliate_profiles(user_id,code,display_name,phone_e164,email)
    values($1,$2,$3,$4,$5)
    returning id,user_id,code,display_name,phone_e164,email,status,created_at`,
    [input.userId, code, input.displayName.trim(), input.phone ?? null, input.email ?? null],
    executor,
  );
  if (!row) throw new Error("Profil affilié non créé.");
  await recordAudit({
    actorUserId: input.actorUserId,
    action: "affiliate.update",
    entityKind: "affiliate_profile",
    entityId: row.id,
    after: { code: row.code, userId: input.userId },
  }, executor);
  return row;
}

export async function attributeWorkshopToAffiliate(input: {
  workshopId: string;
  referralCode: string;
  createdByUserId?: string | null;
}, executor?: PgExecutor): Promise<AffiliateAttribution | null> {
  const affiliate = await findAffiliateByCode(input.referralCode, executor);
  if (!affiliate) return null;
  if (input.createdByUserId && affiliate.user_id === input.createdByUserId) return null;
  const row = await sqlOne<AffiliateAttribution>(`
    insert into public.affiliate_attributions(affiliate_id,workshop_id,referral_code,created_by_user_id)
    values($1,$2,$3,$4)
    on conflict(workshop_id) do nothing
    returning id,affiliate_id,workshop_id,referral_code,attributed_at`,
    [affiliate.id, input.workshopId, affiliate.code, input.createdByUserId ?? null],
    executor,
  );
  return row;
}

export async function getAffiliateOverviewForUser(userId: string): Promise<AffiliateOverview> {
  const settings = await getAffiliateProgramSettings();
  const profile = await getAffiliateProfileForUser(userId);
  if (!profile) return { profile: null, attributions: [], commissions: [], totals: [], settings };
  const [attributions, commissions, totals] = await Promise.all([
    sql<AffiliateAttribution>(`select aa.id,aa.affiliate_id,aa.workshop_id,aa.referral_code,aa.attributed_at,w.name workshop_name
      from public.affiliate_attributions aa join public.workshops w on w.id=aa.workshop_id
      where aa.affiliate_id=$1 order by aa.attributed_at desc limit 100`, [profile.id]),
    sql<AffiliateCommission>(`select ac.id,ac.affiliate_id,ac.workshop_id,ac.platform_payment_id,ac.milestone,ac.amount,ac.currency,ac.rate_bp,ac.status,ac.due_at,ac.paid_at,ac.note,w.name workshop_name
      from public.affiliate_commissions ac join public.workshops w on w.id=ac.workshop_id
      where ac.affiliate_id=$1 order by ac.created_at desc limit 100`, [profile.id]),
    sql<{ currency: string; pending: number; paid: number }>(`select currency,
        coalesce(sum(amount) filter(where status='pending'),0)::int pending,
        coalesce(sum(amount) filter(where status='paid'),0)::int paid
      from public.affiliate_commissions where affiliate_id=$1 group by currency order by currency`, [profile.id]),
  ]);
  return { profile, attributions, commissions, totals, settings };
}

export async function listAffiliateAdminOverview(): Promise<{
  affiliates: Array<AffiliateProfile & { conversions: number; pending_amount: number; paid_amount: number; currency: string | null }>;
  commissions: AffiliateCommission[];
}> {
  const [affiliates, commissions] = await Promise.all([
    sql<AffiliateProfile & { conversions: number; pending_amount: number; paid_amount: number; currency: string | null }>(`
      select ap.id,ap.user_id,ap.code,ap.display_name,ap.phone_e164,ap.email,ap.status,ap.created_at,
        count(distinct aa.workshop_id)::int conversions,
        coalesce(sum(ac.amount) filter(where ac.status='pending'),0)::int pending_amount,
        coalesce(sum(ac.amount) filter(where ac.status='paid'),0)::int paid_amount,
        min(ac.currency) currency
      from public.affiliate_profiles ap
      left join public.affiliate_attributions aa on aa.affiliate_id=ap.id
      left join public.affiliate_commissions ac on ac.affiliate_id=ap.id
      group by ap.id order by ap.created_at desc limit 200`),
    sql<AffiliateCommission>(`select ac.id,ac.affiliate_id,ac.workshop_id,ac.platform_payment_id,ac.milestone,ac.amount,ac.currency,ac.rate_bp,ac.status,ac.due_at,ac.paid_at,ac.note,w.name workshop_name,ap.code affiliate_code,ap.display_name affiliate_name
      from public.affiliate_commissions ac
      join public.affiliate_profiles ap on ap.id=ac.affiliate_id
      join public.workshops w on w.id=ac.workshop_id
      order by case ac.status when 'pending' then 0 when 'paid' then 1 else 2 end, ac.due_at desc, ac.created_at desc
      limit 300`),
  ]);
  return { affiliates, commissions };
}

export async function markAffiliateCommissionPaid(input: { commissionId: string; actorUserId: string; note?: string | null }) {
  await withPgTransaction(async (client) => {
    const row = await sqlOne<{ id: string; affiliate_id: string }>(
      "update public.affiliate_commissions set status='paid',paid_at=now(),paid_by=$2,note=$3,updated_at=now() where id=$1 and status='pending' returning id,affiliate_id",
      [input.commissionId, input.actorUserId, input.note?.trim() || null],
      client,
    );
    if (row) await recordAudit({ actorUserId: input.actorUserId, action: "affiliate.commission.pay", entityKind: "affiliate_commission", entityId: row.id, after: { affiliateId: row.affiliate_id } }, client);
  });
}

export async function updateAffiliateProfileStatus(input: {
  affiliateId: string;
  status: "active" | "suspended";
  actorUserId: string;
}) {
  await withPgTransaction(async (client) => {
    const before = await sqlOne<AffiliateProfile>(
      "select id,user_id,code,display_name,phone_e164,email,status,created_at from public.affiliate_profiles where id=$1 for update",
      [input.affiliateId],
      client,
    );
    if (!before) throw new Error("Affilie introuvable.");
    const updated = await sqlOne<AffiliateProfile>(
      "update public.affiliate_profiles set status=$2,updated_at=now() where id=$1 returning id,user_id,code,display_name,phone_e164,email,status,created_at",
      [input.affiliateId, input.status],
      client,
    );
    await recordAudit({
      actorUserId: input.actorUserId,
      action: "affiliate.update",
      entityKind: "affiliate_profile",
      entityId: input.affiliateId,
      before: { status: before.status },
      after: { status: updated?.status ?? input.status },
    }, client);
  });
}

export async function updateAffiliateProgramSettings(input: AffiliateProgramSettings & { actorUserId: string }) {
  await withPgTransaction(async (client) => {
    const before = await getAffiliateProgramSettings(client);
    const updated = await sqlOne<AffiliateProgramSettings>(`
      update public.affiliate_program_settings
      set enabled=$1,
          affiliate_trial_days=$2,
          first_payment_discount_bp=$3,
          first_payment_rate_bp=$4,
          first_payment_commission_type=$5,
          first_payment_fixed_amount=$6,
          sixth_month_rate_bp=$7,
          sixth_month_commission_type=$8,
          sixth_month_fixed_amount=$9,
          sixth_month_threshold_months=$10,
          payout_delay_days=$11,
          public_title=$12,
          public_description=$13,
          updated_at=now()
      where id=true
      returning enabled,affiliate_trial_days,first_payment_discount_bp,
        first_payment_rate_bp,first_payment_commission_type,first_payment_fixed_amount,
        sixth_month_rate_bp,sixth_month_commission_type,sixth_month_fixed_amount,
        sixth_month_threshold_months,payout_delay_days,public_title,public_description`,
      [
        input.enabled,
        input.affiliate_trial_days,
        input.first_payment_discount_bp,
        input.first_payment_rate_bp,
        input.first_payment_commission_type,
        input.first_payment_fixed_amount,
        input.sixth_month_rate_bp,
        input.sixth_month_commission_type,
        input.sixth_month_fixed_amount,
        input.sixth_month_threshold_months,
        input.payout_delay_days,
        input.public_title.trim(),
        input.public_description.trim(),
      ],
      client,
    );
    if (!updated) throw new Error("Parametres d'affiliation introuvables.");
    await recordAudit({
      actorUserId: input.actorUserId,
      action: "affiliate.settings.update",
      entityKind: "affiliate_program_settings",
      before,
      after: updated,
    }, client);
  });
}

export async function generateAffiliateCommissionsForPayment(input: {
  paymentId: string;
  reviewerUserId: string;
}, executor?: PgExecutor): Promise<void> {
  const settings = await getAffiliateProgramSettings(executor);
  if (!settings.enabled) return;
  const payment = await sqlOne<{ id: string; workshop_id: string; amount: number; currency: string; status: string }>(
    "select id,workshop_id,amount,currency,status::text from public.platform_payments where id=$1",
    [input.paymentId],
    executor,
  );
  if (!payment || payment.status !== "validated" || payment.amount <= 0) return;
  const attribution = await sqlOne<{ affiliate_id: string }>("select affiliate_id from public.affiliate_attributions where workshop_id=$1", [payment.workshop_id], executor);
  if (!attribution) return;
  const priorValidated = await sqlOne<{ n: number }>(
    "select count(*)::int n from public.platform_payments where workshop_id=$1 and status='validated' and id<>$2",
    [payment.workshop_id, payment.id],
    executor,
  );
  if ((priorValidated?.n ?? 0) === 0) {
    await insertCommission({
      affiliateId: attribution.affiliate_id,
      workshopId: payment.workshop_id,
      paymentId: payment.id,
      milestone: "first_payment",
      amount: commissionAmount(payment.amount, settings.first_payment_commission_type, settings.first_payment_rate_bp, settings.first_payment_fixed_amount),
      currency: payment.currency,
      rateBp: settings.first_payment_rate_bp,
      dueAt: addDays(todayIso(), settings.payout_delay_days),
    }, executor);
  }
  await maybeCreateSixthMonthCommission({ ...payment, affiliateId: attribution.affiliate_id, settings }, executor);
}

async function maybeCreateSixthMonthCommission(input: {
  id: string;
  workshop_id: string;
  amount: number;
  currency: string;
  affiliateId: string;
  settings: AffiliateProgramSettings;
}, executor?: PgExecutor) {
  const first = await sqlOne<{ period_start: string }>(
    "select min(period_start)::text period_start from public.subscription_periods where workshop_id=$1",
    [input.workshop_id],
    executor,
  );
  if (!first?.period_start) return;
  const threshold = addMonths(first.period_start, input.settings.sixth_month_threshold_months);
  const reached = await sqlOne<{ ok: boolean }>(
    "select exists(select 1 from public.subscription_periods where workshop_id=$1 and period_end >= $2) ok",
    [input.workshop_id, threshold],
    executor,
  );
  if (!reached?.ok) return;
  await insertCommission({
    affiliateId: input.affiliateId,
    workshopId: input.workshop_id,
    paymentId: input.id,
    milestone: "sixth_month",
    amount: commissionAmount(input.amount, input.settings.sixth_month_commission_type, input.settings.sixth_month_rate_bp, input.settings.sixth_month_fixed_amount),
    currency: input.currency,
    rateBp: input.settings.sixth_month_rate_bp,
    dueAt: addDays(threshold, input.settings.payout_delay_days),
  }, executor);
}

async function insertCommission(input: {
  affiliateId: string;
  workshopId: string;
  paymentId: string;
  milestone: "first_payment" | "sixth_month";
  amount: number;
  currency: string;
  rateBp: number;
  dueAt: string;
}, executor?: PgExecutor) {
  if (input.amount <= 0) return;
  await sql(`insert into public.affiliate_commissions(id,affiliate_id,workshop_id,platform_payment_id,milestone,amount,currency,rate_bp,due_at)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9)
    on conflict(workshop_id,milestone) do nothing`,
    [randomUUID(), input.affiliateId, input.workshopId, input.paymentId, input.milestone, input.amount, input.currency, input.rateBp, input.dueAt],
    executor,
  );
}

export async function getAffiliateProgramSettings(executor?: PgExecutor): Promise<AffiliateProgramSettings> {
  const row = await sqlOne<AffiliateProgramSettings>(`select enabled,affiliate_trial_days,first_payment_discount_bp,
      first_payment_rate_bp,first_payment_commission_type,first_payment_fixed_amount,
      sixth_month_rate_bp,sixth_month_commission_type,sixth_month_fixed_amount,sixth_month_threshold_months,
      payout_delay_days,public_title,public_description
    from public.affiliate_program_settings where id=true`, [], executor);
  return row ?? {
    enabled: true,
    affiliate_trial_days: 30,
    first_payment_discount_bp: 2000,
    first_payment_rate_bp: 2000,
    first_payment_commission_type: "percent",
    first_payment_fixed_amount: 0,
    sixth_month_rate_bp: 1000,
    sixth_month_commission_type: "percent",
    sixth_month_fixed_amount: 0,
    sixth_month_threshold_months: 6,
    payout_delay_days: 0,
    public_title: "Programme d'affiliation Fileo",
    public_description: "Recommandez Fileo aux ateliers et recevez une commission quand leurs paiements eligibles sont valides.",
  };
}

function commissionAmount(paymentAmount: number, type: AffiliateCommissionType, rateBp: number, fixedAmount: number) {
  return type === "fixed" ? fixedAmount : Math.trunc(paymentAmount * rateBp / 10000);
}

async function availableCode(base: string, executor?: PgExecutor) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${randomUUID().slice(0, 4).toUpperCase()}`;
    const code = `${base}${suffix}`.slice(0, 32);
    const exists = await sqlOne("select id from public.affiliate_profiles where code=$1", [code], executor);
    if (!exists) return code;
  }
  return `FILEO-${randomUUID().slice(0, 8).toUpperCase()}`;
}

async function reserveRequestedCode(code: string, executor?: PgExecutor) {
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    throw new AffiliateCodeError(
      "invalid_code",
      "Le code doit contenir uniquement des majuscules, des chiffres, '-' ou '_', entre 3 et 32 caracteres.",
    );
  }
  const exists = await sqlOne("select id from public.affiliate_profiles where code=$1", [code], executor);
  if (exists) throw new AffiliateCodeError("code_taken", "Ce code d'affiliation est deja pris.");
  return code;
}

function autoCodeBase(value: string) {
  const base = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return base || "FILEO";
}

function addMonths(start: string, months: number) {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function addDays(start: string, days: number) {
  const date = new Date(`${start}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
