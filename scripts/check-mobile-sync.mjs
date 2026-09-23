import { randomUUID } from 'node:crypto';
import pg from 'pg';

process.loadEnvFile('config-supabase.env');
const base = process.env.BASE_URL ?? 'http://localhost:3000';
const connectionString = process.env.SUPABASE_POOLER_DB_URL || process.env.SUPABASE_DB_URL;
const db = new pg.Client({ connectionString, ssl: connectionString?.includes('supabase.co') ? { rejectUnauthorized: false } : undefined });
let token = '';
const entityId = randomUUID();
const deviceId = randomUUID();
const operations = [];
let orderId = null;
let itemId = null;
let dependentClientId = null;
let dependentOrderId = null;
let dependentItemId = null;
let attachmentId = null;
let measurementId = null;

async function api(path, method = 'GET', body, extraHeaders = {}) {
  const response = await fetch(`${base}/api/mobile/v1${path}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}), ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`${path}: ${result.error?.message ?? response.status}`);
  return result.data;
}

function operation(action, baseVersion, payload, dependsOn = null, resolutionOf = null) {
  const op = { operationId: randomUUID(), deviceId, clientCreatedAt: new Date().toISOString(), entityKind: 'client',
    entityId, dependsOn, resolutionOf, action, baseVersion, payload };
  operations.push(op);
  return op;
}

function check(label, condition) {
  if (!condition) throw new Error(label);
  console.log(`ok  ${label}`);
}

await db.connect();
try {
  const login = await api('/auth/login', 'POST', { country: 'CG', phone: '061111111', password: 'Atelier2026!' });
  token = login.token;
  const first = operation('create', null, { displayName: `Sync Test ${Date.now()}`, phone: null, otherContact: null, guardianName: null, guardianPhone: null, notes: null });
  const second = operation('update', 1, { ...first.payload, displayName: 'Sync Test phase 2' }, first.operationId);
  const third = operation('update', 2, { ...first.payload, displayName: 'Sync Test phase 3' }, second.operationId);
  const batch = await api('/sync', 'POST', { operations: [first, second, third] });
  check('trois alterations appliquees dans l ordre', batch.receipts.length === 3 && batch.receipts.every((row) => row.status === 'applied'));
  const retry = await api('/sync', 'POST', { operations: [first, second, third] });
  check('renvoi idempotent', retry.receipts.every((row, index) => row.rowVersion === batch.receipts[index].rowVersion));
  const history = await db.query('select action from public.audit_log where mobile_operation_id=any($1::uuid[]) order by created_at,id', [operations.map((op) => op.operationId)]);
  check('trois audits uniques', history.rowCount === 3);
  const current = await api(`/clients/${entityId}`);
  check('version finale attendue', current.display_name === 'Sync Test phase 3' && current.row_version === 3);

  await api(`/clients/${entityId}`, 'PATCH', { ...third.payload, displayName: 'Modification concurrente' });
  const conflicting = operation('update', 3, { ...third.payload, displayName: 'Version locale conflictuelle' });
  const dependent = operation('update', 4, { ...third.payload, displayName: 'Modification locale suivante' }, conflicting.operationId);
  const conflictBatch = await api('/sync', 'POST', { operations: [conflicting, dependent] });
  check('conflit conserve', conflictBatch.receipts[0].status === 'conflict');
  check('alteration dependante conservee et bloquee', conflictBatch.receipts[1].status === 'blocked');
  const resolved = operation('resolve', null, { choice: 'server' }, null, conflicting.operationId);
  const resolution = await api('/sync', 'POST', { operations: [resolved] });
  check('resolution historisee', resolution.receipts[0].status === 'applied');
  const rows = await db.query('select status from public.mobile_sync_operations where operation_id=any($1::uuid[])', [[conflicting.operationId, dependent.operationId, resolved.operationId]]);
  check('historique serveur complet', rows.rowCount === 3);

  await api(`/clients/${entityId}`, 'PATCH', { ...third.payload, displayName: 'Autre changement concurrent' });
  const localConflict = operation('update', 4, { ...third.payload, displayName: 'Version locale a reappliquer' });
  const localReceipt = await api('/sync', 'POST', { operations: [localConflict] });
  check('second conflit conserve', localReceipt.receipts[0].status === 'conflict');
  const reapply = operation('update', 5, localConflict.payload, null, localConflict.operationId);
  const reapplied = await api('/sync', 'POST', { operations: [reapply] });
  check('resolution locale appliquee', reapplied.receipts[0].status === 'applied');
  const final = await api(`/clients/${entityId}`);
  check('version locale finale retrouvee', final.display_name === 'Version locale a reappliquer');

  measurementId = randomUUID();
  const measurementOp = { operationId: randomUUID(), deviceId, clientCreatedAt: new Date().toISOString(),
    entityKind: 'measurement', entityId: measurementId, action: 'create', baseVersion: null,
    payload: { clientId: entityId, category: 'Robe', values: { poitrine: 91, taille: 73 }, notes: null, takenAt: '2026-09-21' } };
  operations.push(measurementOp);
  const measurementBatch = await api('/sync', 'POST', { operations: [measurementOp] });
  check('mensuration versionnee appliquee', measurementBatch.receipts[0].status === 'applied' && measurementBatch.receipts[0].rowVersion === 1);
  const measurementRetry = await api('/sync', 'POST', { operations: [measurementOp] });
  check('mensuration idempotente', measurementRetry.receipts[0].rowVersion === 1);

  orderId = randomUUID();
  itemId = randomUUID();
  const orderCreate = { operationId: randomUUID(), deviceId, clientCreatedAt: new Date().toISOString(), entityKind: 'order',
    entityId: orderId, action: 'create', baseVersion: null, payload: { clientId: entityId, itemIds: [itemId],
      promisedDate: '2026-09-30', fittingDate: null, instructions: null, orderTotalAmount: 1000,
      items: [{ category: 'Robe', description: 'Test synchronisation', workType: 'creation', quantity: 1,
        unitPriceAmount: 1000, dueDate: '2026-09-30' }], initialPayment: null } };
  operations.push(orderCreate);
  const created = await api('/sync', 'POST', { operations: [orderCreate] });
  check('creation commande hors ligne appliquee', created.receipts[0].status === 'applied');
  const creationRetry = await api('/sync', 'POST', { operations: [orderCreate] });
  check('creation commande idempotente', creationRetry.receipts[0].server?.reference === created.receipts[0].server?.reference);
  const order = { orderId, order: await api(`/orders/${orderId}`) };
  check('commande et article uniques', order.order.items.length === 1 && order.order.items[0].id === itemId);
  dependentClientId = randomUUID();
  dependentOrderId = randomUUID();
  dependentItemId = randomUUID();
  const newClient = { operationId: randomUUID(), deviceId, clientCreatedAt: new Date().toISOString(),
    entityKind: 'client', entityId: dependentClientId, action: 'create', baseVersion: null,
    payload: { displayName: 'Sync Test commande liee', phone: null, otherContact: null,
      guardianName: null, guardianPhone: null, notes: null } };
  const linkedOrder = { ...orderCreate, operationId: randomUUID(), entityId: dependentOrderId,
    dependsOn: newClient.operationId, payload: { ...orderCreate.payload, clientId: dependentClientId,
      itemIds: [dependentItemId] } };
  operations.push(newClient, linkedOrder);
  const linkedBatch = await api('/sync', 'POST', { operations: [newClient, linkedOrder] });
  check('nouveau client et commande lies appliques dans l ordre', linkedBatch.receipts.every((row) => row.status === 'applied'));
  const linkedRetry = await api('/sync', 'POST', { operations: [newClient, linkedOrder] });
  check('commande liee idempotente', linkedRetry.receipts[1].server?.reference === linkedBatch.receipts[1].server?.reference);
  const itemFirst = { operationId: randomUUID(), deviceId, clientCreatedAt: new Date().toISOString(), entityKind: 'order_item',
    entityId: itemId, action: 'update', baseVersion: order.order.items[0].row_version,
    payload: { orderId, status: 'en_cours', dueDate: '2026-09-30', reason: '' } };
  operations.push(itemFirst);
  const itemBatch = await api('/sync', 'POST', { operations: [itemFirst] });
  check('modification article appliquee', itemBatch.receipts[0].status === 'applied');
  const itemRetry = await api('/sync', 'POST', { operations: [itemFirst] });
  check('modification article idempotente', itemRetry.receipts[0].rowVersion === itemBatch.receipts[0].rowVersion);
  const itemConflict = { ...itemFirst, operationId: randomUUID(), baseVersion: order.order.items[0].row_version,
    payload: { ...itemFirst.payload, status: 'pret' } };
  operations.push(itemConflict);
  const itemConflictReceipt = await api('/sync', 'POST', { operations: [itemConflict] });
  check('conflit article conserve', itemConflictReceipt.receipts[0].status === 'conflict');
  const itemResolve = { ...itemFirst, operationId: randomUUID(), resolutionOf: itemConflict.operationId,
    baseVersion: itemBatch.receipts[0].rowVersion, payload: { ...itemFirst.payload, choice: 'server', reason: 'Version serveur conservee' } };
  operations.push(itemResolve);
  const itemResolveReceipt = await api('/sync', 'POST', { operations: [itemResolve] });
  check('resolution article historisee', itemResolveReceipt.receipts[0].status === 'applied');

  attachmentId = randomUUID();
  const attachmentPath = `/orders/${orderId}/attachments`;
  const attachmentBody = { files: [{ name: 'offline-test.png', mimeType: 'image/png', dataBase64: Buffer.from([137,80,78,71,13,10,26,10]).toString('base64') }] };
  const attachmentHeaders = { 'x-fileo-attachment-id': attachmentId };
  const firstUpload = await api(attachmentPath, 'POST', attachmentBody, attachmentHeaders);
  const secondUpload = await api(attachmentPath, 'POST', attachmentBody, attachmentHeaders);
  check('piece jointe idempotente', firstUpload.items[0]?.id === attachmentId && secondUpload.items[0]?.id === attachmentId);
  const attachments = await api(attachmentPath);
  check('piece jointe sans doublon', attachments.items.filter((item) => item.id === attachmentId).length === 1);

  const orderUpdate = { operationId: randomUUID(), deviceId, clientCreatedAt: new Date().toISOString(), entityKind: 'order',
    entityId: orderId, action: 'update', baseVersion: order.order.order.row_version,
    payload: { promisedDate: '2026-10-01', fittingDate: null, instructions: 'Consigne hors ligne' } };
  operations.push(orderUpdate);
  const orderUpdateReceipt = await api('/sync', 'POST', { operations: [orderUpdate] });
  check('modification commande appliquee', orderUpdateReceipt.receipts[0].status === 'applied');
  const orderRetry = await api('/sync', 'POST', { operations: [orderUpdate] });
  check('modification commande idempotente', orderRetry.receipts[0].rowVersion === orderUpdateReceipt.receipts[0].rowVersion);
  const orderConflict = { ...orderUpdate, operationId: randomUUID(), baseVersion: order.order.order.row_version,
    payload: { ...orderUpdate.payload, promisedDate: '2026-10-03' } };
  operations.push(orderConflict);
  const orderConflictReceipt = await api('/sync', 'POST', { operations: [orderConflict] });
  check('conflit commande conserve', orderConflictReceipt.receipts[0].status === 'conflict');
  const orderResolution = { ...orderUpdate, operationId: randomUUID(), action: 'resolve', baseVersion: null,
    resolutionOf: orderConflict.operationId, payload: { choice: 'server' } };
  operations.push(orderResolution);
  const orderResolutionReceipt = await api('/sync', 'POST', { operations: [orderResolution] });
  check('resolution commande historisee', orderResolutionReceipt.receipts[0].status === 'applied');
} finally {
  if (orderId && attachmentId) {
    try { await api(`/orders/${orderId}/attachments/${attachmentId}`, 'DELETE'); } catch { /* Cleanup continues below. */ }
  }
  await db.query('delete from public.audit_log where entity_id=any($1::uuid[])', [[entityId, orderId, itemId, measurementId, dependentClientId, dependentOrderId, dependentItemId].filter(Boolean)]);
  await db.query('delete from public.mobile_sync_operations where operation_id=any($1::uuid[])', [operations.map((op) => op.operationId)]);
  if (orderId) await db.query('delete from public.orders where id=$1', [orderId]);
  if (dependentOrderId) await db.query('delete from public.orders where id=$1', [dependentOrderId]);
  await db.query('delete from public.clients where id=$1', [entityId]);
  if (dependentClientId) await db.query('delete from public.clients where id=$1', [dependentClientId]);
  await db.end();
}
