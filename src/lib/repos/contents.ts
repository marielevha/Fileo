import "server-only";
import type {CurrencyCode} from "@/lib/money";
import {sql,sqlOne} from "@/lib/supabase/postgres";
import type {Locale} from "@/lib/i18n/config";
export type ContentKind="page"|"faq"|"tutorial"|"news";
export type ContentRow={id:string;kind:string;slug:string;locale:string;title:string;summary:string|null;body:string|null;task_key:string|null;duration_seconds:number|null;transcript:string|null;video_url:string|null;sort_order:number;status:string;published_at:string|null;updated_at:string};
const logicalKind=`case when kind='guide' then 'tutorial' when kind='page' and body_json->>'source_kind'='news' then 'news' else kind::text end`;
const contentSelect=`id,${logicalKind} kind,slug,locale,title,summary,body,task_key,duration_seconds,transcript,video_url,sort_order,status,published_at,updated_at`;
export async function listPublished(kind:ContentKind,limit=100,locale:Locale="fr"):Promise<ContentRow[]>{return sql<ContentRow>(`select ${contentSelect} from public.contents where ${logicalKind}=$1 and status='published' and locale=$3 order by sort_order,published_at desc limit $2`,[kind,limit,locale]);}
export async function getPublished(kind:ContentKind,slug:string):Promise<ContentRow|null>{return sqlOne<ContentRow>(`select ${contentSelect} from public.contents where ${logicalKind}=$1 and slug=$2 and status='published' and locale='fr'`,[kind,slug]);}
export async function listAllContents(kind?:ContentKind):Promise<ContentRow[]>{return sql<ContentRow>(`select ${contentSelect} from public.contents where ($1::text is null or ${logicalKind}=$1) order by kind,sort_order,updated_at desc`,[kind??null]);}
export type PlanRow={id:string;code:string;label:string;country_code:string;currency:string;price_amount:number;period_months:number;limits_json:string;version:number;effective_from:string;archived_at:string|null};
export type PlanLimits={members:number|null;storageMb:number|null;orders:number|null};
export function parseLimits(raw:string):PlanLimits{try{const p=JSON.parse(raw) as Partial<PlanLimits>;return{members:p.members??null,storageMb:p.storageMb??null,orders:p.orders??null};}catch{return{members:null,storageMb:null,orders:null};}}
const planSelect="id,code,label,country_code,currency,price_amount,period_months,limits_json::text,version,effective_from,archived_at";
export async function listActivePlans():Promise<PlanRow[]>{return sql<PlanRow>(`select distinct on(code,country_code) ${planSelect} from public.plans where status='active' order by code,country_code,version desc`);}
export async function listAllPlans():Promise<PlanRow[]>{return sql<PlanRow>(`select ${planSelect} from public.plans order by country_code,code,version desc`);}
export function planCurrency(plan:PlanRow):CurrencyCode{return plan.currency as CurrencyCode;}
