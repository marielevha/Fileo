"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/ui/Icon";

type Member = { id: string; full_name: string };

const views = [
  { value: "liste", label: "Liste", icon: "menu" },
  { value: "jour", label: "Jour", icon: "clock" },
  { value: "semaine", label: "Semaine", icon: "layout" },
] as const;

const quickFilters = [
  { value: "aujourdhui", label: "Aujourd'hui" },
  { value: "semaine", label: "7 prochains jours" },
  { value: "retard", label: "En retard" },
  { value: "pretes", label: "Prêtes" },
] as const;

export default function PlanningControls({
  members,
  view,
  date,
  search,
  status,
  assignee,
  quickFilter,
}: {
  members: Member[];
  view: "liste" | "jour" | "semaine";
  date: string;
  search: string;
  status: string;
  assignee: string;
  quickFilter: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const current = useSearchParams();
  const [query, setQuery] = useState(search);
  const [pending, startTransition] = useTransition();

  function navigate(changes: Record<string, string | null>) {
    const params = new URLSearchParams(current.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const queryString = params.toString();
    startTransition(() => {
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    });
  }

  function shiftDate(days: number) {
    const next = new Date(`${date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + days);
    navigate({ date: next.toISOString().slice(0, 10), filtre: null });
  }

  useEffect(() => {
    if (query === search) return;
    const timer = window.setTimeout(() => navigate({ q: query || null }), 300);
    return () => window.clearTimeout(timer);
    // URL parameters are intentionally captured when the debounce completes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, search]);

  return (
    <section className="mb-6 rounded-2xl border border-base-300 bg-base-100 py-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5">
        <div className="join" aria-label="Vue du planning">
          {views.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => navigate({ vue: option.value === "liste" ? null : option.value, filtre: null })}
              className={`btn btn-sm join-item gap-1.5 ${view === option.value ? "btn-active" : "btn-ghost"}`}
              aria-pressed={view === option.value}
            >
              <Icon name={option.icon} className="h-4 w-4" />
              {option.label}
            </button>
          ))}
        </div>

        {view !== "liste" ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => shiftDate(view === "jour" ? -1 : -7)}
              className="btn btn-ghost btn-sm btn-square"
              title={view === "jour" ? "Jour précédent" : "Semaine précédente"}
              aria-label={view === "jour" ? "Jour précédent" : "Semaine précédente"}
            >
              <Icon name="arrowRight" className="h-4 w-4 rotate-180" />
            </button>
            <input
              type="date"
              value={date}
              onChange={(event) => navigate({ date: event.target.value, filtre: null })}
              className="input input-bordered input-sm w-36"
              aria-label="Date du planning"
            />
            <button
              type="button"
              onClick={() => navigate({ date: null, filtre: null })}
              className="btn btn-ghost btn-sm"
            >
              Aujourd&apos;hui
            </button>
            <button
              type="button"
              onClick={() => shiftDate(view === "jour" ? 1 : 7)}
              className="btn btn-ghost btn-sm btn-square"
              title={view === "jour" ? "Jour suivant" : "Semaine suivante"}
              aria-label={view === "jour" ? "Jour suivant" : "Semaine suivante"}
            >
              <Icon name="arrowRight" className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <span
          className={`loading loading-spinner loading-sm text-primary ${pending ? "visible" : "invisible"}`}
          aria-label={pending ? "Mise à jour du planning" : undefined}
          aria-hidden={!pending}
        />
      </div>

      <div className="mt-4 grid gap-3 px-4 sm:px-5 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_13rem_13rem_auto]">
        <label>
          <span className="sr-only">Rechercher dans le planning</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="input input-bordered w-full"
            placeholder="Client, commande ou article..."
          />
        </label>

        <label>
          <span className="sr-only">Filtrer par collaborateur</span>
          <select
            value={assignee}
            onChange={(event) => navigate({ collaborateur: event.target.value === "all" ? null : event.target.value, filtre: null })}
            className="select select-bordered w-full"
          >
            <option value="all">Toute l&apos;équipe</option>
            <option value="unassigned">Non affecté</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>{member.full_name}</option>
            ))}
          </select>
        </label>

        <label>
          <span className="sr-only">Filtrer par état</span>
          <select
            value={status}
            onChange={(event) => navigate({ statut: event.target.value === "active" ? null : event.target.value, filtre: null })}
            className="select select-bordered w-full"
          >
            <option value="active">Tâches actives</option>
            <option value="all">Tous les états</option>
            <option value="a_realiser">À réaliser</option>
            <option value="en_cours">En cours</option>
            <option value="a_essayer">À essayer</option>
            <option value="pret">Prêt</option>
            <option value="remis">Remis</option>
            <option value="annule">Annulé</option>
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            setQuery("");
            navigate({ q: null, collaborateur: null, statut: null, filtre: null });
          }}
          className="btn btn-ghost"
        >
          Réinitialiser
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 px-4 sm:px-5">
        {quickFilters.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => navigate({ filtre: quickFilter === filter.value ? null : filter.value, vue: null })}
            className={`btn btn-xs ${quickFilter === filter.value ? "btn-primary" : "btn-ghost"}`}
            aria-pressed={quickFilter === filter.value}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </section>
  );
}
