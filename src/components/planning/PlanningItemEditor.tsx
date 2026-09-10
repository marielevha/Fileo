"use client";

import { useActionState, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import {
  updatePlanningItemAction,
  type PlanningItemActionState,
} from "@/lib/actions/planning";

type Member = { id: string; full_name: string };

const statuses = [
  ["a_realiser", "À réaliser"],
  ["en_cours", "En cours"],
  ["a_essayer", "À essayer"],
  ["pret", "Prêt"],
  ["remis", "Remis"],
  ["annule", "Annulé"],
] as const;

export default function PlanningItemEditor({
  item,
  members,
  compact = false,
}: {
  item: {
    item_id: string;
    reference: string;
    description: string;
    status: string;
    explicit_due_date: string | null;
    assignee_user_id: string | null;
    row_version: number;
  };
  members: Member[];
  compact?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const returnTo = query ? `${pathname}?${query}` : pathname;
  const boundAction = updatePlanningItemAction.bind(null, item.item_id);
  const [state, formAction, pending] = useActionState<PlanningItemActionState, FormData>(
    boundAction,
    {},
  );

  useEffect(() => {
    if (state.success) dialog.current?.close();
  }, [state.success]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className={compact ? "btn btn-ghost btn-xs btn-square" : "btn btn-ghost btn-sm gap-1.5"}
        aria-label={`Mettre à jour ${item.description}`}
        title="Mettre à jour la tâche"
      >
        <Icon name="wrench" className="h-4 w-4" />
        {compact ? null : "Mettre à jour"}
      </button>

      <dialog ref={dialog} className="modal">
        <div className="modal-box max-w-lg rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-primary">{item.reference}</p>
              <h2 className="mt-1 truncate font-display text-lg font-bold">{item.description}</h2>
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="btn btn-ghost btn-sm btn-square"
              aria-label="Fermer"
              title="Fermer"
            >
              <Icon name="close" className="h-5 w-5" />
            </button>
          </div>

          <form action={formAction} className="mt-5 space-y-4">
            <input type="hidden" name="rowVersion" value={item.row_version} />
            <input type="hidden" name="returnTo" value={returnTo} />

            <label className="form-control">
              <span className="label-text mb-1.5 font-medium">État</span>
              <select name="status" defaultValue={item.status} className="select select-bordered w-full">
                {statuses.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text mb-1.5 font-medium">Collaborateur</span>
              <select
                name="assigneeId"
                defaultValue={item.assignee_user_id ?? ""}
                className="select select-bordered w-full"
              >
                <option value="">Non affecté</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>{member.full_name}</option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text mb-1.5 font-medium">Échéance de l&apos;article</span>
              <input
                type="date"
                name="dueDate"
                defaultValue={item.explicit_due_date ?? ""}
                className="input input-bordered w-full"
              />
            </label>

            <label className="form-control">
              <span className="label-text mb-1.5 font-medium">Motif du changement</span>
              <textarea
                name="reason"
                rows={3}
                maxLength={500}
                className="textarea textarea-bordered w-full resize-y"
                placeholder="Requis pour une nouvelle échéance, une annulation ou un retour en arrière"
              />
            </label>

            {state.error ? <p className="alert alert-error py-2 text-sm">{state.error}</p> : null}

            <div className="modal-action">
              <button type="button" onClick={() => dialog.current?.close()} className="btn btn-ghost">
                Annuler
              </button>
              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? <span className="loading loading-spinner loading-sm" /> : null}
                Enregistrer
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>Fermer</button>
        </form>
      </dialog>
    </>
  );
}
