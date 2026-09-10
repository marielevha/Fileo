import type { Metadata } from "next";
import LegalLayout from "@/components/ui/LegalLayout";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "CGV",
  description: `Conditions générales de vente de ${site.name}.`,
  robots: { index: false, follow: true },
};

export default function CgvPage() {
  return (
    <LegalLayout title="Conditions générales de vente" updatedAt="—">
      <p className="not-prose alert alert-warning text-sm">
        Modèle à faire valider juridiquement : les clauses ci-dessous sont des repères de structure,
        pas un document contractuel prêt à l&apos;emploi.
      </p>

      <h2>1. Objet</h2>
      <p>
        Les présentes conditions encadrent les prestations de conception, de développement et de
        maintenance web réalisées par {site.name} pour ses clients professionnels.
      </p>

      <h2>2. Devis et commande</h2>
      <p>
        Chaque prestation fait l&apos;objet d&apos;un devis détaillé. La commande est ferme à
        réception du devis signé et, le cas échéant, de l&apos;acompte convenu.
      </p>

      <h2>3. Prix et paiement</h2>
      <p>
        Les prix sont exprimés en euros hors taxes. Sauf mention contraire, le règlement intervient à
        30 jours date de facture. Tout retard entraîne des pénalités au taux légal et l&apos;indemnité
        forfaitaire de recouvrement prévue par le code de commerce.
      </p>

      <h2>4. Obligations du client</h2>
      <p>
        Le client fournit en temps utile les contenus, accès et validations nécessaires. Les retards
        qui en découlent décalent le planning à due concurrence.
      </p>

      <h2>5. Délais et livraison</h2>
      <p>
        Les délais annoncés sont donnés à titre indicatif et supposent la collaboration active du
        client. La recette s&apos;effectue selon le périmètre décrit au devis.
      </p>

      <h2>6. Propriété intellectuelle</h2>
      <p>
        Les droits sur les livrables sont cédés au client après paiement intégral. Les briques
        logicielles tierces restent régies par leurs licences respectives.
      </p>

      <h2>7. Garantie et maintenance</h2>
      <p>
        Une garantie de correction des anomalies s&apos;applique après la mise en production, selon la
        durée indiquée au devis. Au-delà, la maintenance fait l&apos;objet d&apos;un contrat distinct.
      </p>

      <h2>8. Responsabilité</h2>
      <p>
        La responsabilité de {site.name} est limitée au montant des sommes effectivement perçues au
        titre de la prestation concernée.
      </p>

      <h2>9. Droit applicable</h2>
      <p>
        Les présentes conditions sont soumises au droit français. À défaut d&apos;accord amiable, le
        litige relève des tribunaux compétents.
      </p>

      <h2>10. Contact</h2>
      <p>
        Toute question : <a href={`mailto:${site.email}`}>{site.email}</a>.
      </p>
    </LegalLayout>
  );
}
