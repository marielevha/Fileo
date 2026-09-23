import type { Metadata } from "next";
import PageHeader from "@/components/app/PageHeader";
import { requireAdmin } from "@/lib/auth/guards";
import { getSupportContact } from "@/lib/repos/support-contact";
import SupportContactForm from "./SupportContactForm";

export const metadata: Metadata = {
  title: "Paramètres - Support",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  await requireAdmin("admin.settings");
  const contact = await getSupportContact();

  return (
    <>
      <PageHeader title="Coordonnées du support" description="Adresse utilisée sur le site et dans l'application mobile." />
      <section className="border-base-300 bg-base-100 max-w-2xl rounded-lg border p-6">
        <h2 className="font-display text-lg font-bold">Assistance par email</h2>
        <SupportContactForm key={contact.row_version} email={contact.email} rowVersion={contact.row_version} />
      </section>
    </>
  );
}
