import type { OrderState, ItemStatus } from '../../types/orders';
import { palette } from '../../theme';

export const orderStateLabels: Record<OrderState, string> = {
  nouvelle: 'Nouvelle', en_cours: 'En cours', prete: 'Prête',
  partiellement_remise: 'Partiellement remise', remise: 'Remise', annulee: 'Annulée',
};

export const itemStatusLabels: Record<ItemStatus, string> = {
  a_realiser: 'À réaliser', en_cours: 'En cours', a_essayer: 'À essayer',
  pret: 'Prêt', remis: 'Remis', annule: 'Annulé',
};

export const itemStatuses = Object.keys(itemStatusLabels) as ItemStatus[];

export function stateTone(state: OrderState) {
  if (state === 'annulee') return { background: '#FDE7E7', foreground: '#B42318' };
  if (state === 'remise') return { background: palette.cyan100, foreground: '#087B76' };
  if (state === 'prete') return { background: palette.pink100, foreground: '#B82D75' };
  if (state === 'en_cours' || state === 'partiellement_remise') return { background: palette.amber100, foreground: '#8A5A00' };
  return { background: palette.violet100, foreground: palette.violet700 };
}

export function itemTone(status: ItemStatus) {
  return stateTone(status === 'pret' ? 'prete' : status === 'remis' ? 'remise' : status === 'annule' ? 'annulee' : status === 'a_realiser' ? 'nouvelle' : 'en_cours');
}

export function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

export function formatDate(value: string | null, fallback = 'Non définie') {
  if (!value) return fallback;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function todayKey() {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}
