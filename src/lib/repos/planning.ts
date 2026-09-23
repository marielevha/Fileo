import "server-only";
import {sql,sqlOne} from "@/lib/supabase/postgres";
import {ITEM_STATUSES,type ItemStatus} from "@/lib/repos/orders";
export type PlanningStatusFilter=ItemStatus|"active"|"all";export type PlanningAssigneeFilter=string|"unassigned"|"all";
export type PlanningMember={id:string;full_name:string;role:string};
export type PlanningItem={item_id:string;order_id:string;workshop_id:string;reference:string;client_name:string;category:string;description:string;quantity:number;status:ItemStatus;explicit_due_date:string|null;effective_due_date:string|null;promised_date:string|null;fitting_date:string|null;delivered_at:string|null;assignee_user_id:string|null;assignee_name:string|null;row_version:number};
export type PlanningItemForUpdate={item_id:string;order_id:string;workshop_id:string;status:ItemStatus;due_date:string|null;delivered_at:string|null;cancelled_at:string|null;assignee_user_id:string|null;quantity:number;row_version:number};
export const dbItemStatus=(s:ItemStatus)=>({a_realiser:"todo",en_cours:"in_progress",a_essayer:"fitting",pret:"ready",remis:"delivered",annule:"cancelled"} as const)[s];
const statusCase=`case i.status when 'todo' then 'a_realiser' when 'in_progress' then 'en_cours' when 'fitting' then 'a_essayer' when 'ready' then 'pret' when 'delivered' then 'remis' else 'annule' end`;
export async function listPlanningMembers(workshopId:string):Promise<PlanningMember[]>{return sql<PlanningMember>(`select u.id,u.full_name,m.role::text from public.memberships m join public.app_users u on u.id=m.user_id where m.workshop_id=$1 and m.status='active' and u.status='active' order by case when m.role='owner' then 0 else 1 end,u.full_name`,[workshopId]);}
export async function listPlanningItems(workshopId:string,filters:{search?:string;status?:PlanningStatusFilter;assignee?:PlanningAssigneeFilter}={}):Promise<{items:PlanningItem[];truncated:boolean}>{
 const where=["i.workshop_id=$1","o.cancelled_at is null"];const values:unknown[]=[workshopId];
 if(!filters.status||filters.status==="active")where.push("i.status not in('delivered','cancelled')");else if(filters.status!=="all"&&ITEM_STATUSES.includes(filters.status)){values.push(dbItemStatus(filters.status));where.push(`i.status=$${values.length}`);}
 if(filters.assignee==="unassigned")where.push("i.assignee_user_id is null");else if(filters.assignee&&filters.assignee!=="all"){values.push(filters.assignee);where.push(`i.assignee_user_id=$${values.length}`);}
 if(filters.search?.trim()){values.push(`%${filters.search.trim()}%`);where.push(`(i.description ilike $${values.length} or i.category ilike $${values.length} or o.reference ilike $${values.length} or c.display_name ilike $${values.length})`);}
 const rows=await sql<PlanningItem>(`select i.id item_id,i.order_id,i.workshop_id,o.reference,c.display_name client_name,i.category,coalesce(i.description,'') description,i.quantity,${statusCase} status,
 i.due_date::text explicit_due_date,coalesce(i.due_date,o.promised_date)::text effective_due_date,o.promised_date::text promised_date,o.fitting_date::text fitting_date,i.delivered_at,i.assignee_user_id,u.full_name assignee_name,i.row_version
 from public.order_items i join public.orders o on o.id=i.order_id join public.clients c on c.id=o.client_id left join public.app_users u on u.id=i.assignee_user_id
 where ${where.join(" and ")} order by case when i.status not in('delivered','cancelled') and coalesce(i.due_date,o.promised_date)<current_date then 0 when coalesce(i.due_date,o.promised_date)=current_date then 1 when coalesce(i.due_date,o.promised_date) is null then 3 else 2 end,coalesce(i.due_date,o.promised_date),o.reference,i.sort_order,i.id limit 501`,values);
 return {items:rows.slice(0,500),truncated:rows.length>500};
}
export async function getPlanningItemForUpdate(workshopId:string,itemId:string):Promise<PlanningItemForUpdate|null>{return sqlOne<PlanningItemForUpdate>(`select i.id item_id,i.order_id,i.workshop_id,${statusCase} status,i.due_date::text due_date,i.delivered_at,i.cancelled_at,i.assignee_user_id,i.quantity,i.row_version from public.order_items i join public.orders o on o.id=i.order_id where i.workshop_id=$1 and i.id=$2 and o.cancelled_at is null`,[workshopId,itemId]);}
export async function isActivePlanningMember(workshopId:string,userId:string):Promise<boolean>{return Boolean(await sqlOne("select 1 from public.memberships m join public.app_users u on u.id=m.user_id where m.workshop_id=$1 and m.user_id=$2 and m.status='active' and u.status='active'",[workshopId,userId]));}
