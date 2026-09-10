"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import PhoneField from "@/components/auth/PhoneField";
import { signUp, type FormState } from "@/lib/actions/auth";
import { CURRENCIES, CURRENCY_CODES } from "@/lib/money";
import { COUNTRIES, type CountryCode } from "@/lib/phone";

const initial: FormState = {};

export default function SignUpForm({ planCode }: { planCode?: string }) {
  // The country drives the suggested currency, but the operator keeps the
  // final say: §2.3 leaves the working currency per workshop.
  const [currency, setCurrency] = useState<string>(COUNTRIES.CG.defaultCurrency);
  const [state, action, pending] = useActionState(signUp, initial);

  return (
    <form action={action} className="mt-7 space-y-4">
      {planCode ? <input type="hidden" name="planCode" value={planCode} /> : null}
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

      <PhoneField
        onCountryChange={(country: CountryCode) =>
          setCurrency(COUNTRIES[country].defaultCurrency)
        }
      />

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
          8 caractères minimum, avec au moins une lettre et un chiffre.
        </p>
      </div>

      <hr className="border-base-300" />

      <div>
        <label className="label-text mb-1.5 block font-medium" htmlFor="workshopName">
          Nom de l&apos;atelier <span className="text-error">*</span>
        </label>
        <input
          id="workshopName"
          name="workshopName"
          type="text"
          required
          placeholder="Atelier Élégance"
          className="input input-bordered w-full"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label-text mb-1.5 block font-medium" htmlFor="city">
            Ville
          </label>
          <input id="city" name="city" type="text" className="input input-bordered w-full" />
        </div>

        <div>
          <label className="label-text mb-1.5 block font-medium" htmlFor="currency">
            Devise <span className="text-error">*</span>
          </label>
          <select
            id="currency"
            name="currency"
            className="select select-bordered w-full"
            value={currency}
            onChange={(event) => setCurrency(event.target.value)}
          >
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code} — {CURRENCIES[code].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* §7.2: changing the currency after the first transaction is not a
          silent conversion, so the choice is flagged as durable up front. */}
      <p className="alert alert-info text-sm">
        La devise sert à tous vos montants. Elle ne pourra plus être modifiée librement une fois
        vos premières transactions enregistrées.
      </p>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" className="checkbox checkbox-primary checkbox-sm mt-0.5" />
        <span>
          J&apos;accepte les{" "}
          <Link href="/cgv" className="link link-primary">
            conditions générales
          </Link>{" "}
          et la{" "}
          <Link href="/politique-de-confidentialite" className="link link-primary">
            politique de confidentialité
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
        Créer mon atelier
      </button>
    </form>
  );
}
