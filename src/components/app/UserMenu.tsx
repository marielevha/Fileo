import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { signOut } from "@/lib/actions/auth";

/** Account dropdown. Sign-out is a form so it stays a POST, never a GET link. */
export default function UserMenu({ name, role }: { name: string; role: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <details className="dropdown dropdown-end">
      <summary className="btn btn-ghost btn-circle avatar" aria-label="Mon compte">
        <span className="from-primary to-secondary text-primary-content font-display grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br text-xs font-bold">
          {initials}
        </span>
      </summary>

      <div className="dropdown-content bg-base-100 border-base-300 z-50 mt-2 w-60 rounded-xl border p-2 shadow-xl">
        <div className="border-base-300 border-b px-3 py-2">
          <p className="truncate text-sm font-semibold">{name}</p>
          <p className="text-base-content/55 text-xs">
            {role === "owner" ? "Responsable d'atelier" : "Collaborateur"}
          </p>
        </div>

        <ul className="py-1">
          <li>
            <Link
              href="/atelier/parametres"
              className="hover:bg-base-200 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <Icon name="wrench" className="h-4 w-4" />
              Paramètres
            </Link>
          </li>
          <li>
            <Link
              href="/prise-en-main"
              className="hover:bg-base-200 flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors"
            >
              <Icon name="sparkles" className="h-4 w-4" />
              Aide et tutoriels
            </Link>
          </li>
        </ul>

        <form action={signOut} className="border-base-300 border-t pt-1">
          <button
            type="submit"
            className="hover:bg-error/10 hover:text-error flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors"
          >
            <Icon name="close" className="h-4 w-4" />
            Se déconnecter
          </button>
        </form>
      </div>
    </details>
  );
}
