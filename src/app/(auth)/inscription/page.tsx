import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import SignUpForm from "./SignUpForm";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Créer mon atelier",
  description: "Créez votre compte Filéo et votre atelier en quelques minutes.",
  robots: { index: false, follow: false },
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ offre?: string }>;
}) {
  if (await getSession()) redirect("/atelier");
  const { offre } = await searchParams;

  return (
    <div className="bg-base-100 border-base-300 rounded-2xl border p-8 shadow-xl">
      <h1 className="font-display text-2xl font-extrabold">Créer mon atelier</h1>
      <p className="text-base-content/60 mt-1.5 text-sm">
        Essai de 14 jours. Aucun moyen de paiement demandé pour démarrer.
      </p>

      <SignUpForm planCode={offre} />

      <p className="text-base-content/60 mt-6 text-center text-sm">
        Vous avez déjà un compte ?{" "}
        <Link href="/connexion" className="link link-primary font-medium">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
