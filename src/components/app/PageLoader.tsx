export default function PageLoader({
  label = "Chargement",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "py-10" : "min-h-[55vh] py-16"}>
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <span className="loading loading-spinner loading-lg text-primary" />
        <p className="mt-4 text-sm font-medium text-base-content/70">{label}</p>
        <div className="mt-8 grid w-full gap-3">
          <span className="h-4 w-2/3 animate-pulse rounded-full bg-base-300" />
          <span className="h-4 w-full animate-pulse rounded-full bg-base-300" />
          <span className="h-4 w-5/6 animate-pulse rounded-full bg-base-300" />
        </div>
      </div>
    </div>
  );
}
