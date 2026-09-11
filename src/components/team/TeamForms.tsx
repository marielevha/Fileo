"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import {
  addMemberAction,
  removeMemberAction,
  toggleMemberStatusAction,
  updateMemberAction,
  type TeamActionState,
} from "@/lib/actions/team";
import type { TeamMemberRow } from "@/lib/repos/team";

const initial: TeamActionState = {};

export function AddMemberForm({
  limitReached,
  usageLabel,
}: {
  limitReached: boolean;
  usageLabel: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(addMemberAction, initial);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="rounded-2xl border border-base-300 bg-base-100 p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1">
          <span className="label-text mb-1.5 block font-medium">Téléphone du compte</span>
          <input
            name="phone"
            type="tel"
            className="input input-bordered w-full"
            placeholder="06 00 00 00 00"
            required
            disabled={limitReached}
          />
        </label>

        <label className="w-full sm:w-48">
          <span className="label-text mb-1.5 block font-medium">Rôle</span>
          <select name="role" defaultValue="collaborator" className="select select-bordered w-full" disabled={limitReached}>
            <option value="collaborator">Collaborateur</option>
            <option value="owner">Responsable</option>
          </select>
        </label>

        <label className="flex min-h-12 items-center gap-2 rounded-lg border border-base-300 px-3 text-sm">
          <input name="canViewMoney" type="checkbox" className="toggle toggle-sm" disabled={limitReached} />
          Droit financier
        </label>

        <button type="submit" className="btn btn-primary gap-2" disabled={pending || limitReached}>
          {pending ? <span className="loading loading-spinner loading-sm" /> : <Icon name="users" className="h-4 w-4" />}
          Ajouter
        </button>
      </div>

      <p className={limitReached ? "alert alert-warning mt-4 py-3 text-sm" : "mt-3 text-sm text-base-content/55"}>
        {usageLabel}
      </p>
      {state.error ? <p className="alert alert-error mt-4 py-3 text-sm">{state.error}</p> : null}
      {state.ok ? <p className="alert alert-success mt-4 py-3 text-sm">Membre ajouté à l'équipe.</p> : null}
    </form>
  );
}

export function TeamMemberEditor({ member, currentUserId }: { member: TeamMemberRow; currentUserId: string }) {
  const [state, action, pending] = useActionState(updateMemberAction, initial);
  const [removeState, removeAction, removePending] = useActionState(removeMemberAction, initial);
  const [toggleState, toggleAction, togglePending] = useActionState(toggleMemberStatusAction, initial);
  const isSelf = member.user_id === currentUserId;
  const isOwner = member.role === "owner";
  const updateFormId = `update-${member.membership_id}`;
  const actionError = state.error ?? toggleState.error ?? removeState.error;
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (actionError) setShowError(true);
  }, [actionError]);

  return (
    <>
      <td className="min-w-44 py-5">
        <select
          name="role"
          form={updateFormId}
          defaultValue={member.role}
          className="select select-bordered select-sm w-full max-w-40"
          disabled={isSelf}
          aria-label={`Rôle de ${member.full_name}`}
        >
          <option value="collaborator">Collaborateur</option>
          <option value="owner">Responsable</option>
        </select>
      </td>

      <td className="min-w-44 py-5">
        <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-base-300 px-3 text-xs whitespace-nowrap">
          <input
            name="canViewMoney"
            form={updateFormId}
            type="checkbox"
            defaultChecked={member.can_view_money}
            className="toggle toggle-xs"
            disabled={isOwner || isSelf}
          />
          Droit financier
        </label>
      </td>

      <td className="py-5 whitespace-nowrap">
        <span className={member.assigned_items > 0 ? "font-display text-lg font-bold text-primary" : "text-base-content/45"}>
          {member.assigned_items}
        </span>
        <span className="ml-1 text-sm text-base-content/55">tâche{member.assigned_items > 1 ? "s" : ""}</span>
      </td>

      <td className="py-5">
        <form action={toggleAction}>
          <input type="hidden" name="membershipId" value={member.membership_id} />
          <input
            name="active"
            type="checkbox"
            defaultChecked={member.status === "active"}
            className="toggle toggle-sm"
            disabled={togglePending || isSelf}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            aria-label={`${member.status === "active" ? "Désactiver" : "Activer"} ${member.full_name}`}
          />
        </form>
      </td>

      <td className="py-5 text-right">
        <div className="flex items-center justify-end gap-2">
          <form id={updateFormId} action={action}>
            <input type="hidden" name="membershipId" value={member.membership_id} />
            <input type="hidden" name="status" value={member.status} />
            <button
              type="submit"
              className="btn btn-ghost btn-sm btn-square"
              disabled={pending || isSelf}
              title={`Mettre à jour ${member.full_name}`}
              aria-label={`Mettre à jour ${member.full_name}`}
            >
              {pending ? <span className="loading loading-spinner loading-xs" /> : <Icon name="check" className="h-4 w-4" />}
            </button>
          </form>

          <form
            action={removeAction}
            onSubmit={(event) => {
              if (!window.confirm(`Retirer ${member.full_name} de l'équipe ?`)) event.preventDefault();
            }}
          >
            <input type="hidden" name="membershipId" value={member.membership_id} />
            <button
              type="submit"
              className="btn btn-error btn-sm btn-square"
              disabled={removePending || isSelf || member.status === "disabled"}
              title={`Retirer ${member.full_name}`}
              aria-label={`Retirer ${member.full_name}`}
            >
              {removePending ? <span className="loading loading-spinner loading-xs" /> : <Icon name="trash" className="h-3.5 w-3.5" />}
            </button>
          </form>
        </div>

        {state.ok ? <p className="mt-2 text-right text-xs font-medium text-success">Mis à jour.</p> : null}
        {toggleState.ok ? <p className="mt-2 text-right text-xs font-medium text-success">Statut mis à jour.</p> : null}
        {removeState.ok ? <p className="mt-2 text-right text-xs font-medium text-success">Membre retiré.</p> : null}
        {actionError && showError ? (
          <ActionErrorModal message={actionError} onClose={() => setShowError(false)} />
        ) : null}
      </td>
    </>
  );
}

function ActionErrorModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral/55 px-4">
      <div className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-6 text-left shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
            <Icon name="shield" className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold">Action impossible</h2>
            <p className="mt-2 text-sm leading-relaxed text-base-content/70">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            Compris
          </button>
        </div>
      </div>
    </div>
  );
}