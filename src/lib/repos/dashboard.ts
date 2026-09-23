import "server-only";
import { money,type CurrencyCode,type Money } from "@/lib/money";
import { sql,sqlOne } from "@/lib/supabase/postgres";
import { collectedBetween } from "./payments";
export type DashboardCounts={dueToday:number;dueWithinSevenDays:number;late:number;readyNotDelivered:number};
export type DashboardMoney={outstanding:Money;collectedThisMonth:Money};
const today=()=>new Date().toISOString().slice(0,10);
export async function getDashboardCounts(workshopId:string):Promise<DashboardCounts>{
 const row=await sqlOne<DashboardCounts>(`select
 count(*) filter(where coalesce(i.due_date,o.promised_date)=current_date and i.status not in('delivered','cancelled'))::int as "dueToday",
 count(*) filter(where coalesce(i.due_date,o.promised_date) between current_date and current_date+7 and i.status not in('delivered','cancelled'))::int as "dueWithinSevenDays",
 count(*) filter(where coalesce(i.due_date,o.promised_date)<current_date and i.status not in('delivered','cancelled'))::int as late,
 count(*) filter(where i.status='ready')::int as "readyNotDelivered"
 from public.order_items i join public.orders o on o.id=i.order_id where i.workshop_id=$1 and o.cancelled_at is null`,[workshopId]);
 return row??{dueToday:0,dueWithinSevenDays:0,late:0,readyNotDelivered:0};
}
export async function getDashboardMoney(workshopId:string,currency:CurrencyCode):Promise<DashboardMoney>{
 const row=await sqlOne<{outstanding:number}>(`with totals as(
 select o.id,greatest(coalesce(sum(i.unit_price_amount*i.quantity) filter(where i.status<>'cancelled'),0)-o.discount_amount,0) total
 from public.orders o left join public.order_items i on i.order_id=o.id where o.workshop_id=$1 and o.cancelled_at is null group by o.id),
 paid as(select order_id,coalesce(sum(case when kind='payment' then amount when kind='refund' then -amount else 0 end) filter(where status='confirmed'),0) net from public.financial_movements where workshop_id=$1 group by order_id)
 select coalesce(sum(greatest(t.total-coalesce(p.net,0),0)),0)::int outstanding from totals t left join paid p on p.order_id=t.id`,[workshopId]);
 const monthStart=`${today().slice(0,7)}-01`;
 return{outstanding:money(row?.outstanding??0,currency),collectedThisMonth:await collectedBetween(workshopId,monthStart,today(),currency)};
}
export type AgendaItem={item_id:string;order_id:string;reference:string;client_name:string;description:string;status:string;due_date:string|null};
export type AgendaFilter="today"|"late"|"ready"|"week";
export type AgendaPage={items:AgendaItem[];page:number;pageSize:number;total:number};
const agendaConditions:Record<AgendaFilter,string>={
 today:"coalesce(i.due_date,o.promised_date)=current_date and i.status not in('delivered','cancelled')",
 late:"coalesce(i.due_date,o.promised_date)<current_date and i.status not in('delivered','cancelled')",
 ready:"i.status='ready'",
 week:"coalesce(i.due_date,o.promised_date) between current_date and current_date+7 and i.status not in('delivered','cancelled')",
};
export async function listAgendaPage(workshopId:string,filter:AgendaFilter,page:number,pageSize=10):Promise<AgendaPage>{
 const where=`i.workshop_id=$1 and o.cancelled_at is null and ${agendaConditions[filter]}`;
 const [count,items]=await Promise.all([
  sqlOne<{total:number}>(`select count(*)::int total from public.order_items i join public.orders o on o.id=i.order_id where ${where}`,[workshopId]),
  sql<AgendaItem>(`select i.id item_id,i.order_id,o.reference,c.display_name client_name,coalesce(i.description,'') description,
 case i.status when 'todo' then 'a_realiser' when 'ready' then 'pret' when 'in_progress' then 'en_cours' when 'fitting' then 'a_essayer' when 'delivered' then 'remis' else 'annule' end status,
 coalesce(i.due_date,o.promised_date)::text due_date from public.order_items i join public.orders o on o.id=i.order_id join public.clients c on c.id=o.client_id
 where ${where} order by coalesce(i.due_date,o.promised_date) nulls last,o.reference,i.sort_order,i.id limit $2 offset $3`,[workshopId,pageSize,(page-1)*pageSize]),
 ]);
 return {items,page,pageSize,total:count?.total??0};
}
export async function getAgenda(workshopId:string,limit=25):Promise<AgendaItem[]>{
 return sql<AgendaItem>(`select i.id item_id,i.order_id,o.reference,c.display_name client_name,coalesce(i.description,'') description,
 case i.status when 'todo' then 'a_realiser' when 'ready' then 'pret' when 'in_progress' then 'en_cours' when 'fitting' then 'a_essayer' when 'delivered' then 'remis' else 'annule' end status,
 coalesce(i.due_date,o.promised_date) due_date from public.order_items i join public.orders o on o.id=i.order_id join public.clients c on c.id=o.client_id
 where i.workshop_id=$1 and i.status not in('delivered','cancelled') and o.cancelled_at is null order by due_date nulls last limit $2`,[workshopId,limit]);
}
