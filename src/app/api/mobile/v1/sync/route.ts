import { recordAudit } from "@/lib/audit";
import { mobileHandler, MobileApiError, ok, parseJsonBody, requireMobileSession } from "@/lib/mobile/api";
import { isCountryCode, normaliseDigits, parsePhone } from "@/lib/phone";
import { assertWorkshopAbility, PermissionError } from "@/lib/permissions";
import { ITEM_STATUSES, OrderWriteError, updateOrderItem, type ItemStatus } from "@/lib/repos/orders";
import { createOrder, type CreateOrderItemInput, type InitialPaymentMethod } from "@/lib/repos/orders";
import { isCurrencyCode, money } from "@/lib/money";
import { isActivePlanningMember } from "@/lib/repos/planning";
import { addMeasurementVersion } from "@/lib/repos/clients";
import { optionalDate } from "@/lib/mobile/api";
import { sql, sqlOne, withPgTransaction, type PgExecutor } from "@/lib/supabase/postgres";

export const dynamic = "force-dynamic";

type ClientPayload = {
  displayName?: unknown;
  phone?: unknown;
  otherContact?: unknown;
  guardianName?: unknown;
  guardianPhone?: unknown;
  notes?: unknown;
  archived?: unknown;
  choice?: unknown;
  status?: unknown;
  dueDate?: unknown;
  reason?: unknown;
  assigneeId?: unknown;
  orderId?: unknown;
  promisedDate?: unknown;
  fittingDate?: unknown;
  instructions?: unknown;
  clientId?: unknown;
  category?: unknown;
  values?: unknown;
  takenAt?: unknown;
  items?: unknown;
  itemIds?: unknown;
  orderTotalAmount?: unknown;
  initialPayment?: unknown;
};
type SyncOperation = {
  operationId: string;
  deviceId: string;
  clientCreatedAt: string;
  entityKind: "client" | "measurement" | "order" | "order_item";
  entityId: string;
  dependsOn?: string | null;
  resolutionOf?: string | null;
  action: "create" | "update" | "delete" | "archive" | "cancel" | "resolve";
  baseVersion: number | null;
  payload: ClientPayload;
};
type Receipt = {
  operationId: string;
  entityId: string;
  status: "applied" | "conflict" | "rejected" | "blocked";
  rowVersion?: number;
  server?: Record<string, unknown>;
  message?: string;
};
type ClientRow = {
  id: string; row_version: number; display_name: string; phone_e164: string | null;
  other_contact: string | null; guardian_name: string | null; guardian_phone: string | null;
  notes: string | null; archived_at: string | null; deleted_at: string | null;
};
type ItemRow = { id: string; order_id: string; row_version: number; status: ItemStatus; due_date: string | null; assignee_user_id: string | null };
type OrderDbRow = { id: string; row_version: number; promised_date: string | null; fitting_date: string | null; instructions: string | null; cancelled_at: string | null };
type MeasurementDbRow = { id: string; client_id: string; category: string; version: number; values_json: string; unit: string; notes: string | null; taken_at: string; created_at: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clientFields = "*";

export async function POST(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request);
    const body = await parseJsonBody<{ operations?: SyncOperation[] }>(request);
    if (!Array.isArray(body.operations) || body.operations.length < 1 || body.operations.length > 25) {
      throw new MobileApiError(400, "validation_error", "Envoyez entre 1 et 25 operations.");
    }
    for (const operation of body.operations) {
      validateEnvelope(operation);
      try { assertWorkshopAbility(session.actor, operation.entityKind === "client" ? "clients.write" : operation.entityKind === "measurement" ? "measurements.write" : "orders.write"); }
      catch (error) { if (error instanceof PermissionError) throw new MobileApiError(403, "forbidden", "Action non autorisee."); throw error; }
    }

    const receipts: Receipt[] = [];
    for (const operation of body.operations) {
      receipts.push(await processOperation(operation, session.workshop.id, session.user.id, session.workshop.countryCode,
        session.workshop.currency, session.workshop.canViewMoney));
    }
    return ok({ receipts });
  });
}

function validateEnvelope(operation: SyncOperation) {
  if (!operation || !uuidPattern.test(operation.operationId) || !uuidPattern.test(operation.deviceId) ||
    !uuidPattern.test(operation.entityId) || (operation.dependsOn != null && !uuidPattern.test(operation.dependsOn)) ||
    (operation.resolutionOf != null && !uuidPattern.test(operation.resolutionOf)) || !["client", "measurement", "order", "order_item"].includes(operation.entityKind) ||
    !["create", "update", "delete", "archive", "cancel", "resolve"].includes(operation.action) ||
    !Number.isFinite(Date.parse(operation.clientCreatedAt)) ||
    (operation.baseVersion !== null && (!Number.isSafeInteger(operation.baseVersion) || operation.baseVersion < 1)) ||
    !operation.payload || typeof operation.payload !== "object" || Array.isArray(operation.payload) ||
    (operation.action === "create" ? operation.baseVersion !== null : operation.action !== "resolve" && operation.baseVersion === null) ||
    (operation.action === "resolve" && (!operation.resolutionOf || operation.baseVersion !== null)) ||
    (operation.action === "create" && operation.resolutionOf) ||
    (operation.entityKind === "client" && operation.action === "create" && operation.dependsOn) ||
    (operation.entityKind === "measurement" && operation.action !== "create") ||
    (operation.entityKind === "order_item" && operation.action !== "update") ||
    (operation.entityKind === "order" && !["create", "update", "cancel", "resolve"].includes(operation.action)) ||
    (operation.entityKind === "client" && operation.action === "cancel")) {
    throw new MobileApiError(400, "validation_error", "Operation de synchronisation invalide.");
  }
  if (JSON.stringify(operation.payload).length > (operation.entityKind === "order" && operation.action === "create" ? 64_000 : 8_000)) {
    throw new MobileApiError(400, "validation_error", "Operation trop volumineuse.");
  }
}

async function processOperation(operation: SyncOperation, workshopId: string, actorUserId: string, countryCode: string, currency: string, canViewMoney: boolean): Promise<Receipt> {
  return withPgTransaction(async (client) => {
    const inserted = await sql<{ operation_id: string }>(`insert into public.mobile_sync_operations
      (operation_id,workshop_id,actor_user_id,device_id,client_created_at,entity_kind,entity_id,depends_on,resolution_of,action,base_version,payload,status)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,'rejected')
      on conflict (operation_id) do nothing returning operation_id`, [
      operation.operationId, workshopId, actorUserId, operation.deviceId, operation.clientCreatedAt,
      operation.entityKind, operation.entityId, operation.dependsOn ?? null, operation.resolutionOf ?? null,
      operation.action, operation.baseVersion, JSON.stringify(operation.payload),
    ], client);
    if (!inserted.length) {
      const existing = await sqlOne<{ workshop_id: string; actor_user_id: string; device_id: string; entity_kind: string; entity_id: string; depends_on: string | null; resolution_of: string | null; action: string; base_version: number | null; same_payload: boolean; result: Receipt }>(
        "select workshop_id,actor_user_id,device_id,entity_kind,entity_id,depends_on,resolution_of,action,base_version,payload=$2::jsonb as same_payload,result from public.mobile_sync_operations where operation_id=$1 for update",
        [operation.operationId, JSON.stringify(operation.payload)], client,
      );
      if (!existing || existing.workshop_id !== workshopId || existing.actor_user_id !== actorUserId ||
        existing.device_id !== operation.deviceId || existing.entity_kind !== operation.entityKind || existing.entity_id !== operation.entityId ||
        existing.action !== operation.action || existing.depends_on !== (operation.dependsOn ?? null) ||
        existing.resolution_of !== (operation.resolutionOf ?? null) ||
        existing.base_version !== operation.baseVersion || !existing.same_payload) {
        throw new MobileApiError(409, "operation_reused", "Identifiant d'operation deja utilise.");
      }
      return existing.result;
    }

    const dependency = operation.dependsOn ? await sqlOne<{ workshop_id: string; actor_user_id: string; entity_kind: string; entity_id: string; status: string }>(
      "select workshop_id,actor_user_id,entity_kind,entity_id,status from public.mobile_sync_operations where operation_id=$1",
      [operation.dependsOn], client) : null;
    const resolution = operation.resolutionOf ? await sqlOne<{ workshop_id: string; actor_user_id: string; entity_kind: string; entity_id: string; status: string }>(
      "select workshop_id,actor_user_id,entity_kind,entity_id,status from public.mobile_sync_operations where operation_id=$1",
      [operation.resolutionOf], client) : null;
    const before = operation.entityKind === "client"
      ? await sqlOne<ClientRow>(`select ${clientFields} from public.clients where workshop_id=$1 and id=$2 for update`, [workshopId, operation.entityId], client)
      : operation.entityKind === "measurement" ? await sqlOne<MeasurementDbRow>(
        "select id,client_id,category,version,values_json::text,unit,notes,taken_at,created_at from public.measurement_records where workshop_id=$1 and id=$2 for update",
        [workshopId, operation.entityId], client)
      : operation.entityKind === "order" ? await sqlOne<OrderDbRow>(
        "select id,row_version,promised_date::text,fitting_date::text,instructions,cancelled_at from public.orders where workshop_id=$1 and id=$2 for update",
        [workshopId, operation.entityId], client)
      : await sqlOne<ItemRow>(`select id,order_id,row_version,case status
          when 'todo' then 'a_realiser' when 'in_progress' then 'en_cours' when 'fitting' then 'a_essayer'
          when 'ready' then 'pret' when 'delivered' then 'remis' else 'annule' end status,
          due_date::text,assignee_user_id from public.order_items where workshop_id=$1 and id=$2 for update`,
        [workshopId, operation.entityId], client);
    let receipt: Receipt;
    const dependencyMatches = dependency && dependency.workshop_id === workshopId && dependency.actor_user_id === actorUserId &&
      ((dependency.entity_kind === operation.entityKind && dependency.entity_id === operation.entityId) ||
        ((operation.entityKind === "measurement" || operation.entityKind === "order") && operation.action === "create" &&
          dependency.entity_kind === "client" && dependency.entity_id === operation.payload.clientId));
    if (operation.resolutionOf && (!resolution || resolution.workshop_id !== workshopId || resolution.actor_user_id !== actorUserId || resolution.entity_kind !== operation.entityKind || resolution.entity_id !== operation.entityId || resolution.status !== "conflict")) {
      receipt = { operationId: operation.operationId, entityId: operation.entityId, status: "rejected", message: "Conflit a resoudre introuvable." };
    } else if (operation.dependsOn && (!dependencyMatches || dependency.status !== "applied")) {
      receipt = { operationId: operation.operationId, entityId: operation.entityId, status: "blocked", message: "Une modification precedente doit etre resolue." };
    } else if (operation.action === "create" && before) {
      receipt = conflict(operation, before, "Cette fiche existe deja.");
    } else if (operation.action !== "create" && operation.action !== "resolve" && (!before || (operation.entityKind === "client" && (before as ClientRow).deleted_at) ||
      (operation.entityKind === "order" && (before as OrderDbRow).cancelled_at))) {
      receipt = conflict(operation, before, "Cette fiche n'est plus modifiable.");
    } else if (operation.action !== "create" && operation.action !== "resolve" && (before as ClientRow | OrderDbRow | ItemRow | null)?.row_version !== operation.baseVersion) {
      receipt = conflict(operation, before, "Cette fiche a ete modifiee sur un autre appareil.");
    } else if (operation.action === "resolve") {
      if (operation.payload.choice !== "server") {
        receipt = { operationId: operation.operationId, entityId: operation.entityId, status: "rejected", message: "Resolution invalide." };
      } else {
        await recordAudit({ workshopId, actorUserId, action: operation.entityKind === "order" ? "order.resolve" : "client.resolve", entityKind: operation.entityKind, entityId: operation.entityId,
          reason: "server_version", after: { resolutionOf: operation.resolutionOf }, mobileOperationId: operation.operationId }, client);
        receipt = { operationId: operation.operationId, entityId: operation.entityId, status: "applied", rowVersion: (before as ClientRow | OrderDbRow | ItemRow | null)?.row_version, server: before ?? undefined };
      }
    } else if (operation.entityKind === "measurement") {
      try { receipt = await applyMeasurementOperation(operation, workshopId, actorUserId, client); }
      catch (error) {
        if (!(error instanceof MobileApiError) || error.status !== 400) throw error;
        receipt = { operationId: operation.operationId, entityId: operation.entityId, status: "rejected", message: error.message };
      }
    } else if (operation.entityKind === "order") {
      try { receipt = operation.action === "create"
        ? await applyOrderCreateOperation(operation, workshopId, actorUserId, currency, canViewMoney, client)
        : await applyOrderOperation(operation, workshopId, actorUserId, before as OrderDbRow, client); }
      catch (error) {
        if (!(error instanceof MobileApiError) || error.status !== 400) throw error;
        receipt = { operationId: operation.operationId, entityId: operation.entityId, status: "rejected", message: error.message };
      }
    } else if (operation.entityKind === "order_item") {
      try { receipt = await applyItemOperation(operation, workshopId, actorUserId, before as ItemRow, client); }
      catch (error) {
        if (!(error instanceof MobileApiError) || error.status !== 400) throw error;
        receipt = { operationId: operation.operationId, entityId: operation.entityId, status: "rejected", message: error.message };
      }
    } else {
      try {
        receipt = await applyClientOperation(operation, workshopId, actorUserId, countryCode, before as ClientRow | null, client);
      } catch (error) {
        if (!(error instanceof MobileApiError) || error.status !== 400) throw error;
        receipt = { operationId: operation.operationId, entityId: operation.entityId, status: "rejected", message: error.message };
      }
    }
    await sql(`update public.mobile_sync_operations set status=$2,result=$3::jsonb,server_before=$4::jsonb,
      applied_at=case when $2='applied' then now() else null end where operation_id=$1`, [
      operation.operationId, receipt.status, JSON.stringify(receipt), before ? JSON.stringify(before) : null,
    ], client);
    return receipt;
  });
}

function conflict(operation: SyncOperation, before: ClientRow | MeasurementDbRow | OrderDbRow | ItemRow | null, message: string): Receipt {
  return { operationId: operation.operationId, entityId: operation.entityId, status: "conflict", server: before ?? undefined, message };
}

async function applyOrderCreateOperation(operation: SyncOperation, workshopId: string, actorUserId: string, currency: string, canViewMoney: boolean, client: PgExecutor): Promise<Receipt> {
  if (!isCurrencyCode(currency)) throw new MobileApiError(400, "validation_error", "Devise invalide.");
  const clientId = textField(operation.payload.clientId, "Client", 80, true)!;
  if (!uuidPattern.test(clientId)) throw new MobileApiError(400, "validation_error", "Client invalide.");
  const rawItems = operation.payload.items;
  if (!Array.isArray(rawItems) || !rawItems.length || rawItems.length > 50) {
    throw new MobileApiError(400, "validation_error", "Ajoutez entre 1 et 50 articles.");
  }
  const itemIds = operation.payload.itemIds;
  if (!Array.isArray(itemIds) || itemIds.length !== rawItems.length ||
    itemIds.some((id) => typeof id !== "string" || !uuidPattern.test(id)) || new Set(itemIds).size !== itemIds.length) {
    throw new MobileApiError(400, "validation_error", "Identifiants d'articles invalides.");
  }
  const items: CreateOrderItemInput[] = rawItems.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new MobileApiError(400, "validation_error", "Article invalide.");
    const item = raw as Record<string, unknown>;
    const workType = item.workType;
    if (workType !== "creation" && workType !== "retouche") throw new MobileApiError(400, "validation_error", "Type de travail invalide.");
    const quantity = Number(item.quantity ?? 1);
    const unitPrice = Number(item.unitPriceAmount ?? 0);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || !Number.isSafeInteger(unitPrice) || unitPrice < 0) {
      throw new MobileApiError(400, "validation_error", `Montant ou quantite invalide ligne ${index + 1}.`);
    }
    const rawMeasurements = item.measurementValues;
    const measurementValues = rawMeasurements && typeof rawMeasurements === "object" && !Array.isArray(rawMeasurements)
      ? rawMeasurements as Record<string, string> : {};
    if (Object.entries(measurementValues).some(([key, value]) => !key.trim() || typeof value !== "string")) {
      throw new MobileApiError(400, "validation_error", "Mensurations article invalides.");
    }
    return { category: textField(item.category, "Article", 80, true)!, description: textField(item.description, "Description", 500, true)!,
      workType, wearerName: textField(item.wearerName, "Porteur", 120), quantity,
      unitPrice: money(canViewMoney ? unitPrice : 0, currency), dueDate: optionalDate(item.dueDate, "Echeance"),
      measurementValues, measurementNotes: textField(item.measurementNotes, "Notes de mensuration", 1000) };
  });
  const promisedDate = optionalDate(operation.payload.promisedDate, "Date promise");
  const fittingDate = optionalDate(operation.payload.fittingDate, "Date d'essayage");
  const total = Number(operation.payload.orderTotalAmount ?? 0);
  if (!Number.isSafeInteger(total) || total < 0) throw new MobileApiError(400, "validation_error", "Total invalide.");
  if (canViewMoney && items.reduce((sum, item) => sum + item.unitPrice.amount * item.quantity, 0) === 0 && total > 0) {
    items[0] = { ...items[0], unitPrice: money(total, currency) };
  }
  let initialPayment: Parameters<typeof createOrder>[0]["initialPayment"] = null;
  if (operation.payload.initialPayment && canViewMoney) {
    const value = operation.payload.initialPayment;
    if (typeof value !== "object" || Array.isArray(value)) throw new MobileApiError(400, "validation_error", "Acompte invalide.");
    const payment = value as Record<string, unknown>;
    const amount = Number(payment.amount);
    const method = payment.method;
    if (!Number.isSafeInteger(amount) || amount <= 0 || !["cash", "mobile_money", "transfer", "other"].includes(String(method))) {
      throw new MobileApiError(400, "validation_error", "Acompte invalide.");
    }
    const effectiveDate = optionalDate(payment.effectiveDate, "Date d'acompte");
    if (!effectiveDate) throw new MobileApiError(400, "validation_error", "Date d'acompte obligatoire.");
    initialPayment = { amount: money(amount, currency), method: method as InitialPaymentMethod,
      reference: textField(payment.reference, "Reference", 120), effectiveDate,
      idempotencyKey: textField(payment.idempotencyKey, "Cle d'idempotence", 128, true)! };
  }
  try {
    const result = await createOrder({ workshopId, actorUserId, clientId, currency, discount: money(0, currency),
      instructions: textField(operation.payload.instructions, "Consignes", 2000), promisedDate, fittingDate, items,
      initialPayment, orderId: operation.entityId, itemIds, mobileOperationId: operation.operationId }, client);
    return { operationId: operation.operationId, entityId: operation.entityId, status: "applied", rowVersion: 1,
      server: { id: result.orderId, reference: result.reference, row_version: 1,
        promised_date: promisedDate, fitting_date: fittingDate,
        instructions: textField(operation.payload.instructions, "Consignes", 2000), cancelled_at: null } };
  } catch (error) {
    if (error instanceof OrderWriteError) throw new MobileApiError(400, "order_write_error", error.message);
    throw error;
  }
}

async function applyMeasurementOperation(operation: SyncOperation, workshopId: string, actorUserId: string, client: PgExecutor): Promise<Receipt> {
  const clientId = textField(operation.payload.clientId, "Client", 80, true)!;
  if (!uuidPattern.test(clientId)) throw new MobileApiError(400, "validation_error", "Client invalide.");
  const category = textField(operation.payload.category, "Categorie", 80, true)!;
  const rawValues = operation.payload.values;
  if (!rawValues || typeof rawValues !== "object" || Array.isArray(rawValues)) {
    throw new MobileApiError(400, "validation_error", "Mensurations invalides.");
  }
  const values = rawValues as Record<string, unknown>;
  const fields = Object.entries(values);
  if (!fields.length || fields.length > 100 || fields.some(([name, value]) =>
    !name.trim() || name.length > 80 || (value !== null && (typeof value !== "number" || !Number.isFinite(value) || value < 0)))) {
    throw new MobileApiError(400, "validation_error", "Valeurs de mensuration invalides.");
  }
  const parent = await sqlOne<{ id: string }>("select id from public.clients where workshop_id=$1 and id=$2 and deleted_at is null", [workshopId, clientId], client);
  if (!parent) return { operationId: operation.operationId, entityId: operation.entityId, status: "rejected", message: "Client introuvable." };
  await addMeasurementVersion({ workshopId, actorUserId, clientId, category, values: values as Record<string, number | null>,
    notes: textField(operation.payload.notes, "Notes", 1000), takenAt: optionalDate(operation.payload.takenAt, "Date de prise") ?? undefined,
    id: operation.entityId, mobileOperationId: operation.operationId }, client);
  const after = await sqlOne<MeasurementDbRow>(
    "select id,client_id,category,version,values_json::text,unit,notes,taken_at,created_at from public.measurement_records where workshop_id=$1 and id=$2",
    [workshopId, operation.entityId], client);
  return { operationId: operation.operationId, entityId: operation.entityId, status: "applied", rowVersion: after!.version, server: after! };
}

async function applyOrderOperation(operation: SyncOperation, workshopId: string, actorUserId: string, before: OrderDbRow, client: PgExecutor): Promise<Receipt> {
  if (operation.action === "cancel") {
    const reason = textField(operation.payload.reason, "Motif", 500, true)!;
    if (reason.length < 3) throw new MobileApiError(400, "validation_error", "Motif trop court.");
    const timestamp = new Date().toISOString();
    await sql("update public.orders set cancelled_at=$3,row_version=row_version+1 where workshop_id=$1 and id=$2",
      [workshopId, operation.entityId, timestamp], client);
    await sql("update public.order_items set status='cancelled',cancelled_at=coalesce(cancelled_at,$3),row_version=row_version+1 where workshop_id=$1 and order_id=$2 and status not in('delivered','cancelled')",
      [workshopId, operation.entityId, timestamp], client);
    await recordAudit({ workshopId, actorUserId, action: "order.cancel", entityKind: "order", entityId: operation.entityId,
      reason, before: { cancelledAt: before.cancelled_at }, after: { cancelledAt: timestamp }, mobileOperationId: operation.operationId }, client);
  } else {
    const promisedDate = optionalDate(operation.payload.promisedDate, "Date promise");
    const fittingDate = optionalDate(operation.payload.fittingDate, "Date d'essayage");
    const instructions = textField(operation.payload.instructions, "Consignes", 2000);
    await sql("update public.orders set promised_date=$3,fitting_date=$4,instructions=$5,row_version=row_version+1 where workshop_id=$1 and id=$2",
      [workshopId, operation.entityId, promisedDate, fittingDate, instructions], client);
    await recordAudit({ workshopId, actorUserId, action: "order.update", entityKind: "order", entityId: operation.entityId,
      before: { promisedDate: before.promised_date, fittingDate: before.fitting_date, instructions: before.instructions },
      after: { promisedDate, fittingDate, instructions }, mobileOperationId: operation.operationId }, client);
  }
  const after = await sqlOne<OrderDbRow>(
    "select id,row_version,promised_date::text,fitting_date::text,instructions,cancelled_at from public.orders where workshop_id=$1 and id=$2",
    [workshopId, operation.entityId], client);
  return { operationId: operation.operationId, entityId: operation.entityId, status: "applied", rowVersion: after!.row_version, server: after! };
}

async function applyItemOperation(operation: SyncOperation, workshopId: string, actorUserId: string, before: ItemRow, client: PgExecutor): Promise<Receipt> {
  const status = operation.payload.status;
  if (!ITEM_STATUSES.includes(status as ItemStatus)) throw new MobileApiError(400, "validation_error", "Etat invalide.");
  const dueDate = optionalDate(operation.payload.dueDate, "Date d'echeance");
  const reason = textField(operation.payload.reason, "Motif", 500) ?? "";
  const assigneeId = operation.payload.assigneeId === undefined ? undefined : textField(operation.payload.assigneeId, "Collaborateur", 80);
  if (assigneeId && !(await isActivePlanningMember(workshopId, assigneeId))) {
    throw new MobileApiError(400, "validation_error", "Ce collaborateur n'est plus actif.");
  }
  let result: "updated" | "not_found" | "conflict";
  try {
    result = await updateOrderItem({ workshopId, orderId: before.order_id, itemId: operation.entityId,
      actorUserId, status: status as ItemStatus, dueDate, reason, expectedVersion: operation.baseVersion!, assigneeId }, client);
  } catch (error) {
    if (error instanceof OrderWriteError) throw new MobileApiError(400, "order_write_error", error.message);
    throw error;
  }
  if (result === "conflict") return conflict(operation, before, "Cet article a ete modifie sur un autre appareil.");
  if (result === "not_found") return { operationId: operation.operationId, entityId: operation.entityId, status: "rejected", message: "Article indisponible." };
  if (operation.resolutionOf) await recordAudit({ workshopId, actorUserId, action: "item.resolve", entityKind: "order_item",
    entityId: operation.entityId, reason: operation.payload.choice === "server" ? "server_version" : "local_version",
    after: { resolutionOf: operation.resolutionOf }, mobileOperationId: operation.operationId }, client);
  const after = await sqlOne<ItemRow>(`select id,order_id,row_version,case status
    when 'todo' then 'a_realiser' when 'in_progress' then 'en_cours' when 'fitting' then 'a_essayer'
    when 'ready' then 'pret' when 'delivered' then 'remis' else 'annule' end status,
    due_date::text,assignee_user_id from public.order_items where workshop_id=$1 and id=$2`, [workshopId, operation.entityId], client);
  return { operationId: operation.operationId, entityId: operation.entityId, status: "applied", rowVersion: after!.row_version, server: after! };
}

function textField(value: unknown, label: string, max: number, required = false): string | null {
  if (value != null && typeof value !== "string") throw new MobileApiError(400, "validation_error", `${label} invalide.`);
  const result = (value ?? "").toString().trim();
  if (required && !result) throw new MobileApiError(400, "validation_error", `${label} obligatoire.`);
  if (result.length > max) throw new MobileApiError(400, "validation_error", `${label} trop long.`);
  return result || null;
}

async function applyClientOperation(operation: SyncOperation, workshopId: string, actorUserId: string, countryCode: string, before: ClientRow | null, client: PgExecutor): Promise<Receipt> {
  const { payload } = operation;
  let after: ClientRow | null = null;
  if (operation.action === "create" || operation.action === "update") {
    const displayName = textField(payload.displayName, "Nom", 120, true)!;
    const rawPhone = textField(payload.phone, "Telephone", 40);
    let phone: string | null = null;
    if (rawPhone) {
      if (!isCountryCode(countryCode)) throw new MobileApiError(400, "validation_error", "Pays atelier invalide.");
      const parsed = parsePhone(rawPhone, countryCode);
      if (!parsed.ok) throw new MobileApiError(400, "validation_error", parsed.error);
      phone = parsed.e164;
    }
    const fields = [displayName, phone, phone ? normaliseDigits(phone) : null,
      textField(payload.otherContact, "Autre contact", 160), textField(payload.guardianName, "Responsable", 120),
      textField(payload.guardianPhone, "Telephone responsable", 40), textField(payload.notes, "Notes", 1000)];
    if (operation.action === "create") {
      after = await sqlOne<ClientRow>(`insert into public.clients
        (id,workshop_id,display_name,phone_e164,phone_search,other_contact,guardian_name,guardian_phone,notes,created_by)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning ${clientFields}`,
      [operation.entityId, workshopId, ...fields, actorUserId], client);
    } else {
      after = await sqlOne<ClientRow>(`update public.clients set display_name=$3,phone_e164=$4,phone_search=$5,
        other_contact=$6,guardian_name=$7,guardian_phone=$8,notes=$9,row_version=row_version+1
        where workshop_id=$1 and id=$2 returning ${clientFields}`,
      [workshopId, operation.entityId, ...fields], client);
    }
  } else if (operation.action === "archive") {
    if (typeof payload.archived !== "boolean") throw new MobileApiError(400, "validation_error", "Archivage invalide.");
    after = await sqlOne<ClientRow>(`update public.clients set archived_at=case when $3 then now() else null end,
      row_version=row_version+1 where workshop_id=$1 and id=$2 returning ${clientFields}`,
    [workshopId, operation.entityId, payload.archived], client);
  } else {
    after = await sqlOne<ClientRow>(`update public.clients set deleted_at=now(),row_version=row_version+1
      where workshop_id=$1 and id=$2 returning ${clientFields}`, [workshopId, operation.entityId], client);
  }
  if (!after) throw new Error("Client non retrouve pendant la synchronisation.");
  await recordAudit({ workshopId, actorUserId, action: `client.${operation.action}` as "client.create" | "client.update" | "client.archive" | "client.delete",
    entityKind: "client", entityId: operation.entityId, before, after, mobileOperationId: operation.operationId }, client);
  return { operationId: operation.operationId, entityId: operation.entityId, status: "applied", rowVersion: after.row_version, server: after };
}
