# Contexte de travail — Filéo

> Document de reprise. À lire en premier au début d'une nouvelle session.
> Dernière mise à jour : 11 septembre 2026.

**Branche active :** `feature/mongodb-integration`, basée sur le commit `5fedf73`.
Elle contient la conversion de toute la persistance applicative vers MongoDB
Atlas, basée sur les fonctionnalités clients, commandes, planning et
encaissements de `feature/dashboard-atelier`.

---

## Mise a jour Codex - 11 septembre 2026

Travail realise dans cette session :

- Toutes les branches distantes ont ete recuperees, puis la branche la plus
  recente a ete activee : `feature/mongodb-integration`.
- `atlas-credentials.env` a ete ajoute localement par l'utilisateur et reste
  ignore par Git via `.gitignore`.
- La connexion MongoDB Atlas a ete deboguee : le blocage reseau/TLS venait de
  l'IP Atlas non autorisee, puis un second echec venait d'un utilisateur/URI
  Mongo invalide. Apres creation du nouvel utilisateur Atlas, `MONGODB_PING=ok`.
- La boucle middleware i18n a ete corrigee dans `src/middleware.ts` : une
  requete deja rewrittee avec `x-fileo-locale` n'est plus redirigee vers la
  route localisee, ce qui evitait le chargement infini entre `/` et `/fr`.
- Le warning React d'hydratation dans `AppNav` a ete corrige :
  `usePathname()` voyait parfois `/admin` cote serveur et `/fr/admin` cote
  client. L'etat actif de navigation est maintenant applique seulement apres
  hydratation client.
- La migration SQLite vers MongoDB a ete executee avec `--replace`, puis le
  seed MongoDB enrichi a ete execute. Le seed remplace volontairement la base
  `fileo`.
- `scripts/seed.mjs` cree maintenant un jeu de demo plus dense : 6 users,
  2 ateliers, 5 memberships, 3 offres, 2 abonnements, 12 clients, 4 releves de
  mesures, 8 commandes, 10 lignes de commande, 10 mouvements financiers,
  1 changement de date, 2 reglements plateforme, 2 tickets, 2 entrees d'audit
  et 12 contenus publics.
- `scripts/check-orders.mjs` calcule maintenant le nombre initial de commandes
  au lieu de supposer l'ancien seed minimal, afin que le test reste compatible
  avec un jeu de donnees enrichi.

Validations executees apres seed :

```powershell
.\.tools\node\node.exe scripts\check-money.mjs
.\.tools\node\node.exe scripts\smoke.mjs
.\.tools\node\node.exe scripts\check-clients.mjs
.\.tools\node\node.exe scripts\check-orders.mjs
.\.tools\node\node.exe scripts\check-planning.mjs
.\.tools\node\node.exe scripts\check-payments.mjs
.\.tools\node\npx.cmd tsc --noEmit --pretty false
```

Resultat : tous les checks sont passes. Le serveur local repond en `200` sur
`http://127.0.0.1:3000/fr`.

Pour demarrer le serveur depuis PowerShell si `node` n'est pas dans le `PATH` :

```powershell
$env:Path = "C:\Users\mabir\Music\maeva\clover\.tools\node;$env:Path"
.\.tools\node\npm.cmd run dev
```

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

### Node.js et PowerShell

Node **v24.19.0** est installé dans `C:\Program Files\nodejs\node.exe`.
PowerShell bloque `npm.ps1` par sa stratégie d'exécution : utiliser **`npm.cmd`**
dans les commandes automatisées. `npm` peut fonctionner depuis un terminal
`cmd.exe`, mais `npm.cmd` reste la forme la plus fiable ici.

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
| Base de données | pilote officiel `mongodb` + Atlas | accès asynchrone, transactions et index natifs |
| Hachage mot de passe | `scrypt` de `node:crypto` | bcrypt et argon2 sont natifs |
| Icônes | SVG inline maison (`Icon.tsx`) | évite une dépendance de plus |

`@types/node` reste en **`^24`**, aligné sur la version Node installée et sur
`process.loadEnvFile()` utilisé pour charger les identifiants Atlas en local.

---

## 3. Commandes

```powershell
npm.cmd run dev             # http://localhost:3000
npm.cmd run build           # build de production (accès Google Fonts requis)
npm.cmd run db:seed         # remplace MongoDB/fileo par le jeu de démonstration
npm.cmd run db:reset        # alias explicite du seed destructif
npm.cmd run db:migrate:sqlite -- --replace # transfère data/fileo.db vers Atlas
npm.cmd run check:money     # formules §8.7 + index/contraintes MongoDB
npm.cmd run check:clients   # CRUD, recherche, tris, pagination, deleted_at
npm.cmd run check:orders    # pagination de la liste des commandes
npm.cmd run check:planning  # replanification, affectation, remise, audit
npm.cmd run check:payments  # écriture, audit, idempotence et affichage encaissement
npm.cmd run check:smoke     # routes, locales et permissions par rôle
npm.cmd run lint            # ESLint
npm.cmd exec tsc -- --noEmit
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

- **Les Server Actions liées à un formulaire doivent conserver les champs
  cachés générés par Next.js.** Les scripts `check-clients.mjs` et
  `check-planning.mjs` chargent d'abord la page, extraient ces champs, puis
  soumettent un `FormData`. Un POST reconstruit à la main sans ces champs ne
  déclenche pas l'action attendue.

- **Après une évolution des index MongoDB, redémarrer `next dev`.** Le client et
  la promesse d'initialisation survivent au rechargement à chaud dans
  `globalThis`; les index de démarrage sont donc recréés après réouverture du
  processus.

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
│  ├─ clients/          formulaire, filtres et suppression client
│  ├─ orders/           contrôles de pagination des commandes
│  ├─ planning/         filtres, navigation temporelle et éditeur de tâche
│  └─ ui/               Icon, Reveal, SectionHeading, PageHero, CookieBanner
└─ lib/
   ├─ db/               index.ts (pool Atlas, transactions et index MongoDB)
   ├─ auth/             password.ts, session.ts, guards.ts
   ├─ repos/            clients, orders, planning, payments, dashboard…
   ├─ actions/          auth, clients, planning, admin, contact
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

- **Socle** : collections MongoDB indexées, permissions transcrites du §4.2, audit, sessions
  (cookie opaque, seul le SHA-256 est stocké), téléphones E.164 CG/CD.
- **Authentification** : inscription + création d'atelier + abonnement d'essai,
  connexion, déconnexion.
- **Site public** : accueil (hero, problèmes, fonctionnalités, étapes, tarifs,
  FAQ, téléchargement), faq, prise-en-main, nouveautés, contact, 3 pages
  légales. Tarifs, FAQ, tutoriels et actualités sont **lus en base**, donc
  éditables depuis le back-office.
- **Internationalisation** : routes et sélecteur cohérents en français (`fr`),
  anglais (`en`) et lingala (`lg`). Les traductions du site public ont été
  harmonisées pour éviter les mélanges de langue.
- **Tarifs** : offre Pro à **5 000 FCFA** avec capacités supérieures, intégrée
  au parcours d'inscription en plus de l'offre initiale.
- **Clients (§8.2)** : ajout, consultation, modification, archivage et
  suppression logique via `deleted_at`. Recherche directe temporisée, recherche
  par téléphone normalisé, tris serveur, pagination 10/20/50 et protection par
  atelier. Les commandes liées sont conservées après suppression logique.
- **Commandes (§8.4)** : liste avec état **dérivé**, accès explicite à la fiche
  depuis la référence ou le bouton « Voir », pagination serveur 10/20/50 et
  liens localisés. La fiche détail conserve le filtrage financier REC-12 et les
  liens retour/client/encaissement respectent la locale.
- **Encaissements (§8.7)** : formulaire depuis la fiche commande avec montant,
  date effective, moyen et référence ; raccourci vers le solde restant ; écriture
  confirmée dans le registre financier, audit, clé d'idempotence et confirmation
  sur la fiche. Les commandes annulées et les membres sans droit financier sont
  refusés.
- **Planning (§8.6)** : vues liste, jour et semaine ; navigation temporelle ;
  recherche directe ; filtres par collaborateur et état ; raccourcis aujourd'hui,
  sept jours, retards et prêts. Les événements distinguent échéance d'article,
  date promise, essayage et remise effective. Une tâche peut être affectée,
  replanifiée et changer d'état depuis une modale.
- **Fiabilité du planning** : changements transactionnels, contrôle optimiste
  par `row_version`, motif obligatoire pour changement de date, annulation ou
  retour en arrière, historique dans `order_date_changes`, date de remise
  explicite `delivered_at`, quantité remise cohérente et audit serveur.
- **Style du planning** : indicateurs présentés comme les cartes du dashboard
  (`accent-1|2|3`, grands chiffres, `card-lift`) et surfaces fonctionnelles à
  contours arrondis.
- **Redirection administrateur** : après connexion, un membre de l'équipe Filéo
  arrive sur `/admin` au lieu de la route atelier inexistante `/creer-atelier`.
- **Back-office** : tableau de bord (recettes par devise, jamais mélangées),
  ateliers, validation des règlements avec prolongation d'abonnement (REC-17).
- **Migration MongoDB** : pilote officiel, pool partagé compatible avec le hot
  reload Next.js, repositories et actions entièrement asynchrones, transactions
  Atlas pour les écritures multi-collections, seed MongoDB, scripts de recette
  adaptés et outil ponctuel `db:migrate:sqlite`.

### Non fait, par ordre de priorité

1. **Vérification du téléphone (§7.1 AUTH-01)** — aucun fournisseur SMS retenu.
   Les comptes sont actifs dès la création. **Bloquant avant toute ouverture
   publique des inscriptions.**
2. **Formulaires de création** : commande. Les formulaires client et encaissement
   sont terminés et testés.
3. **Pages atelier manquantes** (la navigation y renvoie déjà, elles renvoient
   404) : paiements, dépenses, équipe, abonnement, paramètres. Le planning est
   désormais implémenté.
4. **Pages admin manquantes** : offres, contenus, tickets, audit.
   Les tickets créés par `/contact` s'accumulent en base sans écran pour les lire.
5. Photos et pièces jointes (§8.5), reçus et exports (§8.8).
6. Messages WhatsApp préremplis (§8.10) — `whatsappLink()` existe déjà dans
   `phone.ts`, sans interface.
7. API de synchronisation mobile (§10). La collection `sync_operations` et les
   champs `row_version` sont prévus par le modèle migré.
8. Compléter mentions légales, confidentialité et CGV : ce sont des **modèles**
   à faire valider juridiquement (§17.2).

### Scénarios de recette couverts

`npm.cmd run check:money` couvre REC-03, REC-05, REC-10, le plafonnement de la
réduction (§8.4), l'arithmétique entière (§15.3), les contraintes
d'idempotence (REC-04, REC-17) et la présence de `workshop_id` (§16).

`npm.cmd run check:clients` exécute un parcours HTTP authentifié complet :
création, modification, recherche, tris ascendant/descendant, pagination sur
deux pages, suppression logique et nettoyage des données temporaires.

`npm.cmd run check:orders` injecte temporairement onze commandes, vérifie les
pages 1 et 2 et restaure la base. `npm.cmd run check:planning` modifie réellement
une échéance, une affectation et un état, vérifie la remise, l'historique et
l'audit, puis restaure exactement l'article de démonstration.

`npm.cmd run check:payments` soumet le formulaire HTTP authentifié, vérifie le
mouvement confirmé, l'audit, la redirection, l'historique et rejoue exactement
la même opération pour garantir qu'aucun doublon n'est créé (REC-04).

`npm.cmd run check:smoke` couvre **REC-12** pour de bon : le collaborateur sans
droit financier reçoit la page des commandes sans la colonne « Reste à payer »
ni le montant dans le HTML. Il vérifie aussi que la page d'encaissement lui
renvoie 404, ainsi que les routes détail commande et les vues liste/jour/semaine
du planning pour le responsable et le collaborateur.

Validation de la conversion MongoDB : TypeScript, ESLint et vérification
syntaxique de tous les scripts réussis le 11 septembre 2026. Les recettes HTTP
et le build étaient intégralement verts avant la conversion. Ils doivent être
rejoués après alimentation de la base Atlas `fileo`.

Non couverts, car ils exigent des tests d'intégration ou le client mobile :
REC-08, REC-09, REC-11, REC-14 à REC-16, REC-19 à REC-24.

---

## 8. Base de données

MongoDB Atlas via le pilote officiel `mongodb`. La base logique par défaut est
`fileo` (`MONGODB_DB` permet de la remplacer). `src/lib/db/index.ts` mutualise
le client dans `globalThis`, configure le pool et crée les index uniques pour
les identifiants, téléphones, appartenances et clés d'idempotence.

En local, l'URI est lue depuis `atlas-credentials.env` si `MONGODB_URI` n'est
pas déjà définie. Ce fichier contient des secrets, est ignoré par Git et ne doit
jamais être affiché, commité ou poussé. `.env.example` ne contient qu'une URI
factice.

`npm.cmd run db:seed` et `db:reset` **suppriment puis recréent** la base Atlas
`fileo` avec les comptes et données de démonstration. Ne jamais les exécuter sur
une base contenant des données à conserver.

La base SQLite historique `data/fileo.db` reste locale comme sauvegarde.
`npm.cmd run db:migrate:sqlite -- --replace` peut transférer toutes ses tables
vers les collections Atlas, mais remplace le contenu distant et exporte des
données potentiellement sensibles. Au 11 septembre 2026, ce transfert n'a pas
été exécuté : il exige une autorisation explicite après présentation de ce
risque.

Conventions des documents :

- identifiants UUID sous forme de chaînes — stables entre appareils pour la synchronisation
- montants entiers en unité mineure + champ devise
- dates métier sous forme de chaînes ISO-8601
- `row_version` incrémenté à chaque écriture (préparation des conflits §10.3)
- `workshop_id` sur chaque document métier
- `clients.deleted_at` porte la suppression logique des clients
- `order_items.delivered_at` porte la remise effective, distincte de l'échéance
- `order_date_changes.order_item_id` rattache une replanification à l'article
  exact

---

## 9. Points de vigilance produit

Le cahier est explicite sur ce qu'il ne faut **pas** faire. Rappels :

- Ne jamais afficher de faux avis, chiffres clients inventés ou lien de
  téléchargement factice. Les drapeaux `appStores` de `site.ts` affichent
  « bientôt disponible » tant que les applications ne sont pas publiées (§6.2).
- Les tarifs de 2 500 FCFA et l'offre Pro à 5 000 FCFA concernent
  **le Congo-Brazzaville**. L'offre RDC n'est pas définie et ne doit pas être
  affichée comme validée (§2.3).
- Ne pas promettre « illimité » avant arbitrage sur les plafonds (§11.1).
- Filéo prépare un message WhatsApp, il ne peut jamais affirmer qu'il a été
  envoyé, reçu ou lu (§8.10).
- Un reçu ne doit pas se présenter comme une facture fiscalement conforme
  sans validation spécifique (§8.8).
- Les recettes Filéo ne se mélangent jamais aux encaissements des clients des
  tailleurs (§12.1).
