import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import AffiliateSignUpForm from "./AffiliateSignUpForm";
import { getPostLoginDestination } from "@/lib/auth/destinations";
import { getSession } from "@/lib/auth/session";
import { getAffiliateProgramSettings } from "@/lib/repos/affiliates";

export const metadata: Metadata = {
  title: "Programme d'affiliation",
  description: "Creez un compte affilie Fileo sans atelier.",
  robots: { index: false, follow: false },
};

export default async function AffiliateSignUpPage() {
  const session = await getSession();
  const settings = await getAffiliateProgramSettings();
  if (session) {
    redirect(await getPostLoginDestination({
      userId: session.user.id,
      platformRoles: session.user.platformRoles,
      hasWorkshop: Boolean(session.workshop),
    }));
  }

  return (
    <div className="bg-base-100 border-base-300 rounded-2xl border p-8 shadow-xl">
      <div className="badge badge-primary badge-outline mb-4">Affiliation Fileo</div>
      <h1 className="font-display text-2xl font-extrabold">{settings.public_title}</h1>
      <p className="text-base-content/60 mt-1.5 text-sm">
        {settings.public_description}
      </p>

      <div className="bg-primary/8 border-primary/20 mt-5 rounded-2xl border p-4 text-sm">
        <p className="font-semibold">Le parcours MVP</p>
        <p className="text-base-content/65 mt-1">
          Une commission est preparee sur le premier paiement valide d&apos;un atelier recommande,
          puis une seconde lorsque l&apos;atelier atteint le palier de {settings.sixth_month_threshold_months} mois.
        </p>
      </div>

      {settings.enabled ? <AffiliateSignUpForm /> : (
        <p className="alert alert-warning mt-5 text-sm">Le programme est temporairement ferme aux nouvelles inscriptions.</p>
      )}

      <p className="text-base-content/60 mt-6 text-center text-sm">
        Vous avez deja un compte ?{" "}
        <Link href="/connexion" className="link link-primary font-medium">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
