import "server-only";

import { execute, newId, nowIso, query, queryOne } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { normaliseDigits } from "@/lib/phone";

/** Client records — cahier des charges §8.2. */

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
  created_at: string;
};

export type ClientListItem = ClientRow & {
  order_count: number;
  last_order_at: string | null;
};

export function listClients(
  workshopId: string,
  options: { search?: string; includeArchived?: boolean; limit?: number } = {},
): ClientListItem[] {
  const term = options.search?.trim() ?? "";
  const digits = normaliseDigits(term);

  // Name match, or phone match on the normalised digits form (§8.2).
  return query<ClientListItem>(
    `SELECT c.*,
            (SELECT COUNT(*) FROM orders o WHERE o.client_id = c.id) AS order_count,
            (SELECT MAX(o.created_at) FROM orders o WHERE o.client_id = c.id) AS last_order_at
       FROM clients c
      WHERE c.workshop_id = ?
        AND (? = 1 OR c.archived_at IS NULL)
        AND (
          ? = ''
          OR LOWER(c.display_name) LIKE '%' || LOWER(?) || '%'
          OR (? <> '' AND c.phone_search LIKE '%' || ? || '%')
        )
      ORDER BY c.display_name COLLATE NOCASE
      LIMIT ?`,
    [
      workshopId,
      options.includeArchived ? 1 : 0,
      term,
      term,
      digits,
      digits,
      options.limit ?? 200,
    ],
  );
}

export function getClient(workshopId: string, clientId: string): ClientRow | null {
  return queryOne<ClientRow>(`SELECT * FROM clients WHERE workshop_id = ? AND id = ?`, [
    workshopId,
    clientId,
  ]);
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
  const search = input.phoneE164 ? normaliseDigits(input.phoneE164) : null;

  execute(
    `INSERT INTO clients
       (id, workshop_id, display_name, phone_e164, phone_search, other_contact,
        guardian_name, guardian_phone, notes, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.workshopId,
      input.displayName.trim(),
      input.phoneE164 ?? null,
      search,
      input.otherContact ?? null,
      input.guardianName ?? null,
      input.guardianPhone ?? null,
      input.notes ?? null,
      input.actorUserId,
      nowIso(),
      nowIso(),
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

/**
 * Possible duplicates by phone (§8.2). Returns candidates rather than
 * blocking: families legitimately share a number.
 */
export function findPossibleDuplicates(
  workshopId: string,
  phoneE164: string,
  excludeId?: string,
): ClientRow[] {
  const digits = normaliseDigits(phoneE164);
  if (!digits) return [];

  return query<ClientRow>(
    `SELECT * FROM clients
      WHERE workshop_id = ? AND phone_search = ? AND (? IS NULL OR id <> ?)
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
      WHERE workshop_id = ? AND id = ?`,
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

/* ---------------------------------------------------------------
   Measurements (§8.3)
   --------------------------------------------------------------- */

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

/** Latest version per category — what a new order would default to. */
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

/**
 * Adds a new measurement version. Existing versions are never modified —
 * §8.3: "La modification crée une nouvelle version consultable."
 */
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
      id,
      params.workshopId,
      params.clientId,
      params.category,
      version,
      JSON.stringify(params.values),
      params.notes ?? null,
      params.takenAt ?? nowIso().slice(0, 10),
      params.actorUserId,
      nowIso(),
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

/** §8.3: warn when a reading is older than the configurable threshold. */
export function isMeasurementStale(takenAt: string, monthsThreshold = 6): boolean {
  const limit = new Date();
  limit.setMonth(limit.getMonth() - monthsThreshold);
  return new Date(takenAt) < limit;
}
