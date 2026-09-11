import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ClientForm from "@/components/clients/ClientForm";
import { requireWorkshop } from "@/lib/auth/guards";
import { getClient } from "@/lib/repos/clients";
import { getLocale } from "@/lib/i18n/request";
import { localePath } from "@/lib/i18n/config";

export const metadata: Metadata = { title: "Modifier un client", robots: { index: false, follow: false } };

export default async function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { workshop } = await requireWorkshop("clients.write");
  const { id } = await params;
  const client = await getClient(workshop.id, id);
  if (!client) notFound();
  const locale = await getLocale();
  const detailHref = localePath(locale, `/atelier/clients/${id}`);
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={detailHref} className="link link-hover text-sm text-base-content/60">Retour à la fiche</Link>
      <h1 className="font-display mt-4 text-3xl font-extrabold">Modifier {client.display_name}</h1>
      <div className="mt-8 border border-base-300 bg-base-100 p-6 sm:p-8">
        <ClientForm client={{ ...client }} cancelHref={detailHref} />
      </div>
    </div>
  );
}
