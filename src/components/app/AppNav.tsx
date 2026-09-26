"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** Dashboard roots match exactly; sections match their whole subtree. */
  exact?: boolean;
};

/**
 * Side navigation for the connected areas. Collapses to a horizontal scroller
 * on small screens rather than hiding behind a menu — these are the primary
 * destinations, used constantly.
 */
export default function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const isActive = (item: NavItem) =>
    hydrated && (item.exact ? pathname === item.href : pathname.startsWith(item.href));

  return (
    <nav aria-label="Sections" className="shrink-0 max-lg:hidden lg:w-56">
      <ul className="sticky top-24 space-y-1">
        {items.map((item) => {
          const active = isActive(item);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-base-content/70 hover:bg-base-100 hover:text-base-content"
                }`}
              >
                <Icon name={item.icon} className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
