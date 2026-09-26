"use client";

import { useActionState, useState } from "react";
import { joinAffiliateProgramAction, type AffiliateActionState } from "@/lib/actions/affiliates";

const initial: AffiliateActionState = {};

export default function JoinAffiliateProgramForm({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(joinAffiliateProgramAction, initial);
  const [autoCode, setAutoCode] = useState(true);
  const [code, setCode] = useState("");

  return (
    <form action={action} className="mt-6 grid gap-4 sm:max-w-md">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="label-text font-medium" htmlFor="affiliate-code">
            Code souhaite
          </label>
          <label className="flex items-center gap-2 text-xs text-base-content/65">
            <input
              type="checkbox"
              name="autoCode"
              checked={autoCode}
              onChange={(event) => setAutoCode(event.target.checked)}
              className="checkbox checkbox-primary checkbox-xs"
              disabled={disabled}
            />
            Generer automatiquement
          </label>
        </div>
        <input
          id="affiliate-code"
          name="code"
          placeholder={autoCode ? "Fileo choisira un code unique" : "FILEO-BZV"}
          className="input input-bordered w-full uppercase disabled:bg-base-200"
          disabled={disabled || autoCode}
          value={code}
          onChange={(event) => setCode(cleanCode(event.target.value))}
        />
        <p className="mt-1.5 text-xs text-base-content/50">
          Lettres majuscules, chiffres, tiret (-) et underscore (_) uniquement. Le code doit etre unique.
        </p>
      </div>

      {state.error ? <p className="alert alert-error text-sm">{state.error}</p> : null}

      <button type="submit" disabled={disabled || pending} className="btn btn-primary">
        {pending ? <span className="loading loading-spinner loading-sm" /> : null}
        Creer mon code
      </button>
    </form>
  );
}

function cleanCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
}
