"use client";

import { useActionState } from "react";
import PhoneField from "@/components/auth/PhoneField";
import { signIn, type FormState } from "@/lib/actions/auth";

const initial: FormState = {};

export default function SignInForm() {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <form action={action} className="mt-7 space-y-4">
      <PhoneField />

      <div>
        <label className="label-text mb-1.5 block font-medium" htmlFor="password">
          Mot de passe <span className="text-error">*</span>
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="input input-bordered w-full"
        />
      </div>

      {state.error ? (
        <p role="alert" className="alert alert-error text-sm">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn btn-primary w-full">
        {pending ? <span className="loading loading-spinner loading-sm" /> : null}
        Se connecter
      </button>
    </form>
  );
}
