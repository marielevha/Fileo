/**
 * Phone handling for the two target markets (§2.3).
 *
 * Deliberately narrow: a full E.164 library is overkill while only Congo-
 * Brazzaville and the DRC are served, and a wrong-but-confident parse is worse
 * than asking the operator to pick a country.
 */

export const COUNTRIES = {
  CG: {
    code: "CG",
    label: "République du Congo",
    dialCode: "242",
    /** National subscriber number length, excluding the dial code. */
    nsnLength: 9,
    defaultCurrency: "XAF",
    defaultTimezone: "Africa/Brazzaville",
  },
  CD: {
    code: "CD",
    label: "République démocratique du Congo",
    dialCode: "243",
    nsnLength: 9,
    defaultCurrency: "CDF",
    defaultTimezone: "Africa/Kinshasa",
  },
} as const;

export type CountryCode = keyof typeof COUNTRIES;

export const COUNTRY_CODES = Object.keys(COUNTRIES) as CountryCode[];

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === "string" && value in COUNTRIES;
}

export type PhoneParseResult =
  | { ok: true; e164: string; search: string }
  | { ok: false; error: string };

/** Digits only — the form used for duplicate detection and search (§8.2). */
export function normaliseDigits(input: string): string {
  return input.replace(/\D/g, "");
}

export function parsePhone(input: string, country: CountryCode): PhoneParseResult {
  const { dialCode, nsnLength } = COUNTRIES[country];
  let digits = normaliseDigits(input);

  if (digits === "") return { ok: false, error: "Numéro de téléphone requis." };

  // Accept "00242…", "242…" and a bare national number.
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith(dialCode)) digits = digits.slice(dialCode.length);

  // A leading trunk zero is common when people write their local number.
  if (digits.length === nsnLength + 1 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  if (digits.length !== nsnLength) {
    return {
      ok: false,
      error: `Un numéro ${COUNTRIES[country].label} comporte ${nsnLength} chiffres après l'indicatif +${dialCode}.`,
    };
  }

  const e164 = `+${dialCode}${digits}`;
  return { ok: true, e164, search: `${dialCode}${digits}` };
}

/** Readable grouping for display; falls back to the raw value if unexpected. */
export function formatPhone(e164: string): string {
  const match = /^\+(\d{3})(\d{9})$/.exec(e164);
  if (!match) return e164;

  const [, dial, nsn] = match;
  return `+${dial} ${nsn.slice(0, 2)} ${nsn.slice(2, 5)} ${nsn.slice(5, 7)} ${nsn.slice(7)}`;
}

/**
 * Builds a `wa.me` link with a prefilled message (§8.10).
 *
 * Filéo only opens the channel — it can never claim the message was sent,
 * received or read.
 */
export function whatsappLink(e164: string, message: string): string {
  const digits = normaliseDigits(e164);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
