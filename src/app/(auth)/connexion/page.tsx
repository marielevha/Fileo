import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import SignInForm from "./SignInForm";
import { getSession } from "@/lib/auth/session";
import { canInAdmin } from "@/lib/permissions";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Accédez à votre atelier Filéo.",
  robots: { index: false, follow: false },
};

export default async function SignInPage() {
  const session = await getSession();
  if (session) {
    redirect(canInAdmin(session.actor, "admin.dashboard") ? "/admin" : "/atelier");
  }

  return (
    <div className="bg-base-100 border-base-300 rounded-2xl border p-8 shadow-xl">
      <h1 className="font-display text-2xl font-extrabold">Connexion</h1>
      <p className="text-base-content/60 mt-1.5 text-sm">
        Le même compte donne accès au web et à l&apos;application mobile.
      </p>

      <SignInForm />

      <p className="text-base-content/60 mt-6 text-center text-sm">
        Pas encore d&apos;atelier ?{" "}
        <Link href="/inscription" className="link link-primary font-medium">
          Créer mon atelier
        </Link>
      </p>
    </div>
  );
}
