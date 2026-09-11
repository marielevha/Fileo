"use server";

import { getSession } from "@/lib/auth/session";
import { createTicket } from "@/lib/repos/admin";
import { TICKET_CATEGORY_VALUES } from "@/lib/tickets";

// A "use server" module may only export async functions — the category list
// lives in @/lib/tickets so both this action and the form can read it.
export type ContactState = { error?: string; ok?: boolean };

/**
 * Public contact form. Creates a ticket the back-office can pick up (§12.5),
 * rather than sending mail into a void.
 */
export async function submitContact(
  _prev: ContactState,
  formData: FormData,
): Promise<ContactState> {
  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const category = String(formData.get("category") ?? "autre");
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("message") ?? "").trim();

  // Honeypot: a real person leaves this hidden field empty (§6.2).
  if (String(formData.get("website") ?? "") !== "") return { ok: true };

  if (name.length < 2) return { error: "Merci d'indiquer votre nom." };
  if (contact.length < 5) {
    return { error: "Merci d'indiquer un email ou un téléphone pour vous répondre." };
  }
  if (!TICKET_CATEGORY_VALUES.has(category)) return { error: "Catégorie invalide." };
  if (subject.length < 3) return { error: "Merci d'indiquer un objet." };
  if (body.length < 10) return { error: "Merci de détailler un peu votre demande." };
  if (body.length > 5000) return { error: "Message trop long (5 000 caractères maximum)." };

  const session = await getSession();

  await createTicket({
    workshopId: session?.workshop?.id ?? null,
    requesterUserId: session?.user.id ?? null,
    requesterName: name,
    requesterContact: contact,
    category,
    subject,
    body,
  });

  return { ok: true };
}
