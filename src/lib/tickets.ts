/**
 * Support request categories (§13.3).
 *
 * Kept out of the "use server" module on purpose: a Server Actions file may
 * only export async functions, so shared constants live here and are imported
 * by both the action and the form.
 */
export const TICKET_CATEGORIES = [
  { value: "compte", label: "Compte" },
  { value: "abonnement", label: "Abonnement" },
  { value: "commande", label: "Commande" },
  { value: "paiement", label: "Paiement atelier" },
  { value: "synchronisation", label: "Synchronisation" },
  { value: "autre", label: "Autre" },
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number]["value"];

export const TICKET_CATEGORY_VALUES: ReadonlySet<string> = new Set(
  TICKET_CATEGORIES.map((category) => category.value),
);
