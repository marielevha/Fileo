import Link from "next/link";

export default function NotFound() {
  return (
    <div className="from-base-100 to-base-200 grid min-h-screen place-items-center bg-gradient-to-br px-4 text-center">
      <div>
        <p className="text-gradient text-7xl font-extrabold sm:text-8xl">404</p>
        <h1 className="mt-4 text-2xl font-bold sm:text-3xl">Cette page n&apos;existe pas</h1>
        <p className="text-base-content/70 mt-3 max-w-md text-pretty">
          Le lien est peut-être obsolète ou l&apos;adresse mal orthographiée.
        </p>
        <Link href="/" className="btn btn-primary mt-8">
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
