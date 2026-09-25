import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import SignInForm from "./SignInForm";
import { getPostLoginDestination } from "@/lib/auth/destinations";
import { getSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Accedez a votre espace Fileo.",
  robots: { index: false, follow: false },
};

export default async function SignInPage() {
  const session = await getSession();
  if (session) {
    redirect(await getPostLoginDestination({
      userId: session.user.id,
      platformRoles: session.user.platformRoles,
      hasWorkshop: Boolean(session.workshop),
    }));
  }

  return (
    <div className="bg-base-100 border-base-300 rounded-2xl border p-8 shadow-xl">
      <h1 className="font-display text-2xl font-extrabold">Connexion</h1>
      <p className="text-base-content/60 mt-1.5 text-sm">
        Le meme compte donne acces au web et a l&apos;application mobile.
      </p>

      <SignInForm />

      <p className="text-base-content/60 mt-6 text-center text-sm">
        Pas encore d&apos;atelier ?{" "}
        <Link href="/inscription" className="link link-primary font-medium">
          Creer mon atelier
        </Link>
      </p>
      <p className="text-base-content/60 mt-2 text-center text-sm">
        Vous vendez Fileo ?{" "}
        <Link href="/affiliation" className="link link-primary font-medium">
          Creer un compte affilie
        </Link>
      </p>
    </div>
  );
}
