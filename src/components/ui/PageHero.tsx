import Reveal from "./Reveal";

type Props = {
  title: string;
  subtitle?: string;
};

/** Header band for the standalone public pages (§6.1). */
export default function PageHero({ title, subtitle }: Props) {
  return (
    <section className="from-base-200 to-base-100 relative overflow-hidden bg-gradient-to-br pt-36 pb-16">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="blob bg-primary/20 animate-float -top-32 -left-24 h-80 w-80" />
        <div
          className="blob bg-secondary/15 animate-float -right-24 bottom-0 h-80 w-80"
          style={{ animationDelay: "-6s" }}
        />
      </div>

      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <Reveal>
          <h1 className="text-gradient-brand font-display text-4xl font-extrabold text-balance sm:text-5xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-base-content/65 mx-auto mt-4 max-w-2xl text-lg text-pretty">
              {subtitle}
            </p>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}
