"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";
import Icon from "@/components/ui/Icon";
import LanguageSwitcher from "./LanguageSwitcher";
import { localePath, type Locale } from "@/lib/i18n/config";
import { getMessages } from "@/lib/i18n/messages";

export default function Navbar({ signedIn = false, locale }: { signedIn?: boolean; locale: Locale }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const copy = getMessages(locale);
  const navLinks = [
    { href: "/#fonctionnalites", label: copy.nav.features },
    { href: "/#tarifs", label: copy.nav.pricing },
    { href: "/#prise-en-main", label: copy.nav.gettingStarted },
    { href: "/#faq", label: copy.nav.faq },
    { href: "/nouveautes", label: copy.nav.news },
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-base-100/70 border-base-300/70 border-b backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href={localePath(locale, "/")} className="shrink-0" aria-label={copy.nav.home}>
          <Logo />
        </Link>

        <ul className="bg-base-200/60 border-base-300/70 hidden items-center gap-1 rounded-full border px-2 py-1.5 backdrop-blur lg:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={localePath(locale, link.href)}
                className="hover:bg-base-100 hover:text-primary rounded-full px-4 py-2 text-sm font-medium transition-colors"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          {signedIn ? (
            <Link href={localePath(locale, "/atelier")} className="btn btn-primary btn-sm hidden shadow-md sm:inline-flex">
              {copy.nav.workshop}
            </Link>
          ) : (
            <>
              <Link href={localePath(locale, "/connexion")} className="btn btn-ghost btn-sm hidden sm:inline-flex">
                {copy.nav.signIn}
              </Link>
              <Link
                href={localePath(locale, "/inscription")}
                className="btn btn-primary btn-sm hidden shadow-md sm:inline-flex"
              >
                {copy.nav.signUp}
              </Link>
            </>
          )}

          <ThemeToggle />
          <LanguageSwitcher locale={locale} label={copy.nav.chooseLanguage} />

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="btn btn-ghost btn-circle lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? copy.nav.closeMenu : copy.nav.openMenu}
          >
            <Icon name={open ? "close" : "menu"} className="h-5 w-5" />
          </button>
        </div>
      </nav>

      <div
        id="mobile-menu"
        hidden={!open}
        className="bg-base-100/95 border-base-300 border-t backdrop-blur-xl lg:hidden"
      >
        <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={localePath(locale, link.href)}
                onClick={() => setOpen(false)}
                className="hover:bg-base-200 hover:text-primary block rounded-xl px-4 py-3 font-medium transition-colors"
              >
                {link.label}
              </Link>
            </li>
          ))}
          <li className="flex flex-col gap-2 pt-2">
            {signedIn ? (
              <Link href={localePath(locale, "/atelier")} onClick={() => setOpen(false)} className="btn btn-primary w-full">
                {copy.nav.workshop}
              </Link>
            ) : (
              <>
                <Link
                  href={localePath(locale, "/connexion")}
                  onClick={() => setOpen(false)}
                  className="btn btn-outline w-full"
                >
                  {copy.nav.signIn}
                </Link>
                <Link
                  href={localePath(locale, "/inscription")}
                  onClick={() => setOpen(false)}
                  className="btn btn-primary w-full"
                >
                  {copy.nav.signUp}
                </Link>
              </>
            )}
          </li>
        </ul>
      </div>
    </header>
  );
}
