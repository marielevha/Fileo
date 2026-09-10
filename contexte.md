# Contexte de travail — Filéo

> Document de reprise. À lire en premier au début d'une nouvelle session.
> Dernière mise à jour : 10 septembre 2026.

---

## 1. Ce qu'est ce projet

**Filéo** — solution de gestion pour ateliers de couture (clients, mesures,
commandes, échéances, encaissements). Marchés visés : République du Congo et
RDC, premier déploiement envisagé à Brazzaville et Kinshasa.

Le cahier des charges fait autorité : [`Fileo_Cahier_des_charges.md`](Fileo_Cahier_des_charges.md).
Les références `§x.y` dans le code y renvoient. **En cas de doute, le cahier
tranche, pas ce document.**

Ce dépôt contient le **site public**, l'**espace atelier** et le
**back-office**. L'application mobile Expo est un chantier distinct, non
commencé.

### Origine du dépôt

Le dossier a d'abord servi à cloner le site vitrine d'une autre société, pour
servir de base technique (design system Next.js + Tailwind + daisyUI). Cette
base a ensuite été **entièrement rebrandée en Filéo** : il ne reste aucune
trace de l'ancien contenu (vérifié par `grep`). Ne pas s'étonner de trouver ce
passé dans l'historique de conversation.

---

## 2. Environnement — À LIRE AVANT TOUTE COMMANDE

Le poste est **managé avec un filtrage sortant délibéré**. Trois contournements
sont en place ; les défaire casse le projet.

### Node.js est portable, pas installé

Les installeurs MSI sont bloqués par stratégie de groupe (code 1625). Node
**v24.21.0** vit dans [`.tools/node/`](.tools/node/) (~38 Mo, gitignoré).

```powershell
# À faire dans CHAQUE nouveau terminal, sinon `node` est introuvable :
$env:Path = "C:\Users\mabir\Music\maeva\clover\.tools\node;" + $env:Path
```

### Le registre npm est filtré

`registry.npmjs.org` renvoie **HTTP 403**. `cdn.jsdelivr.net` aussi.
`registry.yarnpkg.com` ne dépanne pas : ses métadonnées renvoient les tarballs
vers npmjs.org.

Le fichier [`.npmrc`](.npmrc) redirige vers `registry.npmmirror.com`
(miroir Alibaba Cloud). **L'utilisateur a explicitement validé ce choix.**
C'est un contournement, pas un réglage définitif : à retirer dès que
`registry.npmjs.org` sera accessible ou qu'un registre interne d'entreprise
sera disponible. Ne pas committer tel quel sur un dépôt partagé.

Ce qui passe : nodejs.org, GitHub, fonts.googleapis.com, fonts.gstatic.com.

### Conséquences sur les dépendances

Aucun module natif n'est compilable (pas de Build Tools). D'où :

| Besoin | Choix | Pourquoi pas l'usuel |
| --- | --- | --- |
| Base de données | `node:sqlite` (intégré Node 22+) | `better-sqlite3` exige node-gyp |
| Hachage mot de passe | `scrypt` de `node:crypto` | bcrypt et argon2 sont natifs |
| Icônes | SVG inline maison (`Icon.tsx`) | évite une dépendance de plus |

`@types/node` doit rester en **`^24`** : les types de `node:sqlite` n'existent
pas dans la v20.

---

## 3. Commandes

```powershell
$env:Path = "C:\Users\mabir\Music\maeva\clover\.tools\node;" + $env:Path

npm run dev            # http://localhost:3000
npm run db:seed        # crée data/fileo.db + jeu de démonstration
npm run db:reset       # supprime data/ puis reseed
npm run check:money    # 9 contrôles : formules §8.7 + contraintes de schéma
npm run check:smoke    # 21 contrôles : routes et permissions par rôle
npx tsc --noEmit       # typecheck
```

### Comptes de démonstration

| Rôle | Téléphone | Mot de passe |
| --- | --- | --- |
| Responsable d'atelier | +242 06 111 11 11 | `Atelier2026!` |
| Collaborateur *(sans droit financier)* | +242 06 222 22 22 | `Atelier2026!` |
| Équipe Filéo (back-office) | +242 06 000 00 01 | `Fileo2026!` |

Le collaborateur existe pour vérifier **REC-12** : aucun montant ne doit lui
être transmis.

---

## 4. Décisions structurantes

Cinq exigences du cahier sont coûteuses à rattraper après coup. Elles sont dans
les fondations — **ne pas les contourner par commodité**.

### Montants (§15.3)

Entiers d'**unité mineure** + code devise, jamais de flottant.
L'exposant est **par devise** : XAF et CDF ont **0 décimale**.
2 500 FCFA est l'entier `2500`, pas `250000`. Un `×100` généralisé
facturerait 100 fois trop.

Tout passe par [`src/lib/money.ts`](src/lib/money.ts). `assertSameCurrency`
interdit tout total mélangeant des devises — aucune conversion automatique
n'est prévue (§2.3).

### Registre financier en ajout seul (§8.7)

Un encaissement confirmé n'est **jamais** modifié ni supprimé : il est
neutralisé par une contre-écriture motivée, et son statut passe à `voided`.
Chaque écriture porte une clé d'idempotence unique par atelier — un renvoi ne
crée jamais deux encaissements (REC-04).

Les formules sont transcrites littéralement du §8.7 dans `computeOrderBalance`.

### Filtrage serveur (§4.2)

« Masquer un bouton ne suffit pas. » Les champs financiers sont **absents de la
réponse**, pas seulement du rendu. Voir `redactMoney` et le paramètre
`includeMoney` des dépôts.

### Isolation des ateliers (§16)

`workshop_id` sur chaque table métier, portée forcée dans chaque requête.
Ne jamais faire confiance à un identifiant fourni par l'appelant seul (REC-11).

### Instantané de mesures (§8.3)

Les mesures sont **copiées** dans l'article (`measurement_snapshot`), jamais
référencées. Modifier une fiche client ne change pas une commande existante
(REC-02). Les relevés sont versionnés, jamais écrasés.

---

## 5. Pièges rencontrés

Erreurs déjà commises et corrigées. Les reproduire coûterait du temps.

- **Un module `"use server"` ne peut exporter que des fonctions async.**
  Exporter une constante provoque un 500 à l'exécution, pas une erreur de
  compilation. C'est pourquoi les catégories de tickets vivent dans
  [`src/lib/tickets.ts`](src/lib/tickets.ts) et non dans l'action.

- **Dans le thème `synthwave`, `--color-neutral` est un indigo VIF**
  (`oklch(45% .24 277)`), pas une surface sombre. Utiliser `base-300` pour les
  fonds sombres — sinon le pied de page devient bleu électrique.

- **Un commentaire JSX ne peut pas suivre directement `return (`.**
  Utiliser un commentaire `//` au-dessus du `return`.

- **Les Server Actions ne se testent pas par un POST HTTP brut** — il faut
  l'en-tête `Next-Action`. Pour tester les pages protégées, utiliser
  [`scripts/mint-session.mjs`](scripts/mint-session.mjs) qui forge un cookie de
  session valide en base, ou directement `npm run check:smoke`.

- **Ne pas comparer les couleurs en chaînes littérales.** daisyUI émet
  `oklch(15% 0.09 281.288)` là où le CSS d'origine écrit `.09` — même valeur,
  formatage différent. Comparer les valeurs de teinte, pas le texte.

- **Après avoir supprimé `.next`, redémarrer le serveur de dev** : sinon les
  types générés restent périmés et `tsc` signale des modules introuvables.

---

## 6. Architecture

```
src/
├─ app/
│  ├─ layout.tsx        <html>, polices, script anti-flash de thème
│  ├─ (site)/           public : accueil, faq, prise-en-main, nouveautes,
│  │                    contact, mentions-legales, politique…, cgv
│  ├─ (auth)/           connexion, inscription
│  ├─ atelier/          espace connecté du tailleur
│  └─ admin/            back-office Filéo
├─ components/
│  ├─ layout/           Navbar, Footer, Logo, ThemeToggle
│  ├─ sections/         sections du site public
│  ├─ app/              coquille des espaces connectés (AppNav, UserMenu…)
│  ├─ auth/             PhoneField
│  └─ ui/               Icon, Reveal, SectionHeading, PageHero, CookieBanner
└─ lib/
   ├─ db/               index.ts (connexion) + schema.sql (21 tables)
   ├─ auth/             password.ts, session.ts, guards.ts
   ├─ repos/            clients, orders, payments, dashboard, contents, admin
   ├─ actions/          auth, admin, contact (Server Actions)
   ├─ money.ts          arithmétique monétaire
   ├─ permissions.ts    matrice du §4.2
   ├─ phone.ts          E.164 pour CG/CD, lien WhatsApp
   ├─ audit.ts          journal des actions sensibles
   ├─ accents.ts        rotation rose/cyan/orange
   └─ site.ts           contenu éditorial figé au build
```

### Design system

Next.js 15 (App Router) · TypeScript · Tailwind v4 · daisyUI 5.

Thèmes : **`light`** et **`synthwave`** de daisyUI, activés par leur nom dans
[`globals.css`](src/app/globals.css) — pas recopiés, pour éviter toute dérive.
C'est la palette exacte demandée par l'utilisateur.

Polices : **Outfit** (titres, chiffres) + **Inter** (corps), via `next/font`.

**Rotation d'accents** : chaque carte pose `--accent` via `accent-1|2|3`, et
toutes ses parties teintées lisent cette seule variable. Une carte ne déclare
sa couleur qu'une fois. Voir [`src/lib/accents.ts`](src/lib/accents.ts).

Le nom du thème sombre est centralisé dans [`src/lib/theme.ts`](src/lib/theme.ts)
— lu par le bouton **et** par le script de pré-rendu, pour qu'ils ne puissent
pas diverger.

### Marque

Logo : une **aiguille enfilée** (chas, tige, pointe, fil qui boucle). Tracé en
trait pur sur grille 32×32, hérite de `currentColor`.
[`Logo.tsx`](src/components/layout/Logo.tsx) exporte aussi `LogoMark` seul.
Le favicon [`icon.svg`](src/app/icon.svg) reprend le même tracé.

### Navigation publique

Le menu pointe vers des **ancres de l'accueil**, sauf Nouveautés :

| Menu | Cible |
| --- | --- |
| Fonctionnalités | `/#fonctionnalites` |
| Tarifs | `/#tarifs` |
| Prise en main | `/#prise-en-main` |
| FAQ | `/#faq` |
| Nouveautés | `/nouveautes` |

Le `/` en tête est indispensable : depuis `/cgv`, un simple `#tarifs` ne ferait
rien. Le décalage sous la barre fixe vient de `scroll-padding-top: 6.5rem`.

Les pages `/faq` et `/prise-en-main` **existent toujours** (le §6.1 les exige)
et contiennent davantage que les sections de l'accueil. Elles restent
atteignables par le pied de page et par des liens « voir tout ».

---

## 7. État d'avancement

### Fait et vérifié

- **Socle** : 21 tables, permissions transcrites du §4.2, audit, sessions
  (cookie opaque, seul le SHA-256 est stocké), téléphones E.164 CG/CD.
- **Authentification** : inscription + création d'atelier + abonnement d'essai,
  connexion, déconnexion.
- **Site public** : accueil (hero, problèmes, fonctionnalités, étapes, tarifs,
  FAQ, téléchargement), faq, prise-en-main, nouveautés, contact, 3 pages
  légales. Tarifs, FAQ, tutoriels et actualités sont **lus en base**, donc
  éditables depuis le back-office.
- **Espace atelier** : tableau de bord (§8.1), clients avec recherche par
  téléphone normalisé, liste des commandes avec état **dérivé**, détail de
  commande avec les soldes du §8.7.
- **Back-office** : tableau de bord (recettes par devise, jamais mélangées),
  ateliers, validation des règlements avec prolongation d'abonnement (REC-17).

### Non fait, par ordre de priorité

1. **Vérification du téléphone (§7.1 AUTH-01)** — aucun fournisseur SMS retenu.
   Les comptes sont actifs dès la création. **Bloquant avant toute ouverture
   publique des inscriptions.**
2. **Formulaires de création** : client, commande, encaissement. Sans eux
   l'atelier n'est pas réellement utilisable — seules les listes existent.
3. **Pages atelier manquantes** (la navigation y renvoie déjà, elles renvoient
   404) : planning, paiements, dépenses, équipe, abonnement, paramètres.
4. **Pages admin manquantes** : offres, contenus, tickets, audit.
   Les tickets créés par `/contact` s'accumulent en base sans écran pour les lire.
5. Photos et pièces jointes (§8.5), reçus et exports (§8.8).
6. Messages WhatsApp préremplis (§8.10) — `whatsappLink()` existe déjà dans
   `phone.ts`, sans interface.
7. API de synchronisation mobile (§10). La table `sync_operations` et les
   colonnes `row_version` existent déjà.
8. Compléter mentions légales, confidentialité et CGV : ce sont des **modèles**
   à faire valider juridiquement (§17.2).

### Scénarios de recette couverts

`npm run check:money` couvre REC-03, REC-05, REC-10, le plafonnement de la
réduction (§8.4), l'arithmétique entière (§15.3), les contraintes
d'idempotence (REC-04, REC-17) et la présence de `workshop_id` (§16).

`npm run check:smoke` couvre **REC-12** pour de bon : le collaborateur sans
droit financier reçoit la page des commandes sans la colonne « Reste à payer »
ni le montant dans le HTML.

Non couverts, car ils exigent des tests d'intégration ou le client mobile :
REC-08, REC-09, REC-11, REC-14 à REC-16, REC-19 à REC-24.

---

## 8. Base de données

SQLite via `node:sqlite`, fichier `data/fileo.db` (gitignoré, recréable par
`npm run db:seed`).

`node:sqlite` est encore marqué **expérimental** en amont. Le cahier prévoit
PostgreSQL en production (§15.2) : la bascule touche `src/lib/db/` et les
dépôts, **pas les pages**. Garder cette frontière étanche.

Conventions du schéma :

- identifiants `TEXT` (UUID) — stables entre appareils pour la synchronisation
- montants `INTEGER` en unité mineure + colonne devise
- dates `TEXT` ISO-8601
- `row_version` incrémenté à chaque écriture (préparation des conflits §10.3)
- `workshop_id` sur chaque table métier

---

## 9. Points de vigilance produit

Le cahier est explicite sur ce qu'il ne faut **pas** faire. Rappels :

- Ne jamais afficher de faux avis, chiffres clients inventés ou lien de
  téléchargement factice. Les drapeaux `appStores` de `site.ts` affichent
  « bientôt disponible » tant que les applications ne sont pas publiées (§6.2).
- Le tarif de 2 500 FCFA concerne **le Congo-Brazzaville**. L'offre RDC n'est
  pas définie et ne doit pas être affichée comme validée (§2.3).
- Ne pas promettre « illimité » avant arbitrage sur les plafonds (§11.1).
- Filéo prépare un message WhatsApp, il ne peut jamais affirmer qu'il a été
  envoyé, reçu ou lu (§8.10).
- Un reçu ne doit pas se présenter comme une facture fiscalement conforme
  sans validation spécifique (§8.8).
- Les recettes Filéo ne se mélangent jamais aux encaissements des clients des
  tailleurs (§12.1).
