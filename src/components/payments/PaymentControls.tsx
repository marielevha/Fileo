"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Icon from "@/components/ui/Icon";
import type { PaymentOrderFilter } from "@/lib/repos/payments";

const filters: Array<{ value: PaymentOrderFilter; label: string }> = [
  { value: "all", label: "Tous" },
  { value: "a_encaisser", label: "À encaisser" },
  { value: "acompte", label: "Acomptes" },
  { value: "retard", label: "En retard" },
  { value: "payes", label: "Payées" },
  { value: "trop_percu", label: "Trop-perçus" },
];

export default function PaymentControls({
  search,
  filter,
}: {
  search: string;
  filter: PaymentOrderFilter;
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
          <span className="sr-only">Rechercher un paiement</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="input input-bordered w-full"
            placeholder="Client ou commande..."
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
          aria-label={pending ? "Mise à jour des paiements" : undefined}
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
