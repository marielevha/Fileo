import Reveal from "./Reveal";

type Props = {
  title: string;
  subtitle?: string;
  /** Left-aligns the block instead of centring it. */
  align?: "center" | "left";
};

/**
 * Section title: the whole heading carries the brand gradient, matching the
 * way headings read on the reference design.
 */
export default function SectionHeading({ title, subtitle, align = "center" }: Props) {
  const centered = align === "center";

  return (
    <Reveal className={`mb-16 max-w-2xl ${centered ? "mx-auto text-center" : ""}`}>
      <h2 className="text-gradient-brand font-display text-3xl leading-tight font-extrabold text-balance sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>

      {subtitle ? (
        <p className="text-base-content/65 mt-4 text-lg text-pretty">{subtitle}</p>
      ) : null}

      <span
        aria-hidden="true"
        className={`from-primary to-secondary mt-6 block h-1 w-20 rounded-full bg-gradient-to-r ${
          centered ? "mx-auto" : ""
        }`}
      />
    </Reveal>
  );
}
