"use client";

import { useState } from "react";
import { COUNTRIES, COUNTRY_CODES, type CountryCode } from "@/lib/phone";

type Props = {
  /** Notifies the parent so it can preselect a matching default currency. */
  onCountryChange?: (country: CountryCode) => void;
  defaultCountry?: CountryCode;
};

/**
 * Country selector + national number.
 *
 * §2.3 requires the country and dial code to be explicit rather than guessed
 * from the digits the operator happens to type.
 */
export default function PhoneField({ onCountryChange, defaultCountry = "CG" }: Props) {
  const [country, setCountry] = useState<CountryCode>(defaultCountry);

  return (
    <div>
      <label className="label-text mb-1.5 block font-medium" htmlFor="phone">
        Téléphone <span className="text-error">*</span>
      </label>

      <div className="join w-full">
        <select
          name="country"
          aria-label="Pays"
          className="select select-bordered join-item w-40"
          value={country}
          onChange={(event) => {
            const next = event.target.value as CountryCode;
            setCountry(next);
            onCountryChange?.(next);
          }}
        >
          {COUNTRY_CODES.map((code) => (
            <option key={code} value={code}>
              +{COUNTRIES[code].dialCode} ({code})
            </option>
          ))}
        </select>

        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required
          placeholder="06 123 45 67"
          className="input input-bordered join-item w-full"
        />
      </div>

      <p className="text-base-content/50 mt-1.5 text-xs">
        {COUNTRIES[country].label} — {COUNTRIES[country].nsnLength} chiffres après l&apos;indicatif.
      </p>
    </div>
  );
}
