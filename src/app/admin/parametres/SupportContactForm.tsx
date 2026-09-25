"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { saveSupportContact, type SupportContactFormState } from "@/lib/actions/support-contact";

const initialState: SupportContactFormState = {};

export default function SupportContactForm({ email, appVersion, companyName, rowVersion }: {
  email: string;
  appVersion: string;
  companyName: string;
  rowVersion: number;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveSupportContact, initialState);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [router, state.success]);

  return (
    <form action={action} className="mt-5 space-y-5">
      <label className="form-control block">
        <span className="label-text mb-1.5 block text-sm font-medium">Email du support</span>
        <input
          type="email"
          name="email"
          defaultValue={email}
          autoComplete="email"
          required
          maxLength={254}
          className="input input-bordered w-full"
        />
      </label>

      <label className="form-control block">
        <span className="label-text mb-1.5 block text-sm font-medium">Version de l'application</span>
        <input
          type="text"
          name="appVersion"
          defaultValue={appVersion}
          required
          maxLength={40}
          className="input input-bordered w-full"
          placeholder="1.0.0"
        />
      </label>

      <label className="form-control block">
        <span className="label-text mb-1.5 block text-sm font-medium">Entreprise</span>
        <input
          type="text"
          name="companyName"
          defaultValue={companyName}
          required
          maxLength={80}
          className="input input-bordered w-full"
          placeholder="Nzelobi"
        />
      </label>

      <input type="hidden" name="rowVersion" value={rowVersion} />
      {state.error ? <p role="alert" className="alert alert-error text-sm">{state.error}</p> : null}
      {state.success ? <p role="status" className="alert alert-success text-sm">Paramètres enregistrés.</p> : null}
      <button type="submit" disabled={pending} className="btn btn-primary gap-2">
        <Icon name="check" className="h-4 w-4" />
        {pending ? "Enregistrement..." : "Enregistrer"}
      </button>
    </form>
  );
}
