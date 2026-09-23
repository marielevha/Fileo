"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveFaq, type FaqFormState } from "@/lib/actions/faq";
import type { Locale } from "@/lib/i18n/config";
import type { FaqTranslation } from "@/lib/repos/faq";

const initialState: FaqFormState = {};

export default function FaqEditor({ baseHref, isNew, locale, row, slug, sortOrder }: {
  baseHref: string;
  isNew: boolean;
  locale: Locale;
  row: FaqTranslation | null;
  slug: string;
  sortOrder: number;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(saveFaq, initialState);

  useEffect(() => {
    if (!state.success || !state.slug || !state.locale) return;
    router.replace(`${baseHref}?slug=${encodeURIComponent(state.slug)}&lang=${state.locale}`);
    router.refresh();
  }, [baseHref, router, state]);

  return (
    <form action={action} className="space-y-5 p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="form-control">
          <span className="label-text mb-1.5 text-sm font-medium">Identifiant commun aux traductions</span>
          <input
            className="input input-bordered w-full"
            name="slug"
            defaultValue={slug}
            readOnly={!isNew}
            required
            maxLength={100}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="ex: travailler-hors-ligne"
          />
        </label>
        <label className="form-control">
          <span className="label-text mb-1.5 text-sm font-medium">Langue</span>
          {isNew ? <select name="locale" defaultValue="fr" className="select select-bordered w-full">
            <option value="fr">Français</option><option value="en">English</option><option value="lg">Lingala</option>
          </select> : <input className="input input-bordered w-full" value={locale.toUpperCase()} readOnly />}
          {!isNew ? <input type="hidden" name="locale" value={locale} /> : null}
        </label>
      </div>
      <label className="form-control block">
        <span className="label-text mb-1.5 block text-sm font-medium">Question</span>
        <input className="input input-bordered w-full" name="title" defaultValue={row?.title ?? ""} required minLength={5} maxLength={200} />
      </label>
      <label className="form-control block">
        <span className="label-text mb-1.5 block text-sm font-medium">Réponse</span>
        <textarea className="textarea textarea-bordered min-h-40 w-full" name="body" defaultValue={row?.body ?? ""} required minLength={5} maxLength={5000} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="form-control">
          <span className="label-text mb-1.5 text-sm font-medium">Ordre d&apos;affichage</span>
          <input className="input input-bordered w-full" type="number" name="sortOrder" min={0} max={9999} defaultValue={sortOrder} required />
        </label>
        <label className="form-control">
          <span className="label-text mb-1.5 text-sm font-medium">Statut de cette langue</span>
          <select name="status" defaultValue={row?.status ?? "draft"} className="select select-bordered w-full">
            <option value="draft">Brouillon</option>
            <option value="published">Publié</option>
            <option value="archived">Archivé</option>
          </select>
        </label>
      </div>
      <input type="hidden" name="rowVersion" value={row?.row_version ?? ""} />
      {state.error ? <p role="alert" className="alert alert-error text-sm">{state.error}</p> : null}
      {state.success ? <p role="status" className="alert alert-success text-sm">Question enregistrée.</p> : null}
      <button type="submit" disabled={pending} className="btn btn-primary">{pending ? "Enregistrement..." : "Enregistrer"}</button>
    </form>
  );
}
