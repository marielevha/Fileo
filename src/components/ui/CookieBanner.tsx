"use client";

import { useEffect, useState } from "react";
import { getMessages } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/config";

const STORAGE_KEY = "cc-cookie-consent";

type Consent = {
  essential: true;
  analytics: boolean;
  performance: boolean;
  marketing: boolean;
};

const categorySettings = [
  {
    key: "essential",
    locked: true,
  },
  {
    key: "analytics",
    locked: false,
  },
  {
    key: "performance",
    locked: false,
  },
  {
    key: "marketing",
    locked: false,
  },
] as const;

const ALL_OFF: Consent = { essential: true, analytics: false, performance: false, marketing: false };
const ALL_ON: Consent = { essential: true, analytics: true, performance: true, marketing: true };

export default function CookieBanner({ locale }: { locale: Locale }) {
  const copy = getMessages(locale).cookies;
  const [visible, setVisible] = useState(false);
  const [details, setDetails] = useState(false);
  const [consent, setConsent] = useState<Consent>(ALL_OFF);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Storage blocked: show the banner rather than assume consent.
      setVisible(true);
    }
  }, []);

  function save(value: Consent) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...value, date: new Date().toISOString() }));
    } catch {
      // Nothing persisted — the banner reappears next visit, which is the safe default.
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-title"
      className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4"
    >
      <div className="bg-base-100 border-base-300 mx-auto max-w-4xl rounded-2xl border p-5 shadow-2xl sm:p-6">
        <h2 id="cookie-title" className="text-lg font-bold">
          {copy.title}
        </h2>
        <p className="text-base-content/70 mt-2 text-sm leading-relaxed">
          {copy.text}
        </p>

        {details ? (
          <ul className="mt-4 space-y-3">
            {categorySettings.map((category, index) => (
              <li
                key={category.key}
                className="border-base-300 flex items-start justify-between gap-4 rounded-xl border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{copy.categories[index][0]}</p>
                  <p className="text-base-content/60 mt-0.5 text-xs leading-relaxed">{copy.categories[index][1]}</p>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm shrink-0"
                  aria-label={copy.categories[index][0]}
                  disabled={category.locked}
                  checked={consent[category.key]}
                  onChange={(event) =>
                    setConsent((prev) => ({ ...prev, [category.key]: event.target.checked }))
                  }
                />
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setDetails((v) => !v)} className="btn btn-ghost btn-sm">
            {details ? copy.hide : copy.customize}
          </button>
          <button type="button" onClick={() => save(ALL_OFF)} className="btn btn-outline btn-sm">
            {copy.reject}
          </button>
          {details ? (
            <button type="button" onClick={() => save(consent)} className="btn btn-outline btn-sm">
              {copy.save}
            </button>
          ) : null}
          <button type="button" onClick={() => save(ALL_ON)} className="btn btn-primary btn-sm">
            {copy.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
