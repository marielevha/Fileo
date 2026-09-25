import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import SignUpForm from "./SignUpForm";
import { getPostLoginDestination } from "@/lib/auth/destinations";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Creer mon atelier",
  description: "Creez votre compte Fileo et votre atelier en quelques minutes.",
  robots: { index: false, follow: false },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ offre?: string }>;
}) {
  const session = await getSession();
  if (session) {
    redirect(await getPostLoginDestination({
      userId: session.user.id,
      platformRoles: session.user.platformRoles,
      hasWorkshop: Boolean(session.workshop),
    }));
  }
  const { offre } = await searchParams;

  return (
    <div className="bg-base-100 border-base-300 rounded-2xl border p-8 shadow-xl">
      <h1 className="font-display text-2xl font-extrabold">Creer mon atelier</h1>
      <p className="text-base-content/60 mt-1.5 text-sm">
        Essai de 14 jours. Aucun moyen de paiement demande pour demarrer.
      </p>

      <SignUpForm planCode={offre} />

      <p className="text-base-content/60 mt-6 text-center text-sm">
        Vous avez deja un compte ?{" "}
        <Link href="/connexion" className="link link-primary font-medium">
          Se connecter
        </Link>
      </p>
      <p className="text-base-content/60 mt-2 text-center text-sm">
        Vous voulez recommander Fileo ?{" "}
        <Link href="/affiliation" className="link link-primary font-medium">
          Devenir affilie
        </Link>
      </p>
    </div>
  );
}
