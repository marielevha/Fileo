import Link from "next/link";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { listPublished } from "@/lib/repos/contents";
import { getLocale } from "@/lib/i18n/request";
import { getMessages } from "@/lib/i18n/messages";
import { localePath } from "@/lib/i18n/config";

/** FAQ entries are editorial content, managed from the back-office (§12.4). */
export default async function FaqPreview({ limit = 5 }: { limit?: number }) {
  const locale = await getLocale();
  const copy = getMessages(locale).faq;
  const entries = await listPublished("faq", limit);

  if (entries.length === 0) return null;

  return (
    <section id="faq" className="bg-base-200 py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title={copy.title}
          subtitle={copy.subtitle}
        />

        <div className="space-y-3">
          {entries.map((entry, index) => (
            <Reveal key={entry.id} delay={index * 70}>
              <details className="group bg-base-100 border-base-300 rounded-2xl border p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold">
                  {copy.entries[index]?.[0] ?? entry.title}
                  <span
                    aria-hidden="true"
                    className="text-primary shrink-0 text-xl transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="text-base-content/70 mt-3 text-sm leading-relaxed text-pretty">
                  {copy.entries[index]?.[1] ?? entry.body}
                </p>
              </details>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-10 text-center">
          <Link href={localePath(locale, "/faq")} className="btn btn-outline">
            {copy.all}
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
