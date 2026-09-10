import type { Metadata } from "next";
import Link from "next/link";
import ClientForm from "@/components/clients/ClientForm";
import { requireWorkshop } from "@/lib/auth/guards";
import { getLocale } from "@/lib/i18n/request";
import { localePath } from "@/lib/i18n/config";

export const metadata: Metadata = { title: "Ajouter un client", robots: { index: false, follow: false } };

export default async function NewClientPage() {
  await requireWorkshop("clients.write");
  const locale = await getLocale();
  const clientsHref = localePath(locale, "/atelier/clients");
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={clientsHref} className="link link-hover text-sm text-base-content/60">Retour aux clients</Link>
      <h1 className="font-display mt-4 text-3xl font-extrabold">Ajouter un client</h1>
      <p className="mt-2 text-sm text-base-content/60">Le nom suffit. Tous les contacts restent facultatifs.</p>
      <div className="mt-8 border border-base-300 bg-base-100 p-6 sm:p-8">
        <ClientForm cancelHref={clientsHref} />
      </div>
    </div>
  );
}
