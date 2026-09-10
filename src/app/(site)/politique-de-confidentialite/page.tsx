import type { Metadata } from "next";
import LegalLayout from "@/components/ui/LegalLayout";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: `Traitement des données personnelles dans ${site.name}.`,
  robots: { index: false, follow: true },
};

export default function PolitiqueConfidentialitePage() {
  return (
    <LegalLayout title="Politique de confidentialité" updatedAt="—">
      {/* §17.2: "le présent document ne certifie pas une conformité juridique". */}
      <p className="not-prose alert alert-warning text-sm">
        Modèle à faire valider : les finalités, durées de conservation, sous-traitants et
        territoires d&apos;hébergement doivent être arrêtés et vérifiés avant la mise en production.
      </p>

      <h2>Responsable du traitement</h2>
      <p>
        {site.name} — <a href={`mailto:${site.email}`}>{site.email}</a>. L&apos;identification
        complète de l&apos;éditeur figure dans les mentions légales.
      </p>

      <h2>Deux niveaux de données</h2>
      <p>
        <strong>Les données de compte</strong> concernent les personnes qui utilisent {site.name} :
        nom, téléphone, éventuellement email, et journaux techniques.
      </p>
      <p>
        <strong>Les données d&apos;atelier</strong> sont saisies par le tailleur au sujet de ses
        propres clients : identité, contact, mesures, commandes et encaissements. Le responsable
        d&apos;atelier en garde la maîtrise. {site.name} ne les utilise pas à des fins publicitaires.
      </p>

      <h2>Finalités et bases légales</h2>
      <ul>
        <li>Fournir le service souscrit — exécution du contrat.</li>
        <li>Sécuriser les accès et tracer les actions sensibles — intérêt légitime.</li>
        <li>Assistance et traitement des demandes — exécution du contrat.</li>
        <li>Mesure d&apos;audience du site public — consentement, révocable à tout moment.</li>
      </ul>

      <h2>Conservation</h2>
      <p>
        Les données d&apos;un atelier restent accessibles pendant la durée de l&apos;abonnement.
        Après expiration, une période de lecture seule et d&apos;export est prévue avant toute
        suppression. Aucun effacement automatique n&apos;intervient à la seule expiration.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous disposez de droits d&apos;accès, de rectification, d&apos;effacement, de limitation, de
        portabilité et d&apos;opposition. Écrivez à{" "}
        <a href={`mailto:${site.email}`}>{site.email}</a>. Une demande portant sur les clients
        d&apos;un atelier est traitée avec le responsable de cet atelier.
      </p>

      <h2>Sécurité</h2>
      <p>
        Les communications sont chiffrées, les mots de passe ne sont jamais stockés en clair, et les
        photos comme les exports ne sont accessibles que par des liens privés et limités dans le
        temps. Les journaux techniques ne contiennent ni mots de passe, ni mesures, ni photos.
      </p>

      <h2>Cookies</h2>
      <p>
        Seuls les cookies indispensables au fonctionnement sont déposés sans votre accord. Les
        autres catégories dépendent des choix effectués dans le bandeau de consentement, modifiables
        à tout moment.
      </p>
    </LegalLayout>
  );
}
