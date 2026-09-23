import "server-only";

import { randomUUID } from "node:crypto";
import { recordAudit } from "@/lib/audit";
import { normaliseDigits } from "@/lib/phone";
import { sql, sqlOne, withPgTransaction, type PgExecutor } from "@/lib/supabase/postgres";

export type ClientRow = {
  id: string; workshop_id: string; display_name: string; phone_e164: string | null;
  phone_search: string | null; other_contact: string | null; guardian_name: string | null;
  guardian_phone: string | null; notes: string | null; archived_at: string | null;
  deleted_at: string | null; created_at: string; updated_at: string; row_version: number;
};
export type ClientListItem = ClientRow & { order_count: number; last_order_at: string | null };
export type ClientSort = "name" | "phone" | "orders" | "lastOrder" | "createdAt";
export type SortDirection = "asc" | "desc";
export type ClientPage = { items: ClientListItem[]; total: number; page: number; pageSize: number; pageCount: number };

export async function listClients(workshopId: string, options: {
  search?: string; includeArchived?: boolean; page?: number; pageSize?: number;
  sort?: ClientSort; direction?: SortDirection;
} = {}): Promise<ClientPage> {
  const term = options.search?.trim() ?? "";
  const digits = normaliseDigits(term);
  const pageSize = Math.min(100, Math.max(10, options.pageSize ?? 20));
  const requestedPage = Math.max(1, options.page ?? 1);
  const conditions = ["c.workshop_id = $1", "c.deleted_at is null"];
  const values: unknown[] = [workshopId];
  if (!options.includeArchived) conditions.push("c.archived_at is null");
  if (term) {
    values.push(`%${term}%`);
    const textParameter = values.length;
    const searchConditions = [
      `c.display_name ilike $${textParameter}`,
      `c.other_contact ilike $${textParameter}`,
    ];
    if (digits) {
      values.push(`%${digits}%`);
      searchConditions.push(`c.phone_search like $${values.length}`);
    }
    conditions.push(`(${searchConditions.join(" or ")})`);
  }
  const where = conditions.join(" and ");
  const count = await sqlOne<{ total: number }>(`select count(*)::int as total from public.clients c where ${where}`, values);
  const total = count?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const order = ({ name: "c.display_name", phone: "c.phone_search", orders: "order_count", lastOrder: "last_order_at", createdAt: "c.created_at" } as const)[options.sort ?? "name"];
  const direction = options.direction === "desc" ? "desc" : "asc";
  values.push(pageSize, (page - 1) * pageSize);
  const items = await sql<ClientListItem>(`
    select c.id, c.workshop_id, c.display_name, c.phone_e164, c.phone_search, c.other_contact,
      c.guardian_name, c.guardian_phone, c.notes, c.archived_at, c.deleted_at, c.created_at, c.updated_at, c.row_version,
      count(o.id)::int as order_count, max(o.created_at) as last_order_at
    from public.clients c left join public.orders o on o.client_id = c.id
    where ${where}
    group by c.id
    order by ${order} ${direction} nulls last, c.id
    limit $${values.length - 1} offset $${values.length}`, values);
  return { items, total, page, pageSize, pageCount };
}

export async function getClient(workshopId: string, clientId: string): Promise<ClientRow | null> {
  return sqlOne<ClientRow>("select * from public.clients where workshop_id=$1 and id=$2 and deleted_at is null", [workshopId, clientId]);
}

export type CreateClientInput = {
  workshopId: string; actorUserId: string; displayName: string; phoneE164?: string | null;
  otherContact?: string | null; guardianName?: string | null; guardianPhone?: string | null; notes?: string | null;
};

export async function createClient(input: CreateClientInput): Promise<string> {
  const id = randomUUID();
  await withPgTransaction(async client => {
    await sql(`insert into public.clients
      (id,workshop_id,display_name,phone_e164,phone_search,other_contact,guardian_name,guardian_phone,notes,created_by)
      values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [
      id,input.workshopId,input.displayName.trim(),input.phoneE164 ?? null,
      input.phoneE164 ? normaliseDigits(input.phoneE164) : null,input.otherContact ?? null,
      input.guardianName ?? null,input.guardianPhone ?? null,input.notes ?? null,input.actorUserId,
    ], client);
    await recordAudit({workshopId:input.workshopId,actorUserId:input.actorUserId,action:"client.create",entityKind:"client",entityId:id,after:{displayName:input.displayName}}, client);
  });
  return id;
}

export type UpdateClientInput = CreateClientInput & { clientId: string };
export async function updateClient(input: UpdateClientInput): Promise<boolean> {
  return withPgTransaction(async client => {
    const before = await sqlOne<ClientRow>("select * from public.clients where workshop_id=$1 and id=$2 and deleted_at is null for update", [input.workshopId,input.clientId], client);
    if (!before) return false;
    await sql(`update public.clients set display_name=$3,phone_e164=$4,phone_search=$5,other_contact=$6,
      guardian_name=$7,guardian_phone=$8,notes=$9,row_version=row_version+1 where workshop_id=$1 and id=$2`, [
      input.workshopId,input.clientId,input.displayName.trim(),input.phoneE164 ?? null,
      input.phoneE164 ? normaliseDigits(input.phoneE164) : null,input.otherContact ?? null,
      input.guardianName ?? null,input.guardianPhone ?? null,input.notes ?? null,
    ], client);
    await recordAudit({workshopId:input.workshopId,actorUserId:input.actorUserId,action:"client.update",entityKind:"client",entityId:input.clientId,before:{displayName:before.display_name,phone:before.phone_e164},after:{displayName:input.displayName,phone:input.phoneE164 ?? null}}, client);
    return true;
  });
}

export async function softDeleteClient(params:{workshopId:string;clientId:string;actorUserId:string}):Promise<boolean>{
  return withPgTransaction(async client => {
    const rows=await sql<{id:string}>("update public.clients set deleted_at=now(),row_version=row_version+1 where workshop_id=$1 and id=$2 and deleted_at is null returning id",[params.workshopId,params.clientId],client);
    if(!rows.length)return false;
    await recordAudit({workshopId:params.workshopId,actorUserId:params.actorUserId,action:"client.delete",entityKind:"client",entityId:params.clientId},client);
    return true;
  });
}

export async function findPossibleDuplicates(workshopId:string,phoneE164:string,excludeId?:string):Promise<ClientRow[]>{
  const digits=normaliseDigits(phoneE164); if(!digits)return [];
  return sql<ClientRow>(`select * from public.clients where workshop_id=$1 and phone_search=$2 and deleted_at is null
    and ($3::uuid is null or id<>$3::uuid) limit 5`,[workshopId,digits,excludeId ?? null]);
}

export async function archiveClient(params:{workshopId:string;clientId:string;actorUserId:string;archived:boolean}):Promise<void>{
  await withPgTransaction(async client=>{
    await sql("update public.clients set archived_at=case when $3 then now() else null end,row_version=row_version+1 where workshop_id=$1 and id=$2 and deleted_at is null",[params.workshopId,params.clientId,params.archived],client);
    await recordAudit({workshopId:params.workshopId,actorUserId:params.actorUserId,action:"client.archive",entityKind:"client",entityId:params.clientId,after:{archived:params.archived}},client);
  });
}

export type MeasurementRow={id:string;client_id:string;category:string;version:number;values_json:string;unit:string;notes:string|null;taken_at:string;created_at:string};
export async function getMeasurement(workshopId:string,clientId:string,measurementId:string):Promise<MeasurementRow|null>{
  return sqlOne<MeasurementRow>("select id,client_id,category,version,values_json::text,unit,notes,taken_at,created_at from public.measurement_records where workshop_id=$1 and client_id=$2 and id=$3",[workshopId,clientId,measurementId]);
}
export async function listMeasurements(workshopId:string,clientId:string):Promise<MeasurementRow[]>{
  return sql<MeasurementRow>("select id,client_id,category,version,values_json::text,unit,notes,taken_at,created_at from public.measurement_records where workshop_id=$1 and client_id=$2 order by category,version desc",[workshopId,clientId]);
}
export async function latestMeasurements(workshopId:string,clientId:string):Promise<MeasurementRow[]>{
  return sql<MeasurementRow>(`select distinct on(category) id,client_id,category,version,values_json::text,unit,notes,taken_at,created_at
    from public.measurement_records where workshop_id=$1 and client_id=$2 order by category,version desc`,[workshopId,clientId]);
}
export async function addMeasurementVersion(params:{workshopId:string;clientId:string;actorUserId:string;category:string;values:Record<string,number|null>;notes?:string|null;takenAt?:string;id?:string;mobileOperationId?:string},executor?:PgExecutor):Promise<string>{
  const id=params.id??randomUUID();
  const work=async(client:PgExecutor)=>{
    const parent=await sqlOne("select id from public.clients where id=$1 and workshop_id=$2 and deleted_at is null for update",[params.clientId,params.workshopId],client);
    if(!parent)throw new Error("Client introuvable pour ces mensurations.");
    const previous=await sqlOne<{version:number}>("select version from public.measurement_records where workshop_id=$1 and client_id=$2 and category=$3 order by version desc limit 1",[params.workshopId,params.clientId,params.category],client);
    const version=(previous?.version ?? 0)+1;
    await sql(`insert into public.measurement_records(id,workshop_id,client_id,category,version,values_json,unit,notes,taken_at,created_by)
      values($1,$2,$3,$4,$5,$6::jsonb,'cm',$7,coalesce($8::timestamptz,now()),$9)`,[id,params.workshopId,params.clientId,params.category,version,JSON.stringify(params.values),params.notes ?? null,params.takenAt ?? null,params.actorUserId],client);
    await recordAudit({workshopId:params.workshopId,actorUserId:params.actorUserId,action:"measurement.create",entityKind:"measurement_record",entityId:id,after:{category:params.category,version},mobileOperationId:params.mobileOperationId},client);
    return id;
  };
  return executor?work(executor):withPgTransaction(work);
}
export function isMeasurementStale(takenAt:string,monthsThreshold=6):boolean{const limit=new Date();limit.setMonth(limit.getMonth()-monthsThreshold);return new Date(takenAt)<limit;}
