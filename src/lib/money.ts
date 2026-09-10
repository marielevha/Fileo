/**
 * Money handling — cahier des charges §15.3.
 *
 * Amounts are ALWAYS integer minor units paired with a currency code. Never
 * floats: `0.1 + 0.2 !== 0.3` has no place in a ledger.
 *
 * The exponent is per-currency, not a universal ×100. XAF and CDF are
 * zero-decimal currencies — 2 500 XAF is the integer 2500, not 250000.
 */

export const CURRENCIES = {
  XAF: { code: "XAF", exponent: 0, label: "Franc CFA (BEAC)", symbol: "FCFA" },
  CDF: { code: "CDF", exponent: 0, label: "Franc congolais", symbol: "FC" },
  USD: { code: "USD", exponent: 2, label: "Dollar américain", symbol: "$" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && value in CURRENCIES;
}

/** An amount is meaningless without its currency, so they travel together. */
export type Money = {
  /** Integer minor units. 2500 XAF = 2500; 12.50 USD = 1250. */
  amount: number;
  currency: CurrencyCode;
};

export function money(amount: number, currency: CurrencyCode): Money {
  if (!Number.isSafeInteger(amount)) {
    throw new TypeError(`Montant non entier: ${amount} (${currency})`);
  }
  return { amount, currency };
}

export function zero(currency: CurrencyCode): Money {
  return { amount: 0, currency };
}

/**
 * Guards against the bug the spec calls out in §2.3: no total may ever mix
 * currencies, and no automatic conversion exists.
 */
function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new TypeError(
      `Devises incompatibles: ${a.currency} et ${b.currency}. Aucune conversion automatique n'est prévue.`,
    );
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
}

export function sum(items: Money[], currency: CurrencyCode): Money {
  return items.reduce<Money>((total, item) => add(total, item), zero(currency));
}

/** Line total = unit price × quantity. Quantity must be a positive integer. */
export function multiply(unit: Money, quantity: number): Money {
  if (!Number.isSafeInteger(quantity) || quantity < 0) {
    throw new TypeError(`Quantité invalide: ${quantity}`);
  }
  return money(unit.amount * quantity, unit.currency);
}

export function clampAtZero(value: Money): Money {
  return value.amount > 0 ? value : zero(value.currency);
}

export function negate(value: Money): Money {
  return money(-value.amount, value.currency);
}

export function isZero(value: Money): boolean {
  return value.amount === 0;
}

export function isPositive(value: Money): boolean {
  return value.amount > 0;
}

export function compare(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.amount - b.amount;
}

/* ---------------------------------------------------------------
   Order balance — the formulas are transcribed from §8.7 verbatim.
   --------------------------------------------------------------- */

export type OrderBalanceInput = {
  currency: CurrencyCode;
  /** Line totals of items that are NOT cancelled. */
  lineTotals: Money[];
  /** Order-level discount. Never allowed to push the total below zero. */
  discount: Money;
  /** Confirmed payments only — pending sync entries are excluded. */
  confirmedPayments: Money[];
  /** Confirmed refunds only. */
  confirmedRefunds: Money[];
};

export type OrderBalance = {
  /** Total commande = somme des lignes non annulées − réduction applicable */
  orderTotal: Money;
  /** The discount actually applied, capped so the total cannot go negative. */
  appliedDiscount: Money;
  /** Encaissement net = paiements confirmés − remboursements confirmés */
  netCollected: Money;
  /** Solde signé = total commande − encaissement net */
  signedBalance: Money;
  /** Reste à payer = maximum(solde signé, 0) */
  remainingDue: Money;
  /** Trop-perçu à traiter = maximum(−solde signé, 0) */
  overpayment: Money;
};

export function computeOrderBalance(input: OrderBalanceInput): OrderBalance {
  const { currency } = input;

  const grossTotal = sum([...input.lineTotals], currency);

  // §8.4: "elle ne peut rendre le total négatif" — cap rather than reject, and
  // report what was actually applied so the UI can flag the difference.
  const appliedDiscount =
    input.discount.amount > grossTotal.amount ? grossTotal : input.discount;

  const orderTotal = subtract(grossTotal, appliedDiscount);

  const netCollected = subtract(
    sum([...input.confirmedPayments], currency),
    sum([...input.confirmedRefunds], currency),
  );

  const signedBalance = subtract(orderTotal, netCollected);

  return {
    orderTotal,
    appliedDiscount,
    netCollected,
    signedBalance,
    remainingDue: clampAtZero(signedBalance),
    overpayment: clampAtZero(negate(signedBalance)),
  };
}

/* ---------------------------------------------------------------
   Parsing and formatting
   --------------------------------------------------------------- */

/**
 * Parses operator input ("2500", "12,50") into minor units for the currency.
 * Rejects anything that would silently lose precision — a USD amount of
 * "12.505" is an error, not something to round away behind the operator's back.
 */
export function parseAmount(input: string, currency: CurrencyCode): Money {
  const normalised = input.trim().replace(/\s/g, "").replace(",", ".");

  if (normalised === "" || !/^-?\d*\.?\d*$/.test(normalised)) {
    throw new TypeError(`Montant illisible: « ${input} »`);
  }

  const { exponent } = CURRENCIES[currency];
  const [whole, fraction = ""] = normalised.split(".");

  if (fraction.length > exponent) {
    throw new TypeError(
      exponent === 0
        ? `${currency} ne comporte pas de décimales: « ${input} »`
        : `${currency} accepte au plus ${exponent} décimales: « ${input} »`,
    );
  }

  const padded = fraction.padEnd(exponent, "0");
  const negative = whole.startsWith("-");
  const digits = `${whole.replace("-", "") || "0"}${padded}`;
  const value = Number(digits);

  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`Montant hors limites: « ${input} »`);
  }

  return money(negative ? -value : value, currency);
}

/** Minor units back to a decimal string, without locale grouping. */
export function toDecimalString(value: Money): string {
  const { exponent } = CURRENCIES[value.currency];
  if (exponent === 0) return String(value.amount);

  const negative = value.amount < 0;
  const digits = String(Math.abs(value.amount)).padStart(exponent + 1, "0");
  const whole = digits.slice(0, -exponent);
  const fraction = digits.slice(-exponent);

  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** Display form, always accompanied by its currency (§8.1). */
export function formatMoney(value: Money, locale = "fr-FR"): string {
  const { exponent } = CURRENCIES[value.currency];

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(value.amount / 10 ** exponent);
}
