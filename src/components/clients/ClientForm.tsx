"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  createClientAction,
  updateClientAction,
  type ClientFormState,
} from "@/lib/actions/clients";
import type { ClientRow } from "@/lib/repos/clients";

const initialState: ClientFormState = {};

export default function ClientForm({
  client,
  cancelHref,
}: {
  client?: ClientRow;
  cancelHref: string;
}) {
  const action = client ? updateClientAction.bind(null, client.id) : createClientAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label-text mb-1.5 block font-medium" htmlFor="displayName">
            Nom complet <span className="text-error">*</span>
          </label>
          <input
            id="displayName"
            name="displayName"
            required
            minLength={2}
            maxLength={120}
            defaultValue={client?.display_name ?? ""}
            autoComplete="name"
            className="input input-bordered w-full"
          />
        </div>

        <div>
          <label className="label-text mb-1.5 block font-medium" htmlFor="phone">
            Téléphone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={client?.phone_e164 ?? ""}
            autoComplete="tel"
            placeholder="06 123 45 67"
            className="input input-bordered w-full"
          />
        </div>

        <div>
          <label className="label-text mb-1.5 block font-medium" htmlFor="otherContact">
            Autre contact
          </label>
          <input
            id="otherContact"
            name="otherContact"
            maxLength={160}
            defaultValue={client?.other_contact ?? ""}
            placeholder="E-mail, WhatsApp secondaire..."
            className="input input-bordered w-full"
          />
        </div>

        <div>
          <label className="label-text mb-1.5 block font-medium" htmlFor="guardianName">
            Parent ou tuteur
          </label>
          <input
            id="guardianName"
            name="guardianName"
            maxLength={120}
            defaultValue={client?.guardian_name ?? ""}
            className="input input-bordered w-full"
          />
        </div>

        <div>
          <label className="label-text mb-1.5 block font-medium" htmlFor="guardianPhone">
            Téléphone du tuteur
          </label>
          <input
            id="guardianPhone"
            name="guardianPhone"
            type="tel"
            defaultValue={client?.guardian_phone ?? ""}
            className="input input-bordered w-full"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="label-text mb-1.5 block font-medium" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={5}
            maxLength={2000}
            defaultValue={client?.notes ?? ""}
            placeholder="Préférences, informations utiles..."
            className="textarea textarea-bordered w-full"
          />
        </div>
      </div>

      {state.error ? <p className="alert alert-error text-sm" role="alert">{state.error}</p> : null}

      <div className="flex flex-wrap justify-end gap-3 border-t border-base-300 pt-6">
        <Link href={cancelHref} className="btn btn-ghost">Annuler</Link>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? <span className="loading loading-spinner loading-sm" /> : null}
          {client ? "Enregistrer les modifications" : "Ajouter le client"}
        </button>
      </div>
    </form>
  );
}
