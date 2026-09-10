type Props = {
  className?: string;
  /** Hide the wordmark and keep only the glyph (used in tight spots). */
  markOnly?: boolean;
};

/**
 * Brand mark: a threaded needle.
 *
 * The eye, the shaft and the thread looping through it are the gesture every
 * workshop starts from — and the thread ("fil") is the name itself.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Thread, drawn first so the needle sits on top of it */}
      <path
        d="M20.6 5.9C15.8 4.8 11.7 7.2 12 10.8c.3 3.4 4.7 3.6 5.7 6.4.7 2-.7 3.9-2.5 4.5"
        strokeWidth={1.7}
        opacity={0.8}
      />

      {/* Eye */}
      <ellipse
        cx="22.6"
        cy="8"
        rx="2.1"
        ry="2.9"
        transform="rotate(37 22.6 8)"
        strokeWidth={1.7}
      />

      {/* Shaft */}
      <path d="M21 10.7 10.4 25" strokeWidth={2.1} />

      {/* Point */}
      <path d="M10.4 25 7.5 28.7 10 26.2Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function Logo({ className = "", markOnly = false }: Props) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="relative grid h-10 w-10 shrink-0 place-items-center">
        <span className="from-primary to-secondary absolute inset-0 rounded-xl bg-gradient-to-br opacity-90" />
        <span className="from-primary to-secondary absolute inset-0 rounded-xl bg-gradient-to-br opacity-40 blur-md" />
        <LogoMark className="text-primary-content relative h-6 w-6" />
      </span>

      {markOnly ? null : (
        <span className="font-display text-xl leading-none font-bold tracking-tight">
          Fil<span className="text-gradient-brand">éo</span>
        </span>
      )}
    </span>
  );
}
