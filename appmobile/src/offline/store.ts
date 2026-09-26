import { randomUUID } from 'expo-crypto';
import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

import { getAuthSession } from '../auth/session';
import type { Client, ClientInput, ClientListItem, ClientPage, ClientSort, Measurement, MeasurementInput, SortDirection } from '../types/clients';
import type { CreateOrderRequest, ItemStatus, OrderDetail, OrderFilter, OrderPage, OrderSummary } from '../types/orders';
import type { PlanningResponse, PlanningStatusFilter, PlanningAssigneeFilter } from '../types/planning';
import type { AttachmentDraft } from '../components/AttachmentPicker';

export type SyncStatus = 'pending' | 'applied' | 'conflict' | 'rejected' | 'blocked' | 'superseded';
export type ClientOperation = {
  operationId: string;
  deviceId: string;
  clientCreatedAt: string;
  entityKind: 'client';
  entityId: string;
  dependsOn?: string | null;
  resolutionOf?: string | null;
  action: 'create' | 'update' | 'delete' | 'archive' | 'resolve';
  baseVersion: number | null;
  payload: ClientInput | { archived: boolean } | { choice: 'server' } | Record<string, never>;
};
export type ItemSnapshot = { id: string; order_id: string; row_version: number; status: ItemStatus; due_date: string | null; assignee_user_id: string | null };
export type ItemOperation = {
  operationId: string; deviceId: string; clientCreatedAt: string; entityKind: 'order_item'; entityId: string;
  dependsOn?: string | null; resolutionOf?: string | null; action: 'update'; baseVersion: number;
  payload: { orderId: string; status: ItemStatus; dueDate: string | null; reason: string; assigneeId?: string | null; choice?: 'server' | 'local' };
};
export type OrderSnapshot = { id: string; row_version: number; reference?: string; promised_date: string | null; fitting_date: string | null; instructions: string | null; cancelled_at: string | null };
export type OrderOperation = { operationId: string; deviceId: string; clientCreatedAt: string; entityKind: 'order'; entityId: string;
  dependsOn?: string | null; resolutionOf?: string | null; action: 'update' | 'cancel' | 'resolve'; baseVersion: number | null;
  payload: { promisedDate?: string | null; fittingDate?: string | null; instructions?: string | null; reason?: string; choice?: 'server' | 'local' } };
export type OrderCreateOperation = { operationId: string; deviceId: string; clientCreatedAt: string; entityKind: 'order'; entityId: string;
  dependsOn?: string | null; action: 'create'; baseVersion: null;
  payload: CreateOrderRequest & { clientId: string; itemIds: string[] } };
export type MeasurementOperation = { operationId: string; deviceId: string; clientCreatedAt: string; entityKind: 'measurement'; entityId: string;
  dependsOn?: string | null; action: 'create'; baseVersion: null;
  payload: { clientId: string; category: string; values: Record<string, number | null>; notes: string | null; takenAt: string | null } };
export type OfflineOperation = ClientOperation | MeasurementOperation | OrderOperation | OrderCreateOperation | ItemOperation;
export type SyncReceipt = {
  operationId: string;
  entityId: string;
  status: 'applied' | 'conflict' | 'rejected' | 'blocked';
  rowVersion?: number;
  server?: Client | Measurement | OrderSnapshot | ItemSnapshot;
  message?: string;
};
export type OutboxEntry = { seq: number; status: SyncStatus; operation: OfflineOperation; receipt: SyncReceipt | null };
export type PaymentDraft = { orderId: string; amount: number; currency?: string; method: string; reference?: string | null; effectiveDate: string };
export type PaymentEntry = { seq: number; idempotencyKey: string; status: 'pending' | 'applied' | 'rejected'; payload: PaymentDraft; message: string | null; movementId: string | null; createdAt: string };
export type AttachmentEntry = { id: string; path: string; uri: string; name: string; mimeType: string; status: 'pending' | 'applied' | 'rejected'; message: string | null; createdAt: string };

type ClientCacheRow = { json: string };
type OutboxRow = { seq: number; status: SyncStatus; operation_json: string; receipt_json: string | null };

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function database() {
  if (!databasePromise) databasePromise = (async () => {
    const db = await SQLite.openDatabaseAsync('fileo-offline.db');
    await db.execAsync(`pragma journal_mode = WAL;
      create table if not exists local_meta (key text primary key, value text not null);
      create table if not exists client_cache (
        scope text not null, id text not null, json text not null,
        primary key(scope,id)
      );
      create table if not exists response_cache (
        scope text not null, key text not null, json text not null, saved_at text not null,
        primary key(scope,key)
      );
      create table if not exists order_cache (
        scope text not null, id text not null, json text not null,
        primary key(scope,id)
      );
      create table if not exists outbox (
        seq integer primary key autoincrement, scope text not null, entity_id text not null,
        operation_id text not null unique, operation_json text not null,
        status text not null, receipt_json text, created_at text not null
      );
      create index if not exists outbox_scope_seq on outbox(scope,seq);
      create index if not exists outbox_scope_entity on outbox(scope,entity_id,seq);`);
    await db.execAsync(`create table if not exists financial_outbox (
      seq integer primary key autoincrement, scope text not null, idempotency_key text not null unique,
      payload_json text not null, status text not null, message text, movement_id text, created_at text not null
    );
    create index if not exists financial_outbox_scope_seq on financial_outbox(scope,seq);`);
    await db.execAsync(`create table if not exists attachment_outbox (
      seq integer primary key autoincrement, scope text not null, attachment_id text not null unique,
      path text not null, uri text not null, name text not null, mime_type text not null,
      status text not null, message text, created_at text not null
    );
    create index if not exists attachment_outbox_scope_seq on attachment_outbox(scope,seq);`);
    return db;
  })().catch((error) => { databasePromise = null; throw error; });
  return databasePromise;
}

async function scope() {
  const session = await getAuthSession();
  if (!session?.userId || !session.workshopId) throw new Error('Reconnectez-vous pour activer le mode hors ligne.');
  return `${session.userId}:${session.workshopId}`;
}

async function deviceId(db: SQLite.SQLiteDatabase): Promise<string> {
  const saved = await db.getFirstAsync<{ value: string }>('select value from local_meta where key=?', 'device_id');
  if (saved) return saved.value;
  const id = randomUUID();
  await db.runAsync('insert or ignore into local_meta(key,value) values(?,?)', 'device_id', id);
  return (await db.getFirstAsync<{ value: string }>('select value from local_meta where key=?', 'device_id'))!.value;
}

export async function saveResponse(key: string, value: unknown) {
  const db = await database();
  await db.runAsync(`insert into response_cache(scope,key,json,saved_at) values(?,?,?,?)
    on conflict(scope,key) do update set json=excluded.json,saved_at=excluded.saved_at`,
    await scope(), key, JSON.stringify(value), new Date().toISOString());
}

export async function cachedResponse<T>(key: string): Promise<T | null> {
  const db = await database();
  const row = await db.getFirstAsync<{ json: string }>('select json from response_cache where scope=? and key=?', await scope(), key);
  return row ? JSON.parse(row.json) as T : null;
}

export async function cacheClients(items: Client[]) {
  const db = await database(); const key = await scope();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const item of items) {
      const localEdits = await tx.getFirstAsync<{ seq: number }>(
        "select seq from outbox where scope=? and entity_id=? and status in ('pending','conflict','rejected','blocked') limit 1", key, item.id);
      if (!localEdits) await tx.runAsync('insert into client_cache(scope,id,json) values(?,?,?) on conflict(scope,id) do update set json=excluded.json', key, item.id, JSON.stringify(item));
    }
  });
}

export async function cachedClient(id: string): Promise<Client | null> {
  const db = await database();
  const row = await db.getFirstAsync<ClientCacheRow>('select json from client_cache where scope=? and id=?', await scope(), id);
  return row ? JSON.parse(row.json) as Client : null;
}

export async function hasCachedClients(): Promise<boolean> {
  const db = await database();
  return Boolean(await db.getFirstAsync('select 1 from client_cache where scope=? limit 1', await scope()));
}

export async function cachedClients(params: { page?: number; pageSize?: number; q?: string; includeArchived?: boolean; sort?: ClientSort; direction?: SortDirection }): Promise<ClientPage> {
  const db = await database();
  const rows = await db.getAllAsync<ClientCacheRow>('select json from client_cache where scope=?', await scope());
  const term = params.q?.trim().toLocaleLowerCase() ?? '';
  const digits = term.replace(/\D/g, '');
  const filtered = rows.map((row) => JSON.parse(row.json) as ClientListItem).filter((item) =>
    !item.deleted_at && (params.includeArchived || !item.archived_at) && (!term ||
      item.display_name.toLocaleLowerCase().includes(term) ||
      item.other_contact?.toLocaleLowerCase().includes(term) ||
      Boolean(digits && item.phone_e164?.replace(/\D/g, '').includes(digits))));
  const field = ({ name: 'display_name', phone: 'phone_e164', orders: 'order_count', lastOrder: 'last_order_at', createdAt: 'created_at' } as const)[params.sort ?? 'name'];
  const direction = params.direction === 'desc' ? -1 : 1;
  filtered.sort((a, b) => direction * String(a[field] ?? '').localeCompare(String(b[field] ?? ''), 'fr', { numeric: true }) || a.id.localeCompare(b.id));
  const pageSize = params.pageSize ?? 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(params.page ?? 1, pageCount);
  return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize, pageCount };
}

export async function cacheOrders(items: OrderSummary[]) {
  const db = await database(); const key = await scope();
  await db.withExclusiveTransactionAsync(async (tx) => {
    const unresolved = await tx.getAllAsync<{ entity_id: string }>(
      "select entity_id from outbox where scope=? and status in ('pending','conflict','rejected','blocked')", key);
    const protectedIds = new Set(unresolved.map((row) => row.entity_id));
    for (const item of items) if (!protectedIds.has(item.order.id) && !item.items.some((row) => protectedIds.has(row.id))) {
      await tx.runAsync('insert into order_cache(scope,id,json) values(?,?,?) on conflict(scope,id) do update set json=excluded.json',
        key, item.order.id, JSON.stringify(item));
    }
  });
}

export async function cachedOrders(params: { page?: number; pageSize?: number; q?: string; filter?: OrderFilter }): Promise<OrderPage> {
  const db = await database();
  const rows = await db.getAllAsync<{ json: string }>('select json from order_cache where scope=?', await scope());
  const q = params.q?.trim().toLocaleLowerCase() ?? '';
  const items = rows.map((row) => JSON.parse(row.json) as OrderSummary).filter((item) => {
    if (q && !`${item.order.client_name} ${item.order.reference} ${item.items.map((article) => `${article.category} ${article.description}`).join(' ')}`.toLocaleLowerCase().includes(q)) return false;
    if (params.filter === 'late') return item.isLate;
    return !params.filter || params.filter === 'all' || item.state === params.filter;
  });
  items.sort((a, b) => b.order.created_at.localeCompare(a.order.created_at) || b.order.id.localeCompare(a.order.id));
  const pageSize = params.pageSize ?? 10;
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(params.page ?? 1, pageCount);
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize, pageCount };
}

export async function hasCachedOrders(): Promise<boolean> {
  const db = await database();
  return Boolean(await db.getFirstAsync('select 1 from order_cache where scope=? limit 1', await scope()));
}

export async function cachePlanning(value: PlanningResponse) {
  const db = await database(); const key = await scope();
  const protectedIds = new Set((await db.getAllAsync<{ entity_id: string }>(
    "select entity_id from outbox where scope=? and status in ('pending','conflict','rejected','blocked')", key)).map((row) => row.entity_id));
  const previous = await cachedResponse<PlanningResponse>('planning:all');
  if (previous) {
    const local = new Map(previous.items.filter((item) => protectedIds.has(item.item_id) || protectedIds.has(item.order_id))
      .map((item) => [item.item_id, item]));
    value.items = value.items.map((item) => local.get(item.item_id) ?? item);
    const serverIds = new Set(value.items.map((item) => item.item_id));
    value.items.push(...[...local.values()].filter((item) => !serverIds.has(item.item_id)));
  }
  await saveResponse('planning:all', value);
}

export async function cachedPlanning(params: { q?: string; status?: PlanningStatusFilter; assignee?: PlanningAssigneeFilter }): Promise<PlanningResponse | null> {
  const saved = await cachedResponse<PlanningResponse>('planning:all');
  if (!saved) return null;
  const q = params.q?.trim().toLocaleLowerCase() ?? '';
  return { members: saved.members, truncated: saved.truncated, items: saved.items.filter((item) => {
    if (q && !`${item.client_name} ${item.reference} ${item.category} ${item.description}`.toLocaleLowerCase().includes(q)) return false;
    if (params.status === 'active' && (item.status === 'remis' || item.status === 'annule')) return false;
    if (params.status && !['active', 'all'].includes(params.status) && item.status !== params.status) return false;
    if (params.assignee === 'unassigned' && item.assignee_user_id) return false;
    if (params.assignee && params.assignee !== 'all' && params.assignee !== 'unassigned' && item.assignee_user_id !== params.assignee) return false;
    return true;
  }) };
}

async function projectItem(db: SQLite.SQLiteDatabase, key: string, item: ItemSnapshot, preserveAssignee = false) {
  const detailKey = `/orders/${item.order_id}`;
  const detailRow = await db.getFirstAsync<{ json: string }>('select json from response_cache where scope=? and key=?', key, detailKey);
  if (detailRow) {
    const detail = JSON.parse(detailRow.json) as OrderDetail;
    detail.items = detail.items.map((row) => row.id === item.id ? { ...row, status: item.status, due_date: item.due_date,
      assignee_user_id: preserveAssignee ? row.assignee_user_id : item.assignee_user_id, row_version: item.row_version } : row);
    await db.runAsync('update response_cache set json=? where scope=? and key=?', JSON.stringify(detail), key, detailKey);
  }
  const orderRow = await db.getFirstAsync<{ json: string }>('select json from order_cache where scope=? and id=?', key, item.order_id);
  if (orderRow) {
    const order = JSON.parse(orderRow.json) as OrderSummary;
    order.items = order.items.map((row) => row.id === item.id ? { ...row, status: item.status, due_date: item.due_date,
      assignee_user_id: preserveAssignee ? row.assignee_user_id : item.assignee_user_id, row_version: item.row_version } : row);
    await db.runAsync('update order_cache set json=? where scope=? and id=?', JSON.stringify(order), key, item.order_id);
  }
  const planningRow = await db.getFirstAsync<{ json: string }>('select json from response_cache where scope=? and key=?', key, 'planning:all');
  if (planningRow) {
    const planning = JSON.parse(planningRow.json) as PlanningResponse;
    planning.items = planning.items.map((row) => row.item_id === item.id ? { ...row, status: item.status,
      explicit_due_date: item.due_date, effective_due_date: item.due_date ?? row.promised_date,
      assignee_user_id: preserveAssignee ? row.assignee_user_id : item.assignee_user_id, row_version: item.row_version } : row);
    await db.runAsync('update response_cache set json=? where scope=? and key=?', JSON.stringify(planning), key, 'planning:all');
  }
}

async function projectOrder(db: SQLite.SQLiteDatabase, key: string, order: OrderSnapshot) {
  const detailKey = `/orders/${order.id}`;
  const detailRow = await db.getFirstAsync<{ json: string }>('select json from response_cache where scope=? and key=?', key, detailKey);
  if (detailRow) {
    const detail = JSON.parse(detailRow.json) as OrderDetail;
    detail.order = { ...detail.order, ...order };
    if (order.cancelled_at) {
      detail.state = 'annulee';
      detail.items = detail.items.map((item) => item.status === 'remis' || item.status === 'annule' ? item :
        { ...item, status: 'annule', row_version: item.row_version + 1 });
    }
    await db.runAsync('update response_cache set json=? where scope=? and key=?', JSON.stringify(detail), key, detailKey);
  }
  const summaryRow = await db.getFirstAsync<{ json: string }>('select json from order_cache where scope=? and id=?', key, order.id);
  if (summaryRow) {
    const summary = JSON.parse(summaryRow.json) as OrderSummary;
    summary.order = { ...summary.order, ...order };
    if (order.cancelled_at) {
      summary.state = 'annulee';
      summary.items = summary.items.map((item) => item.status === 'remis' || item.status === 'annule' ? item :
        { ...item, status: 'annule', row_version: item.row_version + 1 });
    }
    await db.runAsync('update order_cache set json=? where scope=? and id=?', JSON.stringify(summary), key, order.id);
  }
  if (order.cancelled_at) {
    const planningRow = await db.getFirstAsync<{ json: string }>('select json from response_cache where scope=? and key=?', key, 'planning:all');
    if (planningRow) {
      const planning = JSON.parse(planningRow.json) as PlanningResponse;
      planning.items = planning.items.map((item) => item.order_id === order.id && item.status !== 'remis' && item.status !== 'annule'
        ? { ...item, status: 'annule', row_version: item.row_version + 1, reference: order.reference ?? item.reference,
          promised_date: order.promised_date, fitting_date: order.fitting_date,
          effective_due_date: item.explicit_due_date ?? order.promised_date } : item);
      await db.runAsync('update response_cache set json=? where scope=? and key=?', JSON.stringify(planning), key, 'planning:all');
    }
  } else {
    const planningRow = await db.getFirstAsync<{ json: string }>('select json from response_cache where scope=? and key=?', key, 'planning:all');
    if (planningRow) {
      const planning = JSON.parse(planningRow.json) as PlanningResponse;
      planning.items = planning.items.map((item) => item.order_id === order.id ? { ...item,
        reference: order.reference ?? item.reference,
        promised_date: order.promised_date, fitting_date: order.fitting_date,
        effective_due_date: item.explicit_due_date ?? order.promised_date } : item);
      await db.runAsync('update response_cache set json=? where scope=? and key=?', JSON.stringify(planning), key, 'planning:all');
    }
  }
}

export async function queueOrderCreate(payload: CreateOrderRequest & { clientId: string }) {
  const db = await database(); const key = await scope(); const session = await getAuthSession();
  if (!session?.currency || !payload.items.length) throw new Error('Atelier ou articles indisponibles hors ligne.');
  const client = await cachedClient(payload.clientId);
  const id = randomUUID(); const itemIds = payload.items.map(() => randomUUID()); const now = new Date().toISOString();
  const parent = await db.getFirstAsync<{ operation_id: string }>(
    "select operation_id from outbox where scope=? and entity_id=? and status in ('pending','conflict','blocked','rejected') and json_extract(operation_json,'$.action')='create' order by seq desc limit 1",
    key, payload.clientId);
  const operation: OrderCreateOperation = { operationId: randomUUID(), deviceId: await deviceId(db), clientCreatedAt: now,
    entityKind: 'order', entityId: id, dependsOn: parent?.operation_id ?? null, action: 'create', baseVersion: null,
    payload: { ...payload, itemIds } };
  const summary: OrderSummary = { order: { id, workshop_id: session.workshopId!, client_id: payload.clientId,
    client_name: client?.display_name ?? payload.client?.displayName ?? 'Client', reference: 'Référence à venir',
    currency: session.currency, discount_amount: 0, discount_reason: null, instructions: payload.instructions ?? null,
    promised_date: payload.promisedDate ?? null, fitting_date: payload.fittingDate ?? null, cancelled_at: null,
    created_at: now, row_version: 1 },
    items: payload.items.map((item, index) => ({ id: itemIds[index], order_id: id, category: item.category,
      description: item.description, work_type: item.workType, wearer_name: item.wearerName ?? null,
      wearer_relation: null, quantity: item.quantity, unit_price_amount: item.unitPriceAmount,
      currency: session.currency!, status: 'a_realiser', due_date: item.dueDate ?? payload.promisedDate ?? null,
      delivered_quantity: 0, assignee_user_id: null, measurement_snapshot: item.measurementValues ? JSON.stringify(item.measurementValues) : null,
      row_version: 1 })), state: 'nouvelle', balance: null, isLate: false };
  const detail: OrderDetail = { ...summary, movements: [], attachments: [] };
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('insert into outbox(scope,entity_id,operation_id,operation_json,status,created_at) values(?,?,?,?,?,?)',
      key, id, operation.operationId, JSON.stringify(operation), 'pending', now);
    await tx.runAsync(`insert into response_cache(scope,key,json,saved_at) values(?,?,?,?)
      on conflict(scope,key) do update set json=excluded.json,saved_at=excluded.saved_at`,
      key, `/orders/${id}`, JSON.stringify(detail), now);
    await tx.runAsync('insert into order_cache(scope,id,json) values(?,?,?)', key, id, JSON.stringify(summary));
    const planningRow = await tx.getFirstAsync<{ json: string }>('select json from response_cache where scope=? and key=?', key, 'planning:all');
    const planning: PlanningResponse = planningRow ? JSON.parse(planningRow.json) as PlanningResponse : { items: [], members: [] };
    planning.items.push(...summary.items.map((item) => ({ item_id: item.id, order_id: id,
      workshop_id: session.workshopId!, reference: summary.order.reference, client_name: summary.order.client_name,
      category: item.category, description: item.description, quantity: item.quantity, status: item.status,
      explicit_due_date: item.due_date, effective_due_date: item.due_date ?? summary.order.promised_date,
      promised_date: summary.order.promised_date, fitting_date: summary.order.fitting_date, delivered_at: null,
      assignee_user_id: null, assignee_name: null, row_version: 1 })));
    await tx.runAsync(`insert into response_cache(scope,key,json,saved_at) values(?,?,?,?)
      on conflict(scope,key) do update set json=excluded.json,saved_at=excluded.saved_at`,
      key, 'planning:all', JSON.stringify(planning), now);
  });
  return { id, operationId: operation.operationId, summary };
}

async function projectMeasurement(db: SQLite.SQLiteDatabase, key: string, clientId: string, measurement: Measurement) {
  const path = `/clients/${clientId}/measurements`;
  const cached = await db.getFirstAsync<{ json: string }>('select json from response_cache where scope=? and key=?', key, path);
  const response = cached ? JSON.parse(cached.json) as { items: Measurement[] } : { items: [] as Measurement[] };
  response.items = [measurement, ...response.items.filter((row) => row.id !== measurement.id)];
  await db.runAsync(`insert into response_cache(scope,key,json,saved_at) values(?,?,?,?)
    on conflict(scope,key) do update set json=excluded.json,saved_at=excluded.saved_at`,
    key, path, JSON.stringify(response), new Date().toISOString());
}

export async function queueMeasurement(clientId: string, payload: MeasurementInput) {
  const db = await database(); const key = await scope(); const id = randomUUID(); const now = new Date().toISOString();
  const clientCreate = await db.getFirstAsync<{ operation_id: string }>(
    "select operation_id from outbox where scope=? and entity_id=? and status in ('pending','conflict','blocked','rejected') and json_extract(operation_json,'$.action')='create' order by seq desc limit 1",
    key, clientId);
  const operation: MeasurementOperation = { operationId: randomUUID(), deviceId: await deviceId(db), clientCreatedAt: now,
    entityKind: 'measurement', entityId: id, dependsOn: clientCreate?.operation_id ?? null, action: 'create', baseVersion: null,
    payload: { clientId, ...payload } };
  const existing = await cachedResponse<{ items: Measurement[] }>(`/clients/${clientId}/measurements`);
  const version = Math.max(0, ...(existing?.items.filter((row) => row.category === payload.category).map((row) => row.version) ?? [])) + 1;
  const projected: Measurement = { id, client_id: clientId, category: payload.category, version,
    values_json: JSON.stringify(payload.values), unit: 'cm', notes: payload.notes, taken_at: payload.takenAt ?? now,
    created_at: now, attachments: [] };
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('insert into outbox(scope,entity_id,operation_id,operation_json,status,created_at) values(?,?,?,?,?,?)',
      key, id, operation.operationId, JSON.stringify(operation), 'pending', now);
    await projectMeasurement(tx, key, clientId, projected);
  });
  return id;
}

export async function queueOrderOperation(orderId: string, action: 'update' | 'cancel', payload: OrderOperation['payload'], rowVersion: number) {
  const db = await database(); const key = await scope(); const now = new Date().toISOString();
  const previous = await db.getFirstAsync<{ operation_id: string }>(
    "select operation_id from outbox where scope=? and entity_id=? and status in ('pending','conflict','rejected','blocked') order by seq desc limit 1", key, orderId);
  const operation: OrderOperation = { operationId: randomUUID(), deviceId: await deviceId(db), clientCreatedAt: now,
    entityKind: 'order', entityId: orderId, dependsOn: previous?.operation_id ?? null, action, baseVersion: rowVersion, payload };
  const detail = await cachedResponse<OrderDetail>(`/orders/${orderId}`);
  if (!detail) throw new Error('Ouvrez la fiche commande avant de la modifier hors ligne.');
  const projected: OrderSnapshot = { id: orderId, row_version: rowVersion + 1,
    promised_date: action === 'update' ? payload.promisedDate ?? null : detail.order.promised_date,
    fitting_date: action === 'update' ? payload.fittingDate ?? null : detail.order.fitting_date,
    instructions: action === 'update' ? payload.instructions ?? null : detail.order.instructions,
    cancelled_at: action === 'cancel' ? now : detail.order.cancelled_at };
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('insert into outbox(scope,entity_id,operation_id,operation_json,status,created_at) values(?,?,?,?,?,?)',
      key, orderId, operation.operationId, JSON.stringify(operation), 'pending', now);
    await projectOrder(tx, key, projected);
  });
  return operation.operationId;
}

export async function queueItemOperation(itemId: string, payload: { orderId: string; status: ItemStatus; dueDate: string | null; reason: string; assigneeId?: string | null; rowVersion: number }) {
  const db = await database(); const key = await scope(); const now = new Date().toISOString();
  const previous = await db.getFirstAsync<{ operation_id: string }>(
    "select operation_id from outbox where scope=? and entity_id=? and status in ('pending','conflict','rejected','blocked') order by seq desc limit 1", key, itemId);
  const operation: ItemOperation = { operationId: randomUUID(), deviceId: await deviceId(db), clientCreatedAt: now,
    entityKind: 'order_item', entityId: itemId, dependsOn: previous?.operation_id ?? null, action: 'update',
    baseVersion: payload.rowVersion, payload: { orderId: payload.orderId, status: payload.status, dueDate: payload.dueDate,
      reason: payload.reason, ...(payload.assigneeId !== undefined ? { assigneeId: payload.assigneeId } : {}) } };
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('insert into outbox(scope,entity_id,operation_id,operation_json,status,created_at) values(?,?,?,?,?,?)',
      key, itemId, operation.operationId, JSON.stringify(operation), 'pending', now);
    await projectItem(tx, key, { id: itemId, order_id: payload.orderId, row_version: payload.rowVersion + 1,
      status: payload.status, due_date: payload.dueDate, assignee_user_id: payload.assigneeId ?? null }, payload.assigneeId === undefined);
  });
  return operation.operationId;
}

let queueTail: Promise<unknown> = Promise.resolve();

export function queueClientOperation(action: Exclude<ClientOperation['action'], 'resolve'>, entityId: string | null, payload: ClientOperation['payload']): Promise<string> {
  const task = queueTail.then(() => queueClientOperationInner(action, entityId, payload));
  queueTail = task.catch(() => undefined);
  return task;
}

async function queueClientOperationInner(action: Exclude<ClientOperation['action'], 'resolve'>, entityId: string | null, payload: ClientOperation['payload']): Promise<string> {
  const db = await database(); const key = await scope(); const id = entityId ?? randomUUID();
  const current = await cachedClient(id);
  if (action !== 'create' && (!current || current.deleted_at)) throw new Error('Ouvrez la fiche client en ligne avant de la modifier hors ligne.');
  const now = new Date().toISOString();
  const previous = await db.getFirstAsync<{ operation_id: string }>(
    "select operation_id from outbox where scope=? and entity_id=? and status in ('pending','conflict','rejected','blocked') order by seq desc limit 1", key, id);
  const operation: ClientOperation = { operationId: randomUUID(), deviceId: await deviceId(db), clientCreatedAt: now,
    entityKind: 'client', entityId: id, dependsOn: previous?.operation_id ?? null,
    action, baseVersion: action === 'create' ? null : current!.row_version, payload };
  const data = payload as ClientInput;
  const projected: Client = action === 'create' ? {
    id, workshop_id: key.split(':')[1], display_name: data.displayName, phone_e164: data.phone,
    phone_search: data.phone?.replace(/\D/g, '') ?? null, other_contact: data.otherContact,
    guardian_name: data.guardianName, guardian_phone: data.guardianPhone, notes: data.notes,
    archived_at: null, deleted_at: null, created_at: now, updated_at: now, row_version: 1,
  } : { ...current!, updated_at: now, row_version: current!.row_version + 1,
    ...(action === 'update' ? { display_name: data.displayName, phone_e164: data.phone,
      phone_search: data.phone?.replace(/\D/g, '') ?? null, other_contact: data.otherContact,
      guardian_name: data.guardianName, guardian_phone: data.guardianPhone, notes: data.notes } : {}),
    ...(action === 'archive' ? { archived_at: (payload as { archived: boolean }).archived ? now : null } : {}),
    ...(action === 'delete' ? { deleted_at: now } : {}),
  };
  await db.withExclusiveTransactionAsync(async (tx) => {
    await tx.runAsync('insert into outbox(scope,entity_id,operation_id,operation_json,status,created_at) values(?,?,?,?,?,?)',
      key, id, operation.operationId, JSON.stringify(operation), 'pending', now);
    await tx.runAsync('insert into client_cache(scope,id,json) values(?,?,?) on conflict(scope,id) do update set json=excluded.json', key, id, JSON.stringify(projected));
  });
  return id;
}

export async function outboxEntries(): Promise<OutboxEntry[]> {
  const db = await database();
  const rows = await db.getAllAsync<OutboxRow>('select seq,status,operation_json,receipt_json from outbox where scope=? order by seq', await scope());
  return rows.map((row) => ({ seq: row.seq, status: row.status, operation: JSON.parse(row.operation_json) as OfflineOperation,
    receipt: row.receipt_json ? JSON.parse(row.receipt_json) as SyncReceipt : null }));
}

export async function nextPendingBatch(): Promise<OfflineOperation[]> {
  const entries = await outboxEntries();
  const pending: OfflineOperation[] = [];
  for (const entry of entries) {
    if (entry.status === 'pending') pending.push(entry.operation);
    if (pending.length === 25) break;
  }
  return pending;
}

export async function applyReceipts(receipts: SyncReceipt[]) {
  const db = await database(); const key = await scope();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const receipt of receipts) {
      const row = await tx.getFirstAsync<{ seq: number; operation_json: string }>('select seq,operation_json from outbox where scope=? and operation_id=?', key, receipt.operationId);
      if (!row) continue;
      await tx.runAsync('update outbox set status=?,receipt_json=? where operation_id=?', receipt.status, JSON.stringify(receipt), receipt.operationId);
      const operation = JSON.parse(row.operation_json) as OfflineOperation;
      if (receipt.server) {
        const later = await tx.getFirstAsync<{ seq: number }>(
          "select seq from outbox where scope=? and entity_id=? and seq>? and status in ('pending','conflict','rejected','blocked') limit 1",
          key, receipt.entityId, row.seq);
        if (!later && receipt.status === 'applied') {
          if (operation.entityKind === 'client') await tx.runAsync('insert into client_cache(scope,id,json) values(?,?,?) on conflict(scope,id) do update set json=excluded.json', key, receipt.entityId, JSON.stringify(receipt.server));
          else if (operation.entityKind === 'measurement') await projectMeasurement(tx, key, operation.payload.clientId,
            { ...receipt.server as Measurement, attachments: [] });
          else if (operation.entityKind === 'order') await projectOrder(tx, key, receipt.server as OrderSnapshot);
          else await projectItem(tx, key, receipt.server as ItemSnapshot);
        }
      }
    }
  });
}

export async function resolveClientConflict(operationId: string, choice: 'server' | 'local') {
  const db = await database(); const key = await scope();
  const entries = await outboxEntries();
  const conflict = entries.find((entry) => entry.operation.operationId === operationId && entry.status === 'conflict');
  if (!conflict || conflict.operation.entityKind !== 'client') throw new Error('Conflit client introuvable.');
  const server = conflict.receipt?.server as Client | undefined;
  if ((!server || server.deleted_at) && choice === 'local') throw new Error('Le client a ete supprime sur le serveur. Sa restauration necessite une nouvelle fiche.');
  const local = await cachedClient(conflict.operation.entityId);
  if (!local && choice === 'local') throw new Error('Version locale introuvable.');
  const now = new Date().toISOString();
  const common = { deviceId: await deviceId(db), clientCreatedAt: now, entityKind: 'client' as const,
    entityId: conflict.operation.entityId, resolutionOf: operationId };
  const operations: ClientOperation[] = choice === 'server'
    ? [{ ...common, operationId: randomUUID(), action: 'resolve', baseVersion: null, payload: { choice: 'server' } }]
    : local!.deleted_at
      ? [{ ...common, operationId: randomUUID(), action: 'delete', baseVersion: server!.row_version, payload: {} }]
      : [{ ...common, operationId: randomUUID(), action: 'update', baseVersion: server!.row_version,
        payload: { displayName: local!.display_name, phone: local!.phone_e164, otherContact: local!.other_contact,
          guardianName: local!.guardian_name, guardianPhone: local!.guardian_phone, notes: local!.notes } }];
  if (choice === 'local' && !local!.deleted_at && Boolean(local!.archived_at) !== Boolean(server!.archived_at)) {
    operations.push({ ...common, operationId: randomUUID(), action: 'archive',
      dependsOn: operations[0].operationId, resolutionOf: null, baseVersion: server!.row_version + 1,
      payload: { archived: Boolean(local!.archived_at) } });
  }
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const entry of entries) {
      if (entry.operation.entityId === conflict.operation.entityId && entry.seq >= conflict.seq &&
        ['conflict', 'blocked', 'rejected', 'pending'].includes(entry.status)) {
        await tx.runAsync("update outbox set status='superseded' where seq=? and scope=?", entry.seq, key);
      }
    }
    for (const operation of operations) {
      await tx.runAsync('insert into outbox(scope,entity_id,operation_id,operation_json,status,created_at) values(?,?,?,?,?,?)',
        key, operation.entityId, operation.operationId, JSON.stringify(operation), 'pending', now);
    }
    if (choice === 'server' && server) {
      await tx.runAsync('insert into client_cache(scope,id,json) values(?,?,?) on conflict(scope,id) do update set json=excluded.json',
        key, server.id, JSON.stringify(server));
    } else if (choice === 'server') {
      await tx.runAsync('delete from client_cache where scope=? and id=?', key, conflict.operation.entityId);
    }
  });
}

export async function resolveItemConflict(operationId: string, choice: 'server' | 'local') {
  const db = await database(); const key = await scope();
  const entries = await outboxEntries();
  const conflict = entries.find((entry) => entry.operation.operationId === operationId && entry.status === 'conflict');
  if (!conflict || conflict.operation.entityKind !== 'order_item') throw new Error('Conflit article introuvable.');
  const server = conflict.receipt?.server as ItemSnapshot | undefined;
  if (!server) throw new Error('Cet article n existe plus sur le serveur.');
  const orderId = conflict.operation.payload.orderId;
  const detail = await cachedResponse<OrderDetail>(`/orders/${orderId}`);
  const planning = await cachedPlanning({ status: 'all' });
  const detailItem = detail?.items.find((item) => item.id === conflict.operation.entityId);
  const planningItem = planning?.items.find((item) => item.item_id === conflict.operation.entityId);
  const local: ItemSnapshot | null = detailItem ? { id: detailItem.id, order_id: orderId,
    row_version: detailItem.row_version, status: detailItem.status, due_date: detailItem.due_date,
    assignee_user_id: detailItem.assignee_user_id } : planningItem ? { id: planningItem.item_id, order_id: orderId,
    row_version: planningItem.row_version, status: planningItem.status, due_date: planningItem.explicit_due_date,
    assignee_user_id: planningItem.assignee_user_id } : null;
  if (choice === 'local' && !local) throw new Error('Version locale introuvable.');
  const desired = choice === 'server' ? server : local!;
  const now = new Date().toISOString();
  const operation: ItemOperation = { operationId: randomUUID(), deviceId: await deviceId(db), clientCreatedAt: now,
    entityKind: 'order_item', entityId: conflict.operation.entityId, resolutionOf: operationId,
    action: 'update', baseVersion: server.row_version, payload: { orderId, status: desired.status,
      dueDate: desired.due_date, assigneeId: desired.assignee_user_id,
      reason: choice === 'server' ? 'Version serveur conservee' : 'Version locale reappliquee', choice } };
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const entry of entries) {
      if (entry.operation.entityId === conflict.operation.entityId && entry.seq >= conflict.seq &&
        ['conflict', 'blocked', 'rejected', 'pending'].includes(entry.status)) {
        await tx.runAsync("update outbox set status='superseded' where seq=? and scope=?", entry.seq, key);
      }
    }
    await tx.runAsync('insert into outbox(scope,entity_id,operation_id,operation_json,status,created_at) values(?,?,?,?,?,?)',
      key, operation.entityId, operation.operationId, JSON.stringify(operation), 'pending', now);
    await projectItem(tx, key, choice === 'server' ? server : { ...desired, row_version: server.row_version + 1 });
  });
}

export async function resolveOrderConflict(operationId: string, choice: 'server' | 'local') {
  const db = await database(); const key = await scope();
  const entries = await outboxEntries();
  const conflict = entries.find((entry) => entry.operation.operationId === operationId && entry.status === 'conflict');
  if (!conflict || conflict.operation.entityKind !== 'order') throw new Error('Conflit commande introuvable.');
  const server = conflict.receipt?.server as OrderSnapshot | undefined;
  if (!server) throw new Error('La commande n existe plus sur le serveur.');
  const local = await cachedResponse<OrderDetail>(`/orders/${conflict.operation.entityId}`);
  if (choice === 'local' && !local) throw new Error('Version locale introuvable.');
  if (choice === 'local' && server.cancelled_at) throw new Error('Une commande annulee sur le serveur ne peut pas etre modifiee.');
  const now = new Date().toISOString();
  const action: OrderOperation['action'] = choice === 'server' ? 'resolve' : local!.order.cancelled_at ? 'cancel' : 'update';
  const operation: OrderOperation = { operationId: randomUUID(), deviceId: await deviceId(db), clientCreatedAt: now,
    entityKind: 'order', entityId: conflict.operation.entityId, resolutionOf: operationId, action,
    baseVersion: choice === 'server' ? null : server.row_version,
    payload: choice === 'server' ? { choice: 'server' } : action === 'cancel'
      ? { reason: 'Annulation locale reappliquee', choice: 'local' }
      : { promisedDate: local!.order.promised_date, fittingDate: local!.order.fitting_date,
        instructions: local!.order.instructions, choice: 'local' } };
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const entry of entries) {
      if (entry.operation.entityId === conflict.operation.entityId && entry.seq >= conflict.seq &&
        ['conflict', 'blocked', 'rejected', 'pending'].includes(entry.status)) {
        await tx.runAsync("update outbox set status='superseded' where seq=? and scope=?", entry.seq, key);
      }
    }
    await tx.runAsync('insert into outbox(scope,entity_id,operation_id,operation_json,status,created_at) values(?,?,?,?,?,?)',
      key, operation.entityId, operation.operationId, JSON.stringify(operation), 'pending', now);
    await projectOrder(tx, key, choice === 'server' ? server : { id: server.id, row_version: server.row_version + 1,
      promised_date: local!.order.promised_date, fitting_date: local!.order.fitting_date,
      instructions: local!.order.instructions, cancelled_at: action === 'cancel' ? now : null });
  });
}

export async function queuePayment(payload: PaymentDraft): Promise<string> {
  if (!Number.isSafeInteger(payload.amount) || payload.amount <= 0) throw new Error('Montant invalide.');
  const idempotencyKey = `mobile:${randomUUID()}`;
  const db = await database();
  await db.runAsync('insert into financial_outbox(scope,idempotency_key,payload_json,status,created_at) values(?,?,?,?,?)',
    await scope(), idempotencyKey, JSON.stringify(payload), 'pending', new Date().toISOString());
  return idempotencyKey;
}

export async function paymentEntries(): Promise<PaymentEntry[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ seq: number; idempotency_key: string; payload_json: string; status: PaymentEntry['status']; message: string | null; movement_id: string | null; created_at: string }>(
    'select seq,idempotency_key,payload_json,status,message,movement_id,created_at from financial_outbox where scope=? order by seq', await scope());
  return rows.map((row) => ({ seq: row.seq, idempotencyKey: row.idempotency_key, payload: JSON.parse(row.payload_json) as PaymentDraft,
    status: row.status, message: row.message, movementId: row.movement_id, createdAt: row.created_at }));
}

export async function settlePayment(key: string, status: 'applied' | 'rejected', movementId: string | null, message: string | null) {
  const db = await database();
  await db.runAsync('update financial_outbox set status=?,movement_id=?,message=? where scope=? and idempotency_key=? and status=?',
    status, movementId, message, await scope(), key, 'pending');
}

export async function queueAttachment(path: string, file: AttachmentDraft, mimeType: string): Promise<string> {
  const id = randomUUID();
  const directory = new Directory(Paths.document, 'fileo-pending-attachments');
  directory.create({ idempotent: true, intermediates: true });
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const durable = new ExpoFile(directory, `${id}.${extension}`);
  await new ExpoFile(file.uri).copy(durable);
  try {
    const db = await database();
    await db.runAsync(`insert into attachment_outbox
      (scope,attachment_id,path,uri,name,mime_type,status,created_at) values(?,?,?,?,?,?,?,?)`,
      await scope(), id, path, durable.uri, file.name, mimeType, 'pending', new Date().toISOString());
  } catch (error) {
    durable.delete();
    throw error;
  }
  return id;
}

export async function attachmentEntries(): Promise<AttachmentEntry[]> {
  const db = await database();
  const rows = await db.getAllAsync<{ attachment_id: string; path: string; uri: string; name: string; mime_type: string; status: AttachmentEntry['status']; message: string | null; created_at: string }>(
    'select attachment_id,path,uri,name,mime_type,status,message,created_at from attachment_outbox where scope=? order by seq', await scope());
  return rows.map((row) => ({ id: row.attachment_id, path: row.path, uri: row.uri, name: row.name,
    mimeType: row.mime_type, status: row.status, message: row.message, createdAt: row.created_at }));
}

export async function settleAttachment(id: string, status: 'applied' | 'rejected', message: string | null) {
  const db = await database();
  await db.runAsync('update attachment_outbox set status=?,message=? where scope=? and attachment_id=? and status=?',
    status, message, await scope(), id, 'pending');
  if (status === 'applied') {
    const row = await db.getFirstAsync<{ uri: string }>('select uri from attachment_outbox where scope=? and attachment_id=?', await scope(), id);
    if (row) { const file = new ExpoFile(row.uri); if (file.exists) file.delete(); }
  }
}
