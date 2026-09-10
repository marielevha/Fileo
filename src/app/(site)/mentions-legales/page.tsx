import type { Metadata } from "next";
import LegalLayout from "@/components/ui/LegalLayout";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: `Mentions légales du site ${site.name}.`,
  robots: { index: false, follow: true },
};

export default function MentionsLegalesPage() {
  return (
    <LegalLayout title="Mentions légales" updatedAt="—">
      {/* §17.2: these texts must be validated before production. */}
      <p className="not-prose alert alert-warning text-sm">
        Modèle à compléter : la forme juridique, l&apos;immatriculation, le directeur de la
        publication et l&apos;hébergeur doivent être renseignés et validés avant toute mise en
        ligne publique.
      </p>

      <h2>Éditeur du service</h2>
      <ul>
        <li>Service : {site.name}</li>
        <li>
          Contact : <a href={`mailto:${site.email}`}>{site.email}</a>
        </li>
        <li>Porteur du projet : Mariel Evha ABIR</li>
        <li>Dénomination sociale et forme juridique : à compléter</li>
        <li>Adresse du siège : à compléter</li>
        <li>Immatriculation : à compléter</li>
        <li>Directeur de la publication : à compléter</li>
      </ul>

      <h2>Hébergeur</h2>
      <p>
        Nom, adresse et coordonnées de l&apos;hébergeur : à compléter. Le fournisseur et la région
        d&apos;hébergement font partie des décisions à arrêter avant la mise en production.
      </p>

      <h2>Territoires desservis</h2>
      <p>
        {site.name} s&apos;adresse aux ateliers de couture en République du Congo et en République
        démocratique du Congo. Les obligations applicables dans chaque pays doivent être vérifiées
        avant commercialisation.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Les contenus de ce site et le logiciel {site.name} sont protégés. Les données saisies par un
        atelier restent la propriété de cet atelier.
      </p>

      <h2>Contact</h2>
      <p>
        Pour toute question relative à ces mentions :{" "}
        <a href={`mailto:${site.email}`}>{site.email}</a>.
      </p>
    </LegalLayout>
  );
}
