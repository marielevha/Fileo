/**
 * The brand triad, applied in rotation across sibling cards, stats and
 * headings. Each class sets `--accent`, which every tinted part of a card
 * then reads — so a card declares its colour exactly once.
 */
const ACCENTS = ["accent-1", "accent-2", "accent-3"] as const;

export type AccentClass = (typeof ACCENTS)[number];

export function accentAt(index: number): AccentClass {
  return ACCENTS[index % ACCENTS.length];
}
