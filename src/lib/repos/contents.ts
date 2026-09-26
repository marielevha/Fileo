import "server-only";
import type {CurrencyCode} from "@/lib/money";
import {recordAudit} from "@/lib/audit";
import {sql,sqlOne,withPgTransaction} from "@/lib/supabase/postgres";
import type {Locale} from "@/lib/i18n/config";
export { parseLimits, type PlanLimits } from "@/lib/plan-limits";
import { parseLimits, type PlanLimits } from "@/lib/plan-limits";
export type ContentKind="page"|"faq"|"tutorial"|"news";
export type ContentRow={id:string;kind:string;slug:string;locale:string;title:string;summary:string|null;body:string|null;task_key:string|null;duration_seconds:number|null;transcript:string|null;video_url:string|null;sort_order:number;status:string;published_at:string|null;updated_at:string};
const logicalKind=`case when kind='guide' then 'tutorial' when kind='page' and body_json->>'source_kind'='news' then 'news' else kind::text end`;
const contentSelect=`id,${logicalKind} kind,slug,locale,title,summary,body,task_key,duration_seconds,transcript,video_url,sort_order,status,published_at,updated_at`;
export async function listPublished(kind:ContentKind,limit=100,locale:Locale="fr"):Promise<ContentRow[]>{return sql<ContentRow>(`select ${contentSelect} from public.contents where ${logicalKind}=$1 and status='published' and locale=$3 order by sort_order,published_at desc limit $2`,[kind,limit,locale]);}
export async function getPublished(kind:ContentKind,slug:string):Promise<ContentRow|null>{return sqlOne<ContentRow>(`select ${contentSelect} from public.contents where ${logicalKind}=$1 and slug=$2 and status='published' and locale='fr'`,[kind,slug]);}
export async function listAllContents(kind?:ContentKind):Promise<ContentRow[]>{return sql<ContentRow>(`select ${contentSelect} from public.contents where ($1::text is null or ${logicalKind}=$1) order by kind,sort_order,updated_at desc`,[kind??null]);}
export type PlanRow={id:string;code:string;label:string;country_code:string;currency:string;price_amount:number;period_months:number;trial_days:number;is_public:boolean;limits_json:string;version:number;effective_from:string;archived_at:string|null;status?:string};
const planSelect="id,code,label,country_code,currency,price_amount,period_months,trial_days,is_public,limits_json::text,version,effective_from,archived_at";
export async function listActivePlans():Promise<PlanRow[]>{return sql<PlanRow>(`select * from (
  select distinct on(code,country_code) ${planSelect}
  from public.plans
  where status='active' and is_public
  order by code,country_code,version desc
) active_plans
order by price_amount asc,period_months asc,code asc,country_code asc`);}
export async function listAllPlans():Promise<PlanRow[]>{return sql<PlanRow>(`select ${planSelect},status::text from public.plans order by country_code,price_amount,code,version desc`);}
export function planCurrency(plan:PlanRow):CurrencyCode{return plan.currency as CurrencyCode;}

export async function updatePlanSettings(input:{
  planId:string;
  actorUserId:string;
  label:string;
  priceAmount:number;
  periodMonths:number;
  trialDays:number;
  members:number;
  templates:number;
  storageMb:number;
  notifications:boolean;
  isPublic:boolean;
  status:"active"|"archived";
}):Promise<void>{
  await withPgTransaction(async client=>{
    const before=await sqlOne<PlanRow&{status:string}>(`select ${planSelect},status::text from public.plans where id=$1 for update`,[input.planId],client);
    if(!before)throw new Error("Offre introuvable.");
    const previousLimits=parseLimits(before.limits_json);
    const limits:PlanLimits={...previousLimits,members:input.members,templates:input.templates,storageMb:input.storageMb,notifications:input.notifications};
    const archivedAt=input.status==="archived"?(before.archived_at??new Date().toISOString()):null;
    await sql(`update public.plans
      set label=$2,name=$2,price_amount=$3,period_months=$4,billing_period_months=$4,trial_days=$5,
          max_active_members=$6,limits_json=$7::jsonb,status=$8::public.plan_status,archived_at=$9,is_public=$10
      where id=$1`,[
        input.planId,input.label,input.priceAmount,input.periodMonths,input.trialDays,
        input.members,JSON.stringify(limits),input.status,archivedAt,input.isPublic,
      ],client);
    await recordAudit({
      actorUserId:input.actorUserId,
      action:"plan.update",
      entityKind:"plan",
      entityId:input.planId,
      before:{label:before.label,priceAmount:before.price_amount,periodMonths:before.period_months,trialDays:before.trial_days,isPublic:before.is_public,status:before.status,limits:previousLimits},
      after:{label:input.label,priceAmount:input.priceAmount,periodMonths:input.periodMonths,trialDays:input.trialDays,isPublic:input.isPublic,status:input.status,limits},
    },client);
  });
}

export async function updatePlanFlags(input:{
  planId:string;
  actorUserId:string;
  isPublic:boolean;
  status:"active"|"archived";
}):Promise<void>{
  await withPgTransaction(async client=>{
    const before=await sqlOne<PlanRow&{status:string}>(`select ${planSelect},status::text from public.plans where id=$1 for update`,[input.planId],client);
    if(!before)throw new Error("Offre introuvable.");
    const archivedAt=input.status==="archived"?(before.archived_at??new Date().toISOString()):null;
    await sql("update public.plans set is_public=$2,status=$3::public.plan_status,archived_at=$4 where id=$1",[
      input.planId,input.isPublic,input.status,archivedAt,
    ],client);
    await recordAudit({
      actorUserId:input.actorUserId,
      action:"plan.update",
      entityKind:"plan",
      entityId:input.planId,
      before:{isPublic:before.is_public,status:before.status},
      after:{isPublic:input.isPublic,status:input.status},
    },client);
  });
}
