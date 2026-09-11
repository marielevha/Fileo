import "server-only";

import { recordAudit } from "@/lib/audit";
import { collection, newId, nowIso } from "@/lib/db";
import { normaliseDigits } from "@/lib/phone";

export type ClientRow = {
  id: string;
  workshop_id: string;
  display_name: string;
  phone_e164: string | null;
  phone_search: string | null;
  other_contact: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  notes: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientListItem = ClientRow & {
  order_count: number;
  last_order_at: string | null;
};

export type ClientSort = "name" | "phone" | "orders" | "lastOrder" | "createdAt";
export type SortDirection = "asc" | "desc";
export type ClientPage = {
  items: ClientListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listClients(
  workshopId: string,
  options: {
    search?: string;
    includeArchived?: boolean;
    page?: number;
    pageSize?: number;
    sort?: ClientSort;
    direction?: SortDirection;
  } = {},
): Promise<ClientPage> {
  const clients = await collection("clients");
  const term = options.search?.trim() ?? "";
  const digits = normaliseDigits(term);
  const pageSize = Math.min(100, Math.max(10, options.pageSize ?? 20));
  const requestedPage = Math.max(1, options.page ?? 1);
  const filter: Record<string, unknown> = {
    workshop_id: workshopId,
    deleted_at: null,
  };
  if (!options.includeArchived) filter.archived_at = null;
  if (term) {
    const choices: Record<string, unknown>[] = [
      { display_name: { $regex: escapeRegex(term), $options: "i" } },
    ];
    if (digits) choices.push({ phone_search: { $regex: escapeRegex(digits) } });
    filter.$or = choices;
  }

  const total = await clients.countDocuments(filter);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const sortField = {
    name: "display_name",
    phone: "phone_search",
    orders: "order_count",
    lastOrder: "last_order_at",
    createdAt: "created_at",
  }[options.sort ?? "name"] ?? "display_name";
  const direction = options.direction === "desc" ? -1 : 1;

  const items = await clients.aggregate<ClientListItem>([
    { $match: filter },
    {
      $lookup: {
        from: "orders",
        localField: "id",
        foreignField: "client_id",
        as: "client_orders",
      },
    },
    {
      $set: {
        order_count: { $size: "$client_orders" },
        last_order_at: { $max: "$client_orders.created_at" },
      },
    },
    { $unset: ["_id", "client_orders"] },
    { $sort: { [sortField]: direction, id: 1 } },
    { $skip: (page - 1) * pageSize },
    { $limit: pageSize },
  ], { collation: { locale: "fr", strength: 1 } }).toArray();

  return { items, total, page, pageSize, pageCount };
}

export async function getClient(workshopId: string, clientId: string): Promise<ClientRow | null> {
  const clients = await collection("clients");
  return clients.findOne(
    { workshop_id: workshopId, id: clientId, deleted_at: null },
    { projection: { _id: 0 } },
  ) as Promise<ClientRow | null>;
}

export type CreateClientInput = {
  workshopId: string;
  actorUserId: string;
  displayName: string;
  phoneE164?: string | null;
  otherContact?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  notes?: string | null;
};

export async function createClient(input: CreateClientInput): Promise<string> {
  const id = newId();
  const timestamp = nowIso();
  const clients = await collection("clients");
  await clients.insertOne({
    id,
    workshop_id: input.workshopId,
    display_name: input.displayName.trim(),
    phone_e164: input.phoneE164 ?? null,
    phone_search: input.phoneE164 ? normaliseDigits(input.phoneE164) : null,
    other_contact: input.otherContact ?? null,
    guardian_name: input.guardianName ?? null,
    guardian_phone: input.guardianPhone ?? null,
    notes: input.notes ?? null,
    archived_at: null,
    deleted_at: null,
    created_by: input.actorUserId,
    created_at: timestamp,
    updated_at: timestamp,
    row_version: 1,
  });
  await recordAudit({
    workshopId: input.workshopId,
    actorUserId: input.actorUserId,
    action: "client.create",
    entityKind: "client",
    entityId: id,
    after: { displayName: input.displayName },
  });
  return id;
}

export type UpdateClientInput = CreateClientInput & { clientId: string };

export async function updateClient(input: UpdateClientInput): Promise<boolean> {
  const before = await getClient(input.workshopId, input.clientId);
  if (!before) return false;
  const clients = await collection("clients");
  const result = await clients.updateOne(
    { workshop_id: input.workshopId, id: input.clientId, deleted_at: null },
    {
      $set: {
        display_name: input.displayName.trim(),
        phone_e164: input.phoneE164 ?? null,
        phone_search: input.phoneE164 ? normaliseDigits(input.phoneE164) : null,
        other_contact: input.otherContact ?? null,
        guardian_name: input.guardianName ?? null,
        guardian_phone: input.guardianPhone ?? null,
        notes: input.notes ?? null,
        updated_at: nowIso(),
      },
      $inc: { row_version: 1 },
    },
  );
  if (result.modifiedCount === 0) return false;
  await recordAudit({
    workshopId: input.workshopId,
    actorUserId: input.actorUserId,
    action: "client.update",
    entityKind: "client",
    entityId: input.clientId,
    before: { displayName: before.display_name, phone: before.phone_e164 },
    after: { displayName: input.displayName, phone: input.phoneE164 ?? null },
  });
  return true;
}

export async function softDeleteClient(params: {
  workshopId: string;
  clientId: string;
  actorUserId: string;
}): Promise<boolean> {
  const timestamp = nowIso();
  const clients = await collection("clients");
  const result = await clients.updateOne(
    { workshop_id: params.workshopId, id: params.clientId, deleted_at: null },
    { $set: { deleted_at: timestamp, updated_at: timestamp }, $inc: { row_version: 1 } },
  );
  if (result.modifiedCount === 0) return false;
  await recordAudit({
    workshopId: params.workshopId,
    actorUserId: params.actorUserId,
    action: "client.delete",
    entityKind: "client",
    entityId: params.clientId,
  });
  return true;
}

export async function findPossibleDuplicates(
  workshopId: string,
  phoneE164: string,
  excludeId?: string,
): Promise<ClientRow[]> {
  const digits = normaliseDigits(phoneE164);
  if (!digits) return [];
  const clients = await collection("clients");
  return clients.find({
    workshop_id: workshopId,
    phone_search: digits,
    deleted_at: null,
    ...(excludeId ? { id: { $ne: excludeId } } : {}),
  }, { projection: { _id: 0 } }).limit(5).toArray() as unknown as Promise<ClientRow[]>;
}

export async function archiveClient(params: {
  workshopId: string;
  clientId: string;
  actorUserId: string;
  archived: boolean;
}): Promise<void> {
  const clients = await collection("clients");
  await clients.updateOne(
    { workshop_id: params.workshopId, id: params.clientId, deleted_at: null },
    {
      $set: { archived_at: params.archived ? nowIso() : null, updated_at: nowIso() },
      $inc: { row_version: 1 },
    },
  );
  await recordAudit({
    workshopId: params.workshopId,
    actorUserId: params.actorUserId,
    action: "client.archive",
    entityKind: "client",
    entityId: params.clientId,
    after: { archived: params.archived },
  });
}

export type MeasurementRow = {
  id: string;
  client_id: string;
  category: string;
  version: number;
  values_json: string;
  unit: string;
  notes: string | null;
  taken_at: string;
  created_at: string;
};

export async function listMeasurements(workshopId: string, clientId: string): Promise<MeasurementRow[]> {
  const measurements = await collection("measurement_records");
  return measurements.find(
    { workshop_id: workshopId, client_id: clientId },
    { projection: { _id: 0 } },
  ).sort({ category: 1, version: -1 }).toArray() as unknown as Promise<MeasurementRow[]>;
}

export async function latestMeasurements(workshopId: string, clientId: string): Promise<MeasurementRow[]> {
  const measurements = await collection("measurement_records");
  return measurements.aggregate<MeasurementRow>([
    { $match: { workshop_id: workshopId, client_id: clientId } },
    { $sort: { category: 1, version: -1 } },
    { $group: { _id: "$category", row: { $first: "$$ROOT" } } },
    { $replaceWith: "$row" },
    { $unset: "_id" },
    { $sort: { category: 1 } },
  ]).toArray();
}

export async function addMeasurementVersion(params: {
  workshopId: string;
  clientId: string;
  actorUserId: string;
  category: string;
  values: Record<string, number | null>;
  notes?: string | null;
  takenAt?: string;
}): Promise<string> {
  const measurements = await collection("measurement_records");
  const previous = await measurements.findOne(
    { workshop_id: params.workshopId, client_id: params.clientId, category: params.category },
    { sort: { version: -1 }, projection: { version: 1 } },
  );
  const id = newId();
  const version = Number(previous?.version ?? 0) + 1;
  await measurements.insertOne({
    id,
    workshop_id: params.workshopId,
    client_id: params.clientId,
    template_id: null,
    category: params.category,
    version,
    values_json: JSON.stringify(params.values),
    unit: "cm",
    notes: params.notes ?? null,
    taken_at: params.takenAt ?? nowIso().slice(0, 10),
    created_by: params.actorUserId,
    created_at: nowIso(),
  });
  await recordAudit({
    workshopId: params.workshopId,
    actorUserId: params.actorUserId,
    action: "measurement.create",
    entityKind: "measurement_record",
    entityId: id,
    after: { category: params.category, version },
  });
  return id;
}

export function isMeasurementStale(takenAt: string, monthsThreshold = 6): boolean {
  const limit = new Date();
  limit.setMonth(limit.getMonth() - monthsThreshold);
  return new Date(takenAt) < limit;
}
