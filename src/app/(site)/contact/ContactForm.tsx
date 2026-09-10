"use client";

import { useActionState } from "react";
import Icon from "@/components/ui/Icon";
import { submitContact, type ContactState } from "@/lib/actions/contact";
import { TICKET_CATEGORIES } from "@/lib/tickets";

const initial: ContactState = {};

export default function ContactForm() {
  const [state, action, pending] = useActionState(submitContact, initial);

  if (state.ok) {
    return (
      <div className="bg-base-200 border-base-300 rounded-2xl border p-10 text-center">
        <span className="bg-success/15 text-success mx-auto grid h-14 w-14 place-items-center rounded-full">
          <Icon name="check" className="h-7 w-7" strokeWidth={2.5} />
        </span>
        <h2 className="font-display mt-5 text-xl font-bold">Message envoyé</h2>
        <p className="text-base-content/65 mt-2 text-sm text-pretty">
          Votre demande est enregistrée. Nous revenons vers vous sous 24 h les jours ouvrés.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="bg-base-200 border-base-300 space-y-4 rounded-2xl border p-7">
      {/* Honeypot — hidden from people, tempting for bots (§6.2). */}
      <div aria-hidden="true" className="absolute -left-[9999px]">
        <label htmlFor="website">Ne pas remplir</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label-text mb-1.5 block font-medium" htmlFor="name">
            Votre nom <span className="text-error">*</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="name"
            className="input input-bordered w-full"
          />
        </div>

        <div>
          <label className="label-text mb-1.5 block font-medium" htmlFor="contact">
            Email ou téléphone <span className="text-error">*</span>
          </label>
          <input
            id="contact"
            name="contact"
            type="text"
            required
            className="input input-bordered w-full"
          />
        </div>
      </div>

      <div>
        <label className="label-text mb-1.5 block font-medium" htmlFor="category">
          Catégorie
        </label>
        <select
          id="category"
          name="category"
          defaultValue="autre"
          className="select select-bordered w-full"
        >
          {TICKET_CATEGORIES.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label-text mb-1.5 block font-medium" htmlFor="subject">
          Objet <span className="text-error">*</span>
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          required
          className="input input-bordered w-full"
        />
      </div>

      <div>
        <label className="label-text mb-1.5 block font-medium" htmlFor="message">
          Votre message <span className="text-error">*</span>
        </label>
        <textarea
          id="message"
          name="message"
          rows={6}
          required
          className="textarea textarea-bordered w-full"
        />
      </div>

      {state.error ? (
        <p role="alert" className="alert alert-error text-sm">
          {state.error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn btn-primary w-full gap-2">
        {pending ? <span className="loading loading-spinner loading-sm" /> : null}
        Envoyer
      </button>

      <p className="text-base-content/50 text-center text-xs">
        Vos données servent uniquement à traiter votre demande.
      </p>
    </form>
  );
}
