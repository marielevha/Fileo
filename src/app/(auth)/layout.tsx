import Link from "next/link";
import Logo from "@/components/layout/Logo";
import ThemeToggle from "@/components/layout/ThemeToggle";

/** Minimal shell for sign-in / sign-up: no marketing chrome in the way. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="from-base-200 via-base-100 to-base-100 relative min-h-screen bg-gradient-to-br">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="blob bg-primary/20 animate-float -top-32 -left-24 h-96 w-96" />
        <div
          className="blob bg-secondary/15 animate-float -right-24 bottom-0 h-96 w-96"
          style={{ animationDelay: "-6s" }}
        />
      </div>

      <header className="relative mx-auto flex h-20 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Filéo — accueil">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>

      <main id="main" className="relative mx-auto w-full max-w-lg px-4 pb-20 sm:px-6">
        {children}
      </main>
    </div>
  );
}
