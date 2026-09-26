import PageHeader from "@/components/app/PageHeader";
import { requireAdmin } from "@/lib/auth/guards";
import { listAllPlans } from "@/lib/repos/contents";
import PlansTable from "./PlansTable";

export const metadata = { title: "Offres - Administration", robots: { index: false, follow: false } };

export default async function AdminPlansPage() {
  await requireAdmin("admin.subscriptions");
  const plans = await listAllPlans();

  return (
    <>
      <PageHeader
        title="Offres et limites"
        description="Pilotez les plans, leurs limites et leur visibilité publique."
      />
      <PlansTable plans={plans} />
    </>
  );
}
