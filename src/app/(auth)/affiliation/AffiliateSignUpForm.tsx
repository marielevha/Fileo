"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import PhoneField from "@/components/auth/PhoneField";
import { signUpAffiliate, type FormState } from "@/lib/actions/auth";

const initial: FormState = {};

export default function AffiliateSignUpForm() {
  const [state, action, pending] = useActionState(signUpAffiliate, initial);
  const [autoCode, setAutoCode] = useState(true);
  const [requestedCode, setRequestedCode] = useState("");

  return (
    <form action={action} className="mt-7 space-y-4">
      <div>
        <label className="label-text mb-1.5 block font-medium" htmlFor="fullName">
          Votre nom <span className="text-error">*</span>
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          className="input input-bordered w-full"
        />
      </div>

      <PhoneField />

      <div>
        <label className="label-text mb-1.5 block font-medium" htmlFor="password">
          Mot de passe <span className="text-error">*</span>
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          className="input input-bordered w-full"
        />
        <p className="text-base-content/50 mt-1.5 text-xs">
          8 caracteres minimum, avec au moins une lettre et un chiffre.
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="label-text font-medium" htmlFor="requestedCode">
            Code souhaite
          </label>
          <label className="flex items-center gap-2 text-xs text-base-content/65">
            <input
              type="checkbox"
              name="autoCode"
              checked={autoCode}
              onChange={(event) => setAutoCode(event.target.checked)}
              className="checkbox checkbox-primary checkbox-xs"
            />
            Generer automatiquement
          </label>
        </div>
        <input
          id="requestedCode"
          name="requestedCode"
          type="text"
          autoCapitalize="characters"
          disabled={autoCode}
          placeholder={autoCode ? "Fileo choisira un code unique" : "Ex. MARIE-FILEO"}
          className="input input-bordered w-full uppercase disabled:bg-base-200"
          value={requestedCode}
          onChange={(event) => setRequestedCode(cleanCode(event.target.value))}
        />
        <p className="text-base-content/50 mt-1.5 text-xs">
          Lettres majuscules, chiffres, tiret (-) et underscore (_) uniquement.
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" className="checkbox checkbox-primary checkbox-sm mt-0.5" />
        <span>
          J&apos;accepte les{" "}
          <Link href="/cgv" className="link link-primary">
            conditions generales
          </Link>{" "}
          et la{" "}
          <Link href="/politique-de-confidentialite" className="link link-primary">
            politique de confidentialite
          </Link>
          .
        </span>
      </label>

      {state.error ? (
        <p role="alert" className="alert alert-error text-sm">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? <span className="loading loading-spinner loading-sm" /> : null}
        Creer mon compte affilie
      </button>
    </form>
  );
}

function cleanCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
}
