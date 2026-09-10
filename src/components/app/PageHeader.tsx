import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export default function PageHeader({ title, description, action }: Props) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {description ? (
          <p className="text-base-content/60 mt-1.5 text-sm text-pretty">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
