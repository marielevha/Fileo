import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "./Icon";

type Props = {
  title: string;
  updatedAt: string;
  children: ReactNode;
};

/** Shared shell for the three legal pages: title block + prose container. */
export default function LegalLayout({ title, updatedAt, children }: Props) {
  return (
    <div className="bg-base-100 pt-28 pb-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Link href="/" className="link link-hover text-base-content/60 inline-flex items-center gap-1.5 text-sm">
          <Icon name="arrowRight" className="h-4 w-4 rotate-180" />
          Retour à l&apos;accueil
        </Link>

        <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl">{title}</h1>
        <p className="text-base-content/50 mt-2 text-sm">Dernière mise à jour : {updatedAt}</p>

        <div className="prose prose-sm sm:prose-base mt-10 max-w-none">{children}</div>
      </div>
    </div>
  );
}
