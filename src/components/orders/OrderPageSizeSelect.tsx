"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function OrderPageSizeSelect({ pageSize }: { pageSize: number }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = useSearchParams();
  const [pending, startTransition] = useTransition();

  function changePageSize(value: string) {
    const params = new URLSearchParams(current.toString());
    if (value === "10") params.delete("taille");
    else params.set("taille", value);
    params.delete("page");
    const query = params.toString();

    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-base-content/60">Par page</span>
      <select
        value={pageSize}
        onChange={(event) => changePageSize(event.target.value)}
        className="select select-bordered select-sm w-24"
        aria-label="Nombre de commandes par page"
        disabled={pending}
      >
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="50">50</option>
      </select>
      {pending ? <span className="loading loading-spinner loading-xs" aria-label="Chargement" /> : null}
    </label>
  );
}
