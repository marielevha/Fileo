import "server-only";

import { execute, newId, nowIso, query, queryOne } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
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

const SORT_SQL: Record<ClientSort, string> = {
  name: "c.display_name COLLATE NOCASE",
  phone: "c.phone_search",
  orders: "order_count",
  lastOrder: "last_order_at",
  createdAt: "c.created_at",
};

export function listClients(
  workshopId: string,
  options: {
    search?: string;
    includeArchived?: boolean;
    page?: number;
    pageSize?: number;
    sort?: ClientSort;
    direction?: SortDirection;
  } = {},
): ClientPage {
  const term = options.search?.trim() ?? "";
  const digits = normaliseDigits(term);
  const pageSize = Math.min(100, Math.max(10, options.pageSize ?? 20));
  const requestedPage = Math.max(1, options.page ?? 1);
  const sort = options.sort && options.sort in SORT_SQL ? options.sort : "name";
  const direction = options.direction === "desc" ? "DESC" : "ASC";
  const filters = `c.workshop_id = ?
        AND c.deleted_at IS NULL
        AND (? = 1 OR c.archived_at IS NULL)
        AND (
          ? = ''
          OR LOWER(c.display_name) LIKE '%' || LOWER(?) || '%'
          OR (? <> '' AND c.phone_search LIKE '%' || ? || '%')
        )`;
  const filterParams = [
    workshopId,
    options.includeArchived ? 1 : 0,
    term,
    term,
    digits,
    digits,
  ];

  const total = queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM clients c WHERE ${filters}`,
    filterParams,
  )?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, pageCount);
  const items = query<ClientListItem>(
    `SELECT c.*,
            (SELECT COUNT(*) FROM orders o WHERE o.client_id = c.id) AS order_count,
            (SELECT MAX(o.created_at) FROM orders o WHERE o.client_id = c.id) AS last_order_at
       FROM clients c
      WHERE ${filters}
      ORDER BY ${SORT_SQL[sort]} ${direction}, c.id ASC
      LIMIT ? OFFSET ?`,
    [...filterParams, pageSize, (page - 1) * pageSize],
  );
  return { items, total, page, pageSize, pageCount };
}

export function getClient(workshopId: string, clientId: string): ClientRow | null {
  return queryOne<ClientRow>(
    `SELECT * FROM clients WHERE workshop_id = ? AND id = ? AND deleted_at IS NULL`,
    [workshopId, clientId],
  );
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

export function createClient(input: CreateClientInput): string {
  const id = newId();
  execute(
    `INSERT INTO clients
       (id, workshop_id, display_name, phone_e164, phone_search, other_contact,
        guardian_name, guardian_phone, notes, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.workshopId, input.displayName.trim(), input.phoneE164 ?? null,
      input.phoneE164 ? normaliseDigits(input.phoneE164) : null,
      input.otherContact ?? null, input.guardianName ?? null,
      input.guardianPhone ?? null, input.notes ?? null, input.actorUserId,
      nowIso(), nowIso(),
    ],
  );
  recordAudit({
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

export function updateClient(input: UpdateClientInput): boolean {
  const before = getClient(input.workshopId, input.clientId);
  if (!before) return false;
  const result = execute(
    `UPDATE clients
        SET display_name = ?, phone_e164 = ?, phone_search = ?, other_contact = ?,
            guardian_name = ?, guardian_phone = ?, notes = ?, updated_at = ?,
            row_version = row_version + 1
      WHERE workshop_id = ? AND id = ? AND deleted_at IS NULL`,
    [
      input.displayName.trim(), input.phoneE164 ?? null,
      input.phoneE164 ? normaliseDigits(input.phoneE164) : null,
      input.otherContact ?? null, input.guardianName ?? null,
      input.guardianPhone ?? null, input.notes ?? null, nowIso(),
      input.workshopId, input.clientId,
    ],
  );
  if (Number(result.changes) === 0) return false;
  recordAudit({
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

export function softDeleteClient(params: {
  workshopId: string;
  clientId: string;
  actorUserId: string;
}): boolean {
  const timestamp = nowIso();
  const result = execute(
    `UPDATE clients
        SET deleted_at = ?, updated_at = ?, row_version = row_version + 1
      WHERE workshop_id = ? AND id = ? AND deleted_at IS NULL`,
    [timestamp, timestamp, params.workshopId, params.clientId],
  );
  if (Number(result.changes) === 0) return false;
  recordAudit({
    workshopId: params.workshopId,
    actorUserId: params.actorUserId,
    action: "client.delete",
    entityKind: "client",
    entityId: params.clientId,
  });
  return true;
}

export function findPossibleDuplicates(
  workshopId: string,
  phoneE164: string,
  excludeId?: string,
): ClientRow[] {
  const digits = normaliseDigits(phoneE164);
  if (!digits) return [];
  return query<ClientRow>(
    `SELECT * FROM clients
      WHERE workshop_id = ? AND phone_search = ? AND deleted_at IS NULL
        AND (? IS NULL OR id <> ?)
      LIMIT 5`,
    [workshopId, digits, excludeId ?? null, excludeId ?? null],
  );
}

export function archiveClient(params: {
  workshopId: string;
  clientId: string;
  actorUserId: string;
  archived: boolean;
}): void {
  execute(
    `UPDATE clients
        SET archived_at = ?, updated_at = ?, row_version = row_version + 1
      WHERE workshop_id = ? AND id = ? AND deleted_at IS NULL`,
    [params.archived ? nowIso() : null, nowIso(), params.workshopId, params.clientId],
  );
  recordAudit({
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

export function listMeasurements(workshopId: string, clientId: string): MeasurementRow[] {
  return query<MeasurementRow>(
    `SELECT * FROM measurement_records
      WHERE workshop_id = ? AND client_id = ?
      ORDER BY category, version DESC`,
    [workshopId, clientId],
  );
}

export function latestMeasurements(workshopId: string, clientId: string): MeasurementRow[] {
  return query<MeasurementRow>(
    `SELECT m.* FROM measurement_records m
      WHERE m.workshop_id = ? AND m.client_id = ?
        AND m.version = (
          SELECT MAX(m2.version) FROM measurement_records m2
           WHERE m2.client_id = m.client_id AND m2.category = m.category
        )
      ORDER BY m.category`,
    [workshopId, clientId],
  );
}

export function addMeasurementVersion(params: {
  workshopId: string;
  clientId: string;
  actorUserId: string;
  category: string;
  values: Record<string, number | null>;
  notes?: string | null;
  takenAt?: string;
}): string {
  const previous = queryOne<{ max_version: number | null }>(
    `SELECT MAX(version) AS max_version FROM measurement_records
      WHERE client_id = ? AND category = ?`,
    [params.clientId, params.category],
  );
  const id = newId();
  const version = (previous?.max_version ?? 0) + 1;
  execute(
    `INSERT INTO measurement_records
       (id, workshop_id, client_id, category, version, values_json, unit,
        notes, taken_at, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'cm', ?, ?, ?, ?)`,
    [
      id, params.workshopId, params.clientId, params.category, version,
      JSON.stringify(params.values), params.notes ?? null,
      params.takenAt ?? nowIso().slice(0, 10), params.actorUserId, nowIso(),
    ],
  );
  recordAudit({
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
