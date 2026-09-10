"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "cc-cookie-consent";

type Consent = {
  essential: true;
  analytics: boolean;
  performance: boolean;
  marketing: boolean;
};

const categories = [
  {
    key: "essential",
    title: "Cookies essentiels",
    text: "Nécessaires au fonctionnement du site. Ils ne peuvent pas être désactivés.",
    locked: true,
  },
  {
    key: "analytics",
    title: "Cookies analytiques",
    text: "Mesure d'audience et analyse du comportement de navigation (2 ans maximum).",
    locked: false,
  },
  {
    key: "performance",
    title: "Cookies de performance",
    text: "Mémorisation de vos préférences et amélioration des performances (session à 1 an).",
    locked: false,
  },
  {
    key: "marketing",
    title: "Cookies marketing",
    text: "Publicité ciblée et mesure d'efficacité des campagnes (durée variable).",
    locked: false,
  },
] as const;

const ALL_OFF: Consent = { essential: true, analytics: false, performance: false, marketing: false };
const ALL_ON: Consent = { essential: true, analytics: true, performance: true, marketing: true };

export default function CookieBanner() {
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
          Nous utilisons des cookies
        </h2>
        <p className="text-base-content/70 mt-2 text-sm leading-relaxed">
          Certains cookies sont indispensables au fonctionnement du site. Les autres nous aident à
          mesurer l&apos;audience et à améliorer votre expérience. Vous restez libre de votre choix,
          et pouvez le modifier à tout moment.
        </p>

        {details ? (
          <ul className="mt-4 space-y-3">
            {categories.map((category) => (
              <li
                key={category.key}
                className="border-base-300 flex items-start justify-between gap-4 rounded-xl border p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{category.title}</p>
                  <p className="text-base-content/60 mt-0.5 text-xs leading-relaxed">{category.text}</p>
                </div>
                <input
                  type="checkbox"
                  className="toggle toggle-primary toggle-sm shrink-0"
                  aria-label={category.title}
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
            {details ? "Masquer le détail" : "Personnaliser"}
          </button>
          <button type="button" onClick={() => save(ALL_OFF)} className="btn btn-outline btn-sm">
            Tout refuser
          </button>
          {details ? (
            <button type="button" onClick={() => save(consent)} className="btn btn-outline btn-sm">
              Enregistrer mes préférences
            </button>
          ) : null}
          <button type="button" onClick={() => save(ALL_ON)} className="btn btn-primary btn-sm">
            Accepter tout
          </button>
        </div>
      </div>
    </div>
  );
}
