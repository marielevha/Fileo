"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import type { TeamFilter } from "@/lib/repos/team";

const filters: Array<{ value: TeamFilter; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actifs" },
  { value: "owners", label: "Responsables" },
  { value: "money", label: "Droit financier" },
  { value: "disabled", label: "Désactivés" },
];

export default function TeamControls({
  search,
  filter,
}: {
  search: string;
  filter: TeamFilter;
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
    params.delete("page");
    const queryString = params.toString();
    startTransition(() => {
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    });
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
        <label className="min-w-64 flex-1">
          <span className="sr-only">Rechercher un membre</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="input input-bordered w-full"
            placeholder="Nom, téléphone ou email..."
          />
        </label>

        <button
          type="button"
          onClick={() => {
            setQuery("");
            navigate({ q: null, filtre: null });
          }}
          className="btn btn-ghost gap-2"
        >
          <Icon name="close" className="h-4 w-4" />
          Réinitialiser
        </button>

        <span
          className={`loading loading-spinner loading-sm text-primary ${pending ? "visible" : "invisible"}`}
          aria-label={pending ? "Mise à jour de l'équipe" : undefined}
          aria-hidden={!pending}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 px-4 sm:px-5">
        {filters.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => navigate({ filtre: filter === option.value || option.value === "all" ? null : option.value })}
            className={`btn btn-xs ${filter === option.value ? "btn-primary" : "btn-ghost"}`}
            aria-pressed={filter === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
