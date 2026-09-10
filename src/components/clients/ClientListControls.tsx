"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ClientSort, SortDirection } from "@/lib/repos/clients";

export default function ClientListControls({
  search,
  sort,
  direction,
  includeArchived,
  pageSize,
}: {
  search: string;
  sort: ClientSort;
  direction: SortDirection;
  includeArchived: boolean;
  pageSize: number;
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
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  useEffect(() => {
    if (query === search) return;
    const timer = window.setTimeout(() => navigate({ q: query || null }), 300);
    return () => window.clearTimeout(timer);
    // Search params are intentionally read at the time the user types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, search]);

  return (
    <div className="mb-6 grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_13rem_9rem_7rem_auto]">
      <label className="relative">
        <span className="sr-only">Rechercher un client</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nom ou téléphone..."
          className="input input-bordered w-full"
        />
        {pending ? <span className="loading loading-spinner loading-xs absolute right-3 top-3.5" /> : null}
      </label>

      <label>
        <span className="sr-only">Trier par</span>
        <select value={sort} onChange={(e) => navigate({ sort: e.target.value })} className="select select-bordered w-full">
          <option value="name">Nom</option>
          <option value="phone">Téléphone</option>
          <option value="orders">Nombre de commandes</option>
          <option value="lastOrder">Dernière commande</option>
          <option value="createdAt">Date d&apos;ajout</option>
        </select>
      </label>

      <label>
        <span className="sr-only">Ordre du tri</span>
        <select value={direction} onChange={(e) => navigate({ dir: e.target.value })} className="select select-bordered w-full">
          <option value="asc">Croissant</option>
          <option value="desc">Décroissant</option>
        </select>
      </label>

      <label>
        <span className="sr-only">Fiches par page</span>
        <select value={pageSize} onChange={(e) => navigate({ taille: e.target.value })} className="select select-bordered w-full">
          <option value="10">10 / page</option>
          <option value="20">20 / page</option>
          <option value="50">50 / page</option>
        </select>
      </label>

      <label className="flex min-h-12 items-center gap-2 px-1 text-sm">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(e) => navigate({ archives: e.target.checked ? "1" : null })}
          className="checkbox checkbox-sm"
        />
        Archivés
      </label>
    </div>
  );
}
