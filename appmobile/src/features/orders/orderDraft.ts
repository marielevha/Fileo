import { randomUUID } from 'expo-crypto';
import { Directory, File as ExpoFile, Paths } from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

import { getAuthSession } from '../../auth/session';
import type { AttachmentDraft } from '../../components/AttachmentPicker';
import type { ClientOption } from '../../types/orders';

export type OrderDraftItem = {
  id: string; category: string; description: string; workType: 'creation' | 'retouche';
  wearerName: string; unitPrice: string; dueDate: string; measurements: string;
};

export type OrderDraft = {
  step: number; clientMode: 'existing' | 'new'; clientQuery: string; selectedClient: ClientOption | null;
  newClientName: string; newClientPhone: string; promisedDate: string; fittingDate: string;
  instructions: string; items: OrderDraftItem[]; draft: OrderDraftItem; manualTotal: string;
  payment: string; paymentMethod: 'cash' | 'mobile_money' | 'transfer' | 'other';
  paymentReference: string; attachments: AttachmentDraft[];
};

export function hasMeaningfulOrderDraft(draft: OrderDraft): boolean {
  return Boolean(draft.selectedClient || draft.clientQuery.trim() || draft.newClientName.trim() ||
    draft.newClientPhone.trim() || draft.promisedDate || draft.fittingDate || draft.instructions.trim() ||
    draft.items.length || draft.draft.category.trim() || draft.draft.description.trim() ||
    draft.draft.wearerName.trim() || draft.draft.measurements.trim() || draft.draft.unitPrice.trim() ||
    draft.draft.dueDate || draft.manualTotal.trim() || draft.payment.trim() ||
    draft.paymentReference.trim() || draft.attachments.length);
}

export function persistOrderDraft(draft: OrderDraft): Promise<void> {
  return hasMeaningfulOrderDraft(draft) ? saveOrderDraft(draft) : clearOrderDraft();
}

async function draftLocation() {
  const session = await getAuthSession();
  if (!session?.userId || !session.workshopId) return null;
  const scope = `${session.userId}-${session.workshopId}`;
  return { key: `fileo.order.draft.${scope}`, directory: new Directory(Paths.document, 'fileo-order-drafts', scope) };
}

export async function loadOrderDraft(): Promise<OrderDraft | null> {
  const location = await draftLocation();
  if (!location) return null;
  const saved = await Storage.getItem(location.key);
  if (!saved) return null;
  try {
    const draft = JSON.parse(saved) as OrderDraft;
    if (!Array.isArray(draft.items) || !draft.draft || !Array.isArray(draft.attachments)) return null;
    draft.attachments = draft.attachments.filter((file) => Platform.OS === 'web' || new ExpoFile(file.uri).exists);
    return draft;
  } catch { return null; }
}

let draftWrite: Promise<void> = Promise.resolve();

export function saveOrderDraft(draft: OrderDraft): Promise<void> {
  const work = draftWrite.then(async () => {
    const location = await draftLocation();
    if (!location) return;
    const previous = await loadOrderDraft();
    const attachments: AttachmentDraft[] = [];
    if (Platform.OS !== 'web') location.directory.create({ idempotent: true, intermediates: true });
    for (const file of draft.attachments) {
      if (Platform.OS === 'web') continue;
      const existing = previous?.attachments.find((item) => item.id === file.id);
      if (existing && new ExpoFile(existing.uri).exists) { attachments.push(existing); continue; }
      const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
      const target = new ExpoFile(location.directory, `${randomUUID()}.${extension}`);
      await new ExpoFile(file.uri).copy(target);
      attachments.push({ ...file, uri: target.uri });
    }
    await Storage.setItem(location.key, JSON.stringify({ ...draft, attachments }));
    if (previous && Platform.OS !== 'web') for (const file of previous.attachments) {
      if (!attachments.some((item) => item.uri === file.uri) && file.uri.startsWith(location.directory.uri)) {
        const old = new ExpoFile(file.uri);
        if (old.exists) old.delete();
      }
    }
  });
  draftWrite = work.catch(() => undefined);
  return work;
}

export function clearOrderDraft(): Promise<void> {
  const work = draftWrite.then(async () => {
    const location = await draftLocation();
    if (!location) return;
    const saved = await loadOrderDraft();
    await Storage.removeItem(location.key);
    if (saved && Platform.OS !== 'web') for (const file of saved.attachments) {
      if (file.uri.startsWith(location.directory.uri)) {
        const local = new ExpoFile(file.uri);
        if (local.exists) local.delete();
      }
    }
  });
  draftWrite = work.catch(() => undefined);
  return work;
}
