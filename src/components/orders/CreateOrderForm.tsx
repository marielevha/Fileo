"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";
import { createOrderAction, type OrderFormState } from "@/lib/actions/orders";

type ClientOption = {
  id: string;
  displayName: string;
  phone: string | null;
};

type ItemRow = {
  id: string;
  category: string;
  description: string;
  workType: "creation" | "retouche";
  wearerName: string;
  unitPrice: string;
  dueDate: string;
  measurements: string;
};

const initialState: OrderFormState = {};

function newRow(): ItemRow {
  return {
    id: crypto.randomUUID(),
    category: "",
    description: "",
    workType: "creation",
    wearerName: "",
    unitPrice: "0",
    dueDate: "",
    measurements: "",
  };
}

export default function CreateOrderForm({
  clients,
  canViewMoney,
  currencySymbol,
  today,
  paymentIdempotencyKey,
  cancelHref,
}: {
  clients: ClientOption[];
  canViewMoney: boolean;
  currencySymbol: string;
  today: string;
  paymentIdempotencyKey: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(createOrderAction, initialState);
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [draft, setDraft] = useState<ItemRow>(newRow());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [manualTotal, setManualTotal] = useState("");
  const [initialPaymentAmount, setInitialPaymentAmount] = useState("");
  const [inlineClient, setInlineClient] = useState<{ name: string; phone: string } | null>(null);
  const [clientModalOpen, setClientModalOpen] = useState(clients.length === 0);
  const [clientDraftName, setClientDraftName] = useState("");
  const [clientDraftPhone, setClientDraftPhone] = useState("");
  const [clientDraftError, setClientDraftError] = useState<string | null>(null);
  const clientMode = inlineClient ? "new" : "existing";
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === clientId),
    [clientId, clients],
  );
  const itemsTotal = useMemo(
    () => rows.reduce((total, row) => total + parseAmountInput(row.unitPrice), 0),
    [rows],
  );
  const orderTotal = itemsTotal > 0 ? itemsTotal : parseAmountInput(manualTotal);
  const remainingDue = Math.max(orderTotal - parseAmountInput(initialPaymentAmount), 0);

  function updateDraft(values: Partial<ItemRow>) {
    setDraft((current) => ({ ...current, ...values }));
    if (draftError) setDraftError(null);
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setDraft(newRow());
      setEditorOpen(false);
    }
  }

  function editRow(row: ItemRow) {
    setDraft(row);
    setEditingId(row.id);
    setDraftError(null);
    setEditorOpen(true);
  }

  function addDraftItem() {
    const category = draft.category.trim();
    const description = draft.description.trim();
    if (category.length < 2) {
      setDraftError("Renseignez l'article avant de l'ajouter au tableau.");
      return;
    }
    if (description.length < 2) {
      setDraftError("Renseignez la description avant de l'ajouter au tableau.");
      return;
    }

    const row = {
      ...draft,
      category,
      description,
      wearerName: draft.wearerName.trim(),
      measurements: draft.measurements.trim(),
      unitPrice: draft.unitPrice.trim() || "0",
    };

    setRows((current) => (
      editingId
        ? current.map((item) => (item.id === editingId ? row : item))
        : [...current, { ...row, id: crypto.randomUUID() }]
    ));
    setEditingId(null);
    setDraft(newRow());
    setEditorOpen(false);
  }

  function confirmInlineClient() {
    const name = clientDraftName.trim();
    if (name.length < 2) {
      setClientDraftError("Renseignez au moins le nom du client.");
      return;
    }
    setInlineClient({ name, phone: clientDraftPhone.trim() });
    setClientDraftError(null);
    setClientModalOpen(false);
  }

  return (
    <form action={formAction} className="space-y-7">
      <input type="hidden" name="paymentIdempotencyKey" value={paymentIdempotencyKey} />
      <input type="hidden" name="orderTotalAmount" value={orderTotal > 0 ? String(orderTotal) : ""} />

      <input type="hidden" name="clientMode" value={clientMode} />
      <input type="hidden" name="newClientDisplayName" value={inlineClient?.name ?? ""} />
      <input type="hidden" name="newClientPhone" value={inlineClient?.phone ?? ""} />

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_13rem_13rem]">
        <div className="form-control">
          <span className="label-text mb-2 font-medium">Client</span>
          <div className="join w-full">
            {inlineClient ? (
              <div className="join-item flex min-h-0 min-w-0 flex-1 items-center border border-base-300 bg-base-200 px-4">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="badge badge-primary badge-sm shrink-0">New</span>
                  <span className="truncate font-medium">{inlineClient.name}</span>
                  {inlineClient.phone ? (
                    <span className="shrink-0 text-sm text-base-content/55">{inlineClient.phone}</span>
                  ) : null}
                </span>
              </div>
            ) : (
              <select
                name="clientId"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                className="select select-bordered join-item min-w-0 flex-1"
                required={!inlineClient}
              >
                {clients.length === 0 ? <option value="">Aucun client</option> : null}
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.displayName}
                    {client.phone ? ` - ${client.phone}` : ""}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={() => {
                setClientDraftName(inlineClient?.name ?? "");
                setClientDraftPhone(inlineClient?.phone ?? "");
                setClientDraftError(null);
                setClientModalOpen(true);
              }}
              className="btn btn-primary join-item btn-square"
              aria-label="Ajouter un client"
            >
              +
            </button>
          </div>
          {inlineClient ? (
            <button
              type="button"
              onClick={() => setInlineClient(null)}
              className="link link-hover mt-1 self-start text-xs text-base-content/60"
              disabled={clients.length === 0}
            >
              Revenir a la liste des clients
            </button>
          ) : selectedClient?.phone ? (
            <span className="mt-1 text-xs text-base-content/50">{selectedClient.phone}</span>
          ) : null}
        </div>
        <label className="form-control">
          <span className="label-text mb-2 font-medium">Date promise</span>
          <input type="date" name="promisedDate" className="input input-bordered w-full" />
        </label>

        <label className="form-control">
          <span className="label-text mb-2 font-medium">Essayage</span>
          <input type="date" name="fittingDate" className="input input-bordered w-full" />
        </label>
      </section>

      {clientModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-base-300 bg-base-100 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold">Nouveau client</h2>
                <p className="mt-1 text-sm text-base-content/55">
                  Creez une fiche minimale sans quitter la commande.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClientModalOpen(false)}
                className="btn btn-ghost btn-square btn-sm"
                aria-label="Fermer"
              >
                <Icon name="close" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
              <label className="form-control">
                <span className="label-text mb-2 font-medium">Nom du client</span>
                <input
                  value={clientDraftName}
                  onChange={(event) => {
                    setClientDraftName(event.target.value);
                    setClientDraftError(null);
                  }}
                  minLength={2}
                  maxLength={120}
                  placeholder="Nom complet"
                  className="input input-bordered w-full"
                  autoFocus
                />
              </label>
              <label className="form-control">
                <span className="label-text mb-2 font-medium">Telephone</span>
                <input
                  value={clientDraftPhone}
                  onChange={(event) => setClientDraftPhone(event.target.value)}
                  type="tel"
                  maxLength={40}
                  placeholder="Optionnel"
                  className="input input-bordered w-full"
                />
              </label>
            </div>

            {clientDraftError ? <p className="alert alert-error mt-4 py-3 text-sm">{clientDraftError}</p> : null}

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setClientModalOpen(false)} className="btn btn-ghost">
                Annuler
              </button>
              <button type="button" onClick={confirmInlineClient} className="btn btn-primary">
                Utiliser ce client
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="rounded-2xl border border-base-300 bg-base-100">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 px-5 py-4">
          <div>
            <h2 className="font-display font-bold">Articles</h2>
            <p className="text-sm text-base-content/55">
              Preparez un article, ajoutez-le au tableau, puis creez la commande.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="badge badge-ghost">{rows.length} article{rows.length > 1 ? "s" : ""}</span>
            <button
              type="button"
              onClick={() => {
                setDraft(newRow());
                setEditingId(null);
                setDraftError(null);
                setEditorOpen((open) => !open);
              }}
              className="btn btn-primary btn-sm"
            >
              {editorOpen && !editingId ? "Masquer" : "Ajouter un article"}
            </button>
          </div>
        </div>

        <div className="space-y-6 p-5">
          {editorOpen ? (
          <div className="rounded-xl border border-base-300 bg-base-200/25 p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_10rem]">
              <label className="form-control">
                <span className="label-text mb-2 font-medium">Article</span>
                <input
                  value={draft.category}
                  onChange={(event) => updateDraft({ category: event.target.value })}
                  placeholder="Robe, pantalon..."
                  className="input input-bordered w-full"
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2 font-medium">Type</span>
                <select
                  value={draft.workType}
                  onChange={(event) => updateDraft({ workType: event.target.value as ItemRow["workType"] })}
                  className="select select-bordered w-full"
                >
                  <option value="creation">Creation</option>
                  <option value="retouche">Retouche</option>
                </select>
              </label>
            </div>

            <div className={`mt-4 grid gap-4 ${canViewMoney ? "lg:grid-cols-[12rem_12rem_minmax(0,1fr)]" : "lg:grid-cols-[12rem_minmax(0,1fr)]"}`}>
              {canViewMoney ? (
                <div className="form-control">
                  <span className="label-text mb-2 font-medium">Prix unit.</span>
                  <label className="join w-full">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draft.unitPrice}
                      onChange={(event) => updateDraft({ unitPrice: event.target.value })}
                      className="input input-bordered join-item min-w-20 flex-1"
                    />
                    <span className="join-item flex items-center border border-l-0 border-base-300 bg-base-200 px-2 text-xs font-semibold">
                      {currencySymbol}
                    </span>
                  </label>
                </div>
              ) : null}

              <label className="form-control">
                <span className="label-text mb-2 font-medium">Echeance</span>
                <input
                  type="date"
                  value={draft.dueDate}
                  onChange={(event) => updateDraft({ dueDate: event.target.value })}
                  className="input input-bordered w-full"
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2 font-medium">Pour qui ?</span>
                <input
                  value={draft.wearerName}
                  onChange={(event) => updateDraft({ wearerName: event.target.value })}
                  placeholder="Optionnel"
                  className="input input-bordered w-full"
                />
              </label>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="form-control">
                <span className="label-text mb-2 font-medium">Description</span>
                <textarea
                  value={draft.description}
                  onChange={(event) => updateDraft({ description: event.target.value })}
                  rows={4}
                  maxLength={500}
                  placeholder="Modele, details de coupe, retouche a effectuer, preferences..."
                  className="textarea textarea-bordered w-full text-sm"
                />
              </label>

              <label className="form-control">
                <span className="label-text mb-2 font-medium">Mensurations</span>
                <textarea
                  value={draft.measurements}
                  onChange={(event) => updateDraft({ measurements: event.target.value })}
                  rows={4}
                  placeholder={"Tour poitrine: 92\nTour taille: 74\nLongueur: 110"}
                  className="textarea textarea-bordered w-full text-sm"
                />
              </label>
            </div>

            {draftError ? <p className="alert alert-error mt-4 py-3 text-sm">{draftError}</p> : null}

            <div className="mt-4 flex flex-wrap justify-end gap-3">
              {editingId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setDraft(newRow());
                    setDraftError(null);
                    setEditorOpen(false);
                  }}
                  className="btn btn-ghost"
                >
                  Annuler la modification
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setDraft(newRow());
                    setDraftError(null);
                    setEditorOpen(false);
                  }}
                  className="btn btn-ghost"
                >
                  Annuler
                </button>
              )}
              <button type="button" onClick={addDraftItem} className="btn btn-primary">
                {editingId ? "Mettre a jour l'article" : "Ajouter au tableau"}
              </button>
            </div>
          </div>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-base-300">
            <table className="table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Type</th>
                  <th>Pour qui</th>
                  <th>Echeance</th>
                  {canViewMoney ? <th>Prix</th> : null}
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={canViewMoney ? 6 : 5} className="py-8 text-center text-sm text-base-content/55">
                      Aucun article ajoute pour le moment.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td className="min-w-56">
                        <input type="hidden" name="itemQuantity" value="1" />
                        <input type="hidden" name="itemWearerRelation" value="" />
                        <input type="hidden" name="itemWorkType" value={row.workType} />
                        <input type="hidden" name="itemCategory" value={row.category} />
                        <input type="hidden" name="itemDescription" value={row.description} />
                        <input type="hidden" name="itemWearerName" value={row.wearerName} />
                        <input type="hidden" name="itemUnitPrice" value={row.unitPrice} />
                        <input type="hidden" name="itemDueDate" value={row.dueDate} />
                        <input type="hidden" name="itemMeasurements" value={row.measurements} />
                        <span className="font-medium">{row.category}</span>
                        <span className="mt-1 block max-w-md truncate text-xs text-base-content/50">
                          {row.description}
                        </span>
                      </td>
                      <td>{row.workType === "retouche" ? "Retouche" : "Creation"}</td>
                      <td>{row.wearerName || "Non precise"}</td>
                      <td>{row.dueDate || "Non definie"}</td>
                      {canViewMoney ? <td>{row.unitPrice || "0"} {currencySymbol}</td> : null}
                      <td className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => editRow(row)}
                            className="btn btn-ghost btn-sm"
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            className="btn btn-ghost btn-square btn-sm"
                            aria-label="Retirer l'article"
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {canViewMoney ? (
        <section className="rounded-2xl border border-base-300 bg-base-100">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-base-300 px-5 py-4">
            <div className="min-w-0">
              <h2 className="font-display font-bold">Montant et acompte</h2>
              <p className="mt-1 max-w-2xl text-sm text-base-content/55">
                Le total est calcule depuis les prix articles. Sans prix article, saisissez le total ici.
              </p>
            </div>
          </div>

          <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_17rem]">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="form-control">
                  <span className="label-text mb-2 font-medium">Total commande</span>
                  <span className="join w-full">
                    <input
                      name="manualOrderTotal"
                      type="text"
                      inputMode="decimal"
                      value={itemsTotal > 0 ? String(itemsTotal) : manualTotal}
                      onChange={(event) => setManualTotal(event.target.value)}
                      disabled={itemsTotal > 0}
                      placeholder="0"
                      className="input input-bordered join-item min-w-0 flex-1"
                    />
                    <span className="join-item flex w-20 items-center justify-center border border-l-0 border-base-300 bg-base-200 text-sm font-semibold">
                      {currencySymbol}
                    </span>
                  </span>
                </label>

                <label className="form-control">
                  <span className="label-text mb-2 font-medium">Acompte recu</span>
                  <span className="join w-full">
                    <input
                      name="initialPaymentAmount"
                      type="text"
                      inputMode="decimal"
                      value={initialPaymentAmount}
                      onChange={(event) => setInitialPaymentAmount(event.target.value)}
                      placeholder="0"
                      className="input input-bordered join-item min-w-0 flex-1"
                    />
                    <span className="join-item flex w-20 items-center justify-center border border-l-0 border-base-300 bg-base-200 text-sm font-semibold">
                      {currencySymbol}
                    </span>
                  </span>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[13rem_minmax(0,1fr)_13rem]">
                <label className="form-control">
                  <span className="label-text mb-2 font-medium">Moyen</span>
                  <select name="initialPaymentMethod" defaultValue="cash" className="select select-bordered w-full">
                    <option value="cash">Especes</option>
                    <option value="mobile_money">Mobile money</option>
                    <option value="transfer">Virement</option>
                    <option value="other">Autre</option>
                  </select>
                </label>

                <label className="form-control">
                  <span className="label-text mb-2 font-medium">Reference</span>
                  <input
                    name="initialPaymentReference"
                    maxLength={120}
                    placeholder="Recu, transaction..."
                    className="input input-bordered w-full"
                  />
                </label>

                <label className="form-control">
                  <span className="label-text mb-2 font-medium">Date acompte</span>
                  <input
                    type="date"
                    name="initialPaymentDate"
                    defaultValue={today}
                    max={today}
                    className="input input-bordered w-full"
                  />
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-primary/25 bg-primary/10 p-4 xl:text-right">
              <p className="text-sm font-medium text-base-content/60">Reste a payer</p>
              <p className="font-display mt-2 text-3xl font-bold text-primary">
                {remainingDue} {currencySymbol}
              </p>
              <p className="mt-2 text-xs text-base-content/50">
                Mis a jour selon le total et l&apos;acompte.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {state.error ? <p className="alert alert-error py-3 text-sm">{state.error}</p> : null}

      <div className="flex flex-wrap justify-end gap-3 border-t border-base-300 pt-6">
        <Link href={cancelHref} className="btn btn-ghost">
          Annuler
        </Link>
        <button type="submit" className="btn btn-primary gap-2" disabled={pending || clients.length === 0 || rows.length === 0}>
          {pending ? (
            <span className="loading loading-spinner loading-sm" />
          ) : (
            <Icon name="check" className="h-4 w-4" />
          )}
          Creer la commande
        </button>
      </div>

      {state.success && state.orderId ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4">
          <div className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-6 text-center shadow-2xl">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success/15 text-success">
              <Icon name="check" className="h-6 w-6" />
            </span>
            <h2 className="font-display mt-4 text-xl font-bold">Commande creee</h2>
            <p className="mt-2 text-sm text-base-content/60">
              La commande {state.reference ?? ""} a ete enregistree avec succes.
            </p>
            <div className="mt-6 flex justify-center">
              <Link href={`${cancelHref}/${state.orderId}`} className="btn btn-primary">
                Voir la commande
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function parseAmountInput(value: string): number {
  const normalised = value.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalised || !/^\d*\.?\d*$/.test(normalised)) return 0;
  return Math.max(0, Math.trunc(Number(normalised) || 0));
}
