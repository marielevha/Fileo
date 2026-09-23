/**
 * Marketing copy for the public site (§6).
 *
 * Editorial content that the back-office must be able to edit — FAQ,
 * tutorials, news, prices — lives in the database, not here. This file holds
 * only the structural copy that ships with the build.
 */

export const site = {
  name: "Filéo",
  tagline: "Votre atelier, bien organisé.",
  description:
    "Filéo réunit vos clients, leurs mesures, vos commandes, vos échéances et vos encaissements au même endroit. Sur ordinateur comme sur téléphone.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://fileo.app",
  email: "contact@fileo.app",
  foundedYear: 2026,
} as const;

/**
 * Sections that live on the home page are reached by anchor; the rest are
 * standalone routes. The leading "/" matters: from /cgv, "#tarifs" would do
 * nothing, while "/#tarifs" goes home and then scrolls.
 *
 * The navbar offset is handled by `scroll-padding-top` in globals.css.
 */
export const navLinks = [
  { href: "/#fonctionnalites", label: "Fonctionnalités" },
  { href: "/#tarifs", label: "Tarifs" },
  { href: "/#prise-en-main", label: "Prise en main" },
  { href: "/#faq", label: "FAQ" },
  { href: "/nouveautes", label: "Nouveautés" },
] as const;

/**
 * §6.2: no invented customer numbers. These describe what the product does,
 * not how many workshops use it.
 */
export const heroPoints = [
  "Mesures versionnées, jamais écrasées",
  "Acomptes et soldes suivis par commande",
  "Fonctionne avec un réseau intermittent",
] as const;

/** The pains the spec lists in §1.2, stated as the visitor experiences them. */
export const problems = [
  {
    icon: "layout",
    title: "Tout est éparpillé",
    text: "Carnets, messages, mémoire : retrouver une information demande du temps et laisse passer des erreurs.",
  },
  {
    icon: "device",
    title: "Les mesures se perdent",
    text: "Un relevé ancien ou introuvable oblige à refaire le travail, parfois devant le client.",
  },
  {
    icon: "clock",
    title: "Les dates promises dérapent",
    text: "Quand les commandes s'accumulent, les échéances deviennent difficiles à tenir de tête.",
  },
  {
    icon: "wrench",
    title: "Les acomptes sont flous",
    text: "Sans trace écrite, le montant déjà reçu et le solde restant prêtent à discussion.",
  },
] as const;

/** Feature blocks mirroring the AT-xx requirements (§8). */
export const features = [
  {
    icon: "users",
    title: "Clients et historique",
    text: "Une fiche par client, retrouvée par nom ou par téléphone, avec ses commandes et son solde.",
    tags: ["Recherche", "Archivage"],
  },
  {
    icon: "device",
    title: "Mesures versionnées",
    text: "Chaque relevé est daté et conservé. Modifier une fiche ne change jamais une commande déjà enregistrée.",
    tags: ["Historique", "Instantané"],
  },
  {
    icon: "code",
    title: "Commandes détaillées",
    text: "Plusieurs articles, photos du tissu et du modèle, prix, échéances et avancement pièce par pièce.",
    tags: ["Photos", "Avancement"],
  },
  {
    icon: "clock",
    title: "Planning et retards",
    text: "Les échéances du jour, de la semaine et les retards, en liste ou en calendrier.",
    tags: ["Liste", "Calendrier"],
  },
  {
    icon: "shield",
    title: "Acomptes et soldes",
    text: "Chaque encaissement est tracé, jamais écrasé. Le reste à payer est calculé, pas estimé.",
    tags: ["Reçus", "Créances"],
  },
  {
    icon: "server",
    title: "Travail sans réseau",
    text: "Sur mobile, l'essentiel s'enregistre hors connexion et se synchronise au retour du réseau.",
    tags: ["Mobile", "Synchronisation"],
  },
] as const;

/** §5.1 — the first-use path, kept to four honest steps. */
export const steps = [
  {
    step: "01",
    title: "Créez votre atelier",
    text: "Nom, pays, devise : quelques champs suffisent pour démarrer.",
  },
  {
    step: "02",
    title: "Ajoutez un client",
    text: "Un nom suffit. Le téléphone est conseillé, jamais obligatoire.",
  },
  {
    step: "03",
    title: "Enregistrez une commande",
    text: "Articles, mesures, photos, prix et date promise, en une seule saisie.",
  },
  {
    step: "04",
    title: "Suivez et encaissez",
    text: "Mettez à jour l'avancement, notez les acomptes, remettez la tenue.",
  },
] as const;

/**
 * §2.3 and §11.1: the FCFA price studied applies to Congo-Brazzaville only.
 * The DRC price is not settled and must not be shown as if it were.
 */
export const pricingNote =
  "Le tarif ci-dessous concerne la République du Congo. L'offre pour la République démocratique du Congo est en cours de définition.";

export const includedFeatures = [
  "Clients, mesures et commandes sans limite de saisie",
  "Planning, échéances et suivi des retards",
  "Acomptes, soldes, dépenses et reçus",
  "Accès web et application mobile",
  "Tutoriels vidéo et assistance",
] as const;

export const legalLinks = [
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/politique-de-confidentialite", label: "Politique de confidentialité" },
  { href: "/cgv", label: "CGV" },
] as const;

export const footerProduct = [
  { href: "/#fonctionnalites", label: "Fonctionnalités" },
  { href: "/#tarifs", label: "Tarifs" },
  { href: "/#telecharger", label: "Télécharger" },
  { href: "/nouveautes", label: "Nouveautés" },
] as const;

export const footerSupport = [
  { href: "/prise-en-main", label: "Prise en main" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
] as const;

/**
 * §6.2: show "bientôt disponible" rather than a fake download link.
 * Flip these once the builds are actually published.
 */
export const appStores = {
  android: { available: false, url: null as string | null },
  ios: { available: false, url: null as string | null },
} as const;
