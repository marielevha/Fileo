"use client";

import { useFormStatus } from "react-dom";
import { deleteClientAction } from "@/lib/actions/clients";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-error btn-sm" disabled={pending}>
      {pending ? <span className="loading loading-spinner loading-xs" /> : null}
      Supprimer
    </button>
  );
}

export default function DeleteClientButton({ clientId, name }: { clientId: string; name: string }) {
  return (
    <form
      action={deleteClientAction.bind(null, clientId)}
      onSubmit={(event) => {
        if (!window.confirm(`Supprimer la fiche de ${name} ? Les commandes associées sont conservées.`)) {
          event.preventDefault();
        }
      }}
    >
      <SubmitButton />
    </form>
  );
}
