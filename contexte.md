# Contexte de travail — Filéo

> Document de reprise. À lire en premier au début d'une nouvelle session.
> Dernière mise à jour : 23 septembre 2026.

**Branche active :** `feature/offline-sync`.

**Architecture active : Supabase.** L'historique MongoDB ci-dessous documente
une étape antérieure et ne doit plus être interprété comme l'architecture
d'exécution courante.

---

## Mise à jour du 23 septembre 2026 - synchronisation, UX mobile et paramétrage atelier

La branche `feature/offline-sync` poursuit la V1 mobile et web sur Supabase.
L'application repose toujours sur Supabase Auth, PostgreSQL Supabase et
Supabase Storage. MongoDB reste uniquement historique et ne doit pas être
considéré comme une dépendance runtime.

- **Synchronisation hors ligne mobile** : ajout d'une couche locale SQLite/KV
  pour conserver les réponses utiles, les clients, commandes, planning,
  opérations en attente, paiements et pièces jointes. Les mutations critiques
  peuvent être mises en file d'attente quand le serveur est indisponible, puis
  rejouées via `/api/mobile/v1/sync`. Les reçus serveur conservent l'historique
  des altérations et évitent de perdre les opérations locales.
- **Connectivité** : détection explicite de l'absence de serveur/réseau,
  timeouts d'API, cache de lecture pour `bootstrap`, clients, commandes,
  planning, agenda et FAQ. Les pages mobiles évitent désormais les longs
  blocages quand le serveur Next est arrêté. Les messages utilisateur ont été
  simplifiés : on évite d'exposer des détails techniques de synchronisation
  dans les confirmations métier.
- **Accueil mobile** : amélioration du mode clair, des états vides et erreurs,
  de l'action “Nouvelle commande” et des filtres de tuiles. Les compteurs
  “Aujourd'hui”, “En retard”, “Prêtes” et “Sous 7 jours” mènent à des vues
  réellement filtrées au lieu de filtrer seulement le résumé local.
- **Clients et commandes mobile** : états vides différenciés entre première
  utilisation et recherche sans résultat, accès à la création ou effacement des
  filtres selon le contexte. La création de commande conserve un brouillon,
  masque les champs non pertinents, déplace les montants à l'étape planning et
  garde la dernière étape comme récapitulatif. Les consignes sont facultatives.
- **Pièces jointes** : ajout/lecture/suppression de pièces jointes pour les
  commandes et les mensurations, avec file d'attente hors ligne côté mobile et
  endpoints serveur dédiés. Le détail web d'une commande affiche maintenant une
  prévisualisation des images jointes.
- **Encaissements et clôture** : enregistrement mobile d'un encaissement, suivi
  des paiements en attente, regroupement de la situation financière et de
  l'historique. La fiche commande mobile propose la clôture complète après
  vérification que les articles sont remis et que le solde est encaissé ; les
  actions Clôturer et Annuler sont regroupées.
- **Planning mobile** : simplification de l'écran planning avec deux filtres
  visibles, panneau de filtres avancés et résumé des filtres actifs. Côté API,
  la limite de planning volumineux est explicitée via pagination/limite pour
  éviter les faux “aucun résultat”.
- **Espace Plus mobile** : ajout des écrans profil, atelier, équipe,
  abonnement, thème, synchronisation, FAQ et À propos. La page À propos a été
  retravaillée pour raconter le produit, mentionner la version Expo et
  “Propulsé par NZELOBI”. La cloche/les badges inutiles ont été reliés à de
  vrais états de synchronisation ou retirés.
- **FAQ et support configurables** : modélisation des FAQ en base avec versions
  `fr`, `en` et `lg`, module d'administration web dédié, endpoint mobile avec
  langue et fallback `fr`. L'adresse support provient désormais d'une
  configuration unique réutilisée par le site, le mobile et la récupération de
  mot de passe.
- **Modèles d'articles et mensurations** : ajout de tables Supabase pour les
  types d'articles et modèles de mensurations par atelier, module web dans
  `/atelier/parametres`, endpoints mobiles et intégration dans la création de
  commande et les fiches clients. Les champs libres restent possibles, mais les
  modèles accélèrent la saisie et homogénéisent les données.
- **Unités de mesure par atelier** : ajout de `workshops.measurement_units_json`
  avec défaut `["cm","mm","m"]`. Les unités configurées alimentent les modèles,
  la création de commande web, les mensurations mobile et les paramètres
  mobiles. Dans `Plus > Paramètres`, le responsable dispose maintenant de deux
  sous-options : `Modèles` et `Unités de mesure`.
- **Sécurité et permissions** : les endpoints mobiles vérifient les capacités
  côté serveur. Les réglages de modèles et d'unités sont réservés au responsable
  de l'atelier via `templates.manage` ou le rôle owner selon l'endpoint.
- **Correctifs web récents** : correction de `crypto.randomUUID` côté client
  quand le site est ouvert par IP HTTP sur le réseau local ; la création de
  commande web fonctionne avec un fallback d'identifiant client. Correction du
  sélecteur de modèle afin que le libellé choisi ne reste pas bloqué sur
  “Saisie libre”.

**Vérifications récentes** :

- `npx.cmd tsc --noEmit` à la racine.
- `npm.cmd run typecheck` dans `appmobile`.
- Migration Supabase `20260923143000_workshop_measurement_units.sql` appliquée
  avec succès sur la base configurée.

**Points à surveiller** :

- Le module Dépenses existe dans la logique de permissions et le menu web peut
  le prévoir, mais le produit a décidé de garder cette fonctionnalité pour plus
  tard. Ne pas l'étendre maintenant sans nouvelle validation.
- Le dépôt contient beaucoup de changements non encore isolés par petits
  commits fonctionnels sur cette branche. Lors d'une reprise, vérifier `git
  status` avant toute refactorisation.

---

## Mise à jour du 21 septembre 2026 - application mobile

La branche `feature/mobile-api` contient désormais la refonte de l'application
Expo et l'extension de l'API mobile. Les sections historiques plus bas décrivent
des étapes antérieures ; en particulier, les références à une session MongoDB,
à des écrans mobiles de démonstration ou à un mode hors connexion ne décrivent
pas le fonctionnement actuel.

- **Base mobile et identité** : remise à plat de l'ancienne application Expo,
  identité Filéo alignée sur les couleurs du web, polices Inter et Outfit,
  thèmes clair/sombre, logo et splash natif. Le splash reste visible avant
  l'onboarding et la transition d'ouverture a été soignée. L'onboarding utilise
  une illustration bitmap et mène vers les écrans d'authentification.
- **Authentification** : connexion et inscription natives, navigation
  login/register sans accumulation d'écrans, persistance optionnelle de la
  session sur l'appareil, renouvellement des tokens et déconnexion avec
  révocation côté serveur. Supabase Auth reste le fournisseur d'identité ; le
  serveur Next.js continue de porter les règles métier et les permissions.
  Les routes mobiles couvrent aussi inscription, OTP, rafraîchissement de
  session et réinitialisation du mot de passe. Les OTP SMS ne peuvent pas être
  activés sans fournisseur SMS configuré sur le projet Supabase.
- **Accueil et navigation** : tableau de bord mobile alimenté par `bootstrap`,
  onglets Accueil, Clients, Commandes, Planning et Plus. Les écrans vides,
  chargements, erreurs et rafraîchissements ont été pris en compte.
- **Clients et mensurations** : liste avec recherche, filtres, tri et
  pagination ; création, modification, détail, archivage/restauration et
  suppression logique. Les relevés de mensurations sont gérés depuis la fiche
  client, avec pièces jointes et historique. Un client archivé est masqué par
  défaut mais conservé avec ses commandes.
- **Commandes** : liste, recherche, filtres, pagination et fiche détaillée.
  La création suit un wizard en quatre étapes (client, articles, planning et
  montants, récapitulatif). Dates natives, consignes facultatives, photos et
  fichiers sont pris en charge. La fiche permet le suivi des articles, les
  pièces jointes, l'enregistrement d'un encaissement, l'annulation et la
  clôture sous conditions : tous les articles remis et solde encaissé. Les
  chiffres et l'historique des encaissements sont dans une même section ; les
  actions Clôturer et Annuler sont réunies dans un même bloc.
- **Planning** : vue mobile des échéances et des retards, filtres et actions de
  mise à jour des articles. Les tuiles redondantes avec l'accueil ont été
  retirées.
- **Espace Plus** : profil modifiable (nom), atelier consultable et modifiable
  par le responsable (nom/ville), gestion paginée de l'équipe et de ses droits,
  consultation de l'abonnement et déclaration d'un paiement manuel, choix de
  thème mémorisé, FAQ mobile consultable sans réseau, page À propos, version
  issue de la configuration Expo et mention « Propulsé par NZELOBI ». La page
  À propos explique le suivi d'une commande et le travail en équipe. Le
  paiement MTN MoMo direct n'est pas encore proposé dans le mobile.
- **API et données** : les endpoints `/api/mobile/v1` utilisent les sessions
  Supabase, vérifient l'atelier et les capacités côté serveur, puis réutilisent
  les repositories PostgreSQL. Les ajouts couvrent notamment l'équipe,
  l'abonnement, le profil et l'atelier, la clôture de commande, le planning,
  l'archivage client et les pièces jointes. Supabase Storage héberge les
  fichiers. Les migrations récentes alignent les contenus et ajoutent les
  pièces jointes de mensurations. Aucun module runtime sous `src` ne dépend
  de MongoDB ; ses anciens fichiers sont conservés temporairement.

**Points de vigilance** : la FAQ historique du site contient encore des
réponses obsolètes sur MongoDB et le hors connexion. La FAQ mobile utilise
donc un contenu dédié et exact pour la V1. Les anciens scripts de contrôle
qui importent `scripts/mongodb.mjs` doivent être adaptés à Supabase avant
d'être réutilisés comme tests d'intégration.

**Vérifications effectuées** : TypeScript mobile et web, lint ciblé, export
Android Expo et requêtes PostgreSQL de lecture seule. Aucun test visuel final
sur appareil n'a été réalisé et aucun serveur Expo n'est laissé en marche.
Un build Next.js lancé le 21 septembre a compilé et passé le typage, puis a
échoué pendant la collecte des pages sur `/faq` (`PageNotFoundError`) alors
que le module compilé existe ; le manifeste `.next/server/app-paths-manifest`
était incomplet. Refaire un build dans un répertoire de sortie isolé ou avec
les autres processus Next arrêtés avant de conclure à une régression du code.

---

## Mise a jour Codex - 19 septembre 2026 - runtime Supabase

- Toute la couche applicative sous `src` utilise maintenant PostgreSQL
  Supabase : clients, mesures, commandes, planning, encaissements, dashboard,
  équipe, abonnements, administration, contenus, audit et métadonnées Storage.
- `src/lib/supabase/postgres.ts` fournit le pool PostgreSQL mutualisé, les
  requêtes paramétrées et les transactions.
- L'authentification web et mobile utilise Supabase Auth et les JWT Supabase.
- Les comptes historiques sont migrés progressivement au premier login :
  validation de l'ancien hash stocké dans `app_users`, création de l'identité
  Supabase Auth, liaison de `auth_user_id`, puis suppression du hash legacy.
- Le fournisseur téléphone est actuellement désactivé dans le projet Supabase
  (`phone_provider_disabled`). Une adresse technique interne dérivée du
  numéro sert donc d'identifiant Supabase Auth pour garder les connexions
  fonctionnelles. Les OTP SMS natifs nécessitent encore l'activation et la
  configuration d'un fournisseur SMS dans Supabase.
- MongoDB, `src/lib/db/index.ts` et les scripts Atlas sont conservés
  temporairement, à la demande du projet, mais aucun module runtime sous
  `src` ne les importe encore.
- Vérifications réalisées : TypeScript, build Next de production, connexion
  PostgreSQL Supabase, login d'un compte historique, API mobile et pages
  atelier principales.

---

## Mise a jour Codex - 15 septembre 2026 - Supabase

Branche active : `feature/supabase-migration`.

Objectif de l'etape : redessiner proprement le schema SQL cible avant de
commencer la migration MongoDB vers Supabase.

Travail realise :

- Ajout de `supabase/migrations/0001_initial_schema.sql`, premiere migration SQL
  cible pour Supabase/PostgreSQL.
- Ajout de `docs/supabase-schema.md`, note de conception qui explique les choix
  de modele.
- Le schema conserve `workshop_id` comme frontiere multi-tenant sur toutes les
  tables metier.
- Les identifiants restent en UUID pour faciliter la reprise des donnees
  MongoDB.
- Les montants restent des entiers avec devise separee.
- Les dates metier deviennent des colonnes `date`; les evenements et audits
  deviennent des `timestamptz`.
- La table `app_users` prepare le lien vers Supabase Auth via `auth_user_id`,
  tout en gardant une transition possible depuis les utilisateurs actuels.
- Les commandes sont normalisees en `orders`, `order_items`,
  `order_date_changes` et `financial_movements`.
- Les mesures par article sont materialisees dans
  `order_items.measurement_snapshot`, conformement a la decision produit V1.
- Les abonnements sont separes en `subscriptions`, `platform_payments` et
  `subscription_periods`. `subscription_periods` porte la file des periodes
  d'acces, ce qui evite qu'une offre Pro validee remplace une offre Essential
  encore active.
- Les fichiers a stocker dans Supabase Storage sont representes par
  `attachments`, avec rattachement possible aux clients, commandes, articles,
  encaissements ou paiements d'abonnement.
- Le schema active des politiques RLS de lecture basees sur l'appartenance a un
  atelier. Les ecritures restent volontairement cote serveur en V1.

Points ouverts :

- Choisir si la migration des comptes passe immediatement par Supabase Auth ou
  si `password_hash` reste temporairement utilise.
- Decider si les uploads Storage passent uniquement par le serveur ou par des
  URLs signees.
- Decider si les soldes de commande restent calcules par l'application ou s'ils
  deviennent des vues SQL/materialized views.

Etape suivante realisee : migration MongoDB vers Postgres preparee.

- Ajout du script `scripts/migrate-mongodb-to-postgres.mjs`.
- Ajout de la commande `npm.cmd run db:migrate:mongo-to-postgres`.
- Le script lit MongoDB Atlas, transforme les collections actuelles et insere
  les donnees dans les tables Supabase/Postgres dans l'ordre des dependances.
- Options disponibles :
  - `--dry-run` : lit Mongo et affiche les volumes sans ecrire dans Postgres.
  - `--apply-schema` : applique `supabase/migrations/0001_initial_schema.sql`
    avant l'import.
  - `--replace` : vide explicitement les tables cible avant l'import.
- Le script convertit de facon deterministe les identifiants non UUID vers des
  UUID Postgres afin de conserver les references entre documents.
- Les statuts Mongo historiques sont mappes vers les enums SQL :
  `trial` -> `trialing`, `renewal_due`/`suspended` -> `past_due`,
  `a_realiser` -> `todo`, `pret` -> `ready`, `en_cours` -> `in_progress`,
  `essayage` -> `fitting`.
- Les champs JSON (`limits_json`, `values_json`, `measurement_snapshot`,
  `body_json`, `provider_payload`, audit) sont parses vers `jsonb`.
- Les periodes d'abonnement sont reconstruites dans `subscription_periods`
  depuis les paiements valides portant `access_period_start` /
  `access_period_end`, ou depuis l'abonnement courant si aucune periode validee
  n'existe encore.
- Un dry-run a ete execute avec succes le 15 septembre 2026 :
  12 utilisateurs, 3 ateliers, 3 offres, 10 memberships, 15 clients,
  4 mesures, 3 abonnements, 11 commandes, 14 articles, 13 mouvements,
  9 paiements plateforme, 9 periodes d'abonnement, 12 contenus, 2 tickets
  et 112 entrees d'audit.
- Une tentative d'import reel avec `--apply-schema` a ete lancee, mais elle a
  echoue avant toute ecriture car l'hote renseigne dans `SUPABASE_DB_URL` ne se
  resout pas en DNS (`ENOTFOUND`). Le script accepte aussi
  `SUPABASE_POOLER_DB_URL` si l'URL pooler Supabase doit etre utilisee.
- Apres ajout de l'URL pooler Supabase, l'import reel MongoDB -> Supabase /
  Postgres a ete execute avec succes via :
  `npm.cmd run db:migrate:mongo-to-postgres -- --apply-schema --replace`.
- Correctifs apportes pendant l'import :
  - application du schema sans transaction imbriquee `begin/commit`,
  - reset controle du schema public Fileo quand `--apply-schema --replace` est
    utilise,
  - retrait de l'unicite SQL stricte sur `platform_payments.external_reference`
    car l'historique contient deja deux paiements valides avec la meme
    reference dans un atelier,
  - nettoyage des references optionnelles vers utilisateurs : si une ancienne
    valeur pointe vers un identifiant qui n'existe pas dans `app_users`, elle
    est migree a `null`.
- Verification Postgres apres import : les volumes importes correspondent au
  dry-run. Les periodes d'abonnement montrent bien Fileo Essential actif avant
  les periodes Fileo Pro planifiees pour Atelier Elegance.
- Le bucket Storage prive retenu est `fileo` au lieu de `fileo-private`.
- Debut du branchement Storage sur les fichiers de commande :
  - ajout du client serveur Supabase `src/lib/supabase/admin.ts`,
  - creation/verif automatique du bucket prive `fileo`,
  - ajout de `src/lib/repos/attachments.ts` pour uploader les fichiers dans
    Supabase Storage et conserver les metadonnees dans Mongo pendant la phase
    de transition,
  - ajout d'une section `Photos et notes` dans la creation de commande,
  - affichage des pieces jointes sur la page detail commande avec URLs signees
    temporaires,
  - index Mongo `attachments.id` et `attachments.workshop_id/order_id`.
- Test Storage reel effectue : upload d'un fichier de controle, creation d'une
  URL signee, puis suppression du fichier sur le bucket `fileo`.
- Optimisation UX/performance :
  - ajout de loaders Next.js sur les zones racine, site public, atelier et
    back-office,
  - composant commun `PageLoader` avec spinner et lignes skeleton,
  - parallelisation de la recuperation session/locale dans les layouts atelier
    et admin pour reduire un peu l'attente serveur.

---

## Mise a jour Codex - 15 septembre 2026 - API mobile

Branche active : `feature/mobile-api`, creee depuis `feature/supabase-migration`.

Objectif : preparer une API HTTP claire pour l'application mobile, sans
dupliquer la logique metier existante.

Travail realise :

- Ajout d'une API versionnee sous `/api/mobile/v1`.
- Auth mobile par token Bearer reutilisant la collection `sessions` actuelle :
  le web garde son cookie `fileo_session`, le mobile recoit un token dans
  `POST /api/mobile/v1/auth/login`.
- Ajout des routes :
  - `GET /api/mobile/v1` : index/version des endpoints.
  - `GET /api/mobile/v1/docs` : interface Swagger UI pour consulter et tester
    les endpoints.
  - `GET /api/mobile/v1/openapi.json` : specification OpenAPI 3.0.3.
  - `POST /api/mobile/v1/auth/login` : connexion mobile.
  - `POST /api/mobile/v1/auth/logout` : revocation de session.
  - `GET /api/mobile/v1/me` : utilisateur + atelier courant.
  - `GET /api/mobile/v1/bootstrap` : contexte + indicateurs dashboard.
  - `GET/POST /api/mobile/v1/clients`.
  - `GET/PATCH/DELETE /api/mobile/v1/clients/{id}`.
  - `GET/POST /api/mobile/v1/clients/{id}/measurements`.
  - `GET/POST /api/mobile/v1/orders`.
  - `GET /api/mobile/v1/orders/{id}`.
  - `GET/POST /api/mobile/v1/orders/{id}/attachments`.
  - `GET /api/mobile/v1/planning`.
  - `GET /api/mobile/v1/payments`.
  - `POST /api/mobile/v1/payments/record`.
- Ajout de `src/lib/mobile/api.ts` pour centraliser les reponses JSON, erreurs,
  parsing JSON, token Bearer, permissions et validations simples.
- Ajout de `src/lib/mobile/openapi.ts` pour documenter les endpoints mobiles,
  schemas principaux, exemples de payload et authentification Bearer.
- Extension de `src/lib/auth/session.ts` avec `createSessionToken`,
  `getSessionByToken` et `destroySessionToken`.
- Ajout du test HTTP `scripts/check-mobile-api.mjs` et de la commande
  `npm.cmd run check:mobile-api`. Le test verifie aussi que Swagger UI et la
  specification OpenAPI sont accessibles.
- Ajout du CORS mobile dans `src/middleware.ts` pour `/api/mobile/v1/*` :
  preflight `OPTIONS` en 204 et headers `Access-Control-Allow-*` sur les
  reponses API. Cela permet de tester le login depuis un navigateur ou depuis
  Expo Web sans erreur CORS.
- Initialisation de l'application Expo dans `appmobile/` :
  - projet `fileo-mobile` avec Expo Router et TypeScript,
  - ecran login connecte au client `/api/mobile/v1`,
  - onglets atelier : accueil, commandes, planning, clients, paiements,
  - structure `src/api`, `src/components`, `src/features`, `src/theme`,
    `src/types`,
  - variable `EXPO_PUBLIC_FILEO_API_URL` documentee dans
    `appmobile/.env.example`.
- Parcours d'ouverture mobile :
  - splash natif Expo et route `index` centres sur le mark Filéo seul,
  - passage automatique du splash vers `/onboarding`,
  - onboarding en 3 ecrans inspire de la reference fournie : retour, `Passer`,
    illustration centrale, titre, texte, dots et bouton rond,
  - illustrations onboarding refaites en SVG via `react-native-svg` pour un
    rendu plus net sur iPhone.
- Le `tsconfig.json` racine exclut `appmobile`, car l'application Expo possede
  son propre `tsconfig` et son propre `npm run typecheck`.

Validations executees :

```powershell
.\.tools\node\npx.cmd tsc --noEmit --pretty false
.\.tools\node\npm.cmd run lint
$env:BASE_URL='http://localhost:3000'; .\.tools\node\npm.cmd run check:mobile-api
cd appmobile; npm run typecheck
cd appmobile; npx expo install --check
```

Resultat : TypeScript, ESLint et le scenario API mobile sont verts. Le test
couvre login Bearer, me, bootstrap, creation/modification client, ajout mesure,
creation commande, detail commande, encaissement, liste paiements, planning et
logout, preflight CORS, Swagger/OpenAPI, avec nettoyage Mongo en fin de
scenario. Le typecheck Expo est vert.

---

## Mise a jour Codex - 12 septembre 2026

Branche active au moment du commit : `feature/abonnement-atelier`.

Travail realise dans cette session :

- Dashboard atelier : finalisation des modules **planning**, **paiements**,
  **equipe** et **abonnement**, avec interfaces inspirees du planning.
- Planning : table liste nettoyee, colonne planification simplifiee, retard
  colore, pagination en mode liste et vue semaine reprise pour une lecture plus
  compacte.
- Paiements atelier : page dediee avec indicateurs, liste paginee, filtres et
  actions coherentes avec le dashboard.
- Equipe atelier : table reconstruite, pagination, actions regroupees, switch
  actif/inactif, retrait avec confirmation, icone corbeille, limites
  d'abonnement appliquees lors de l'ajout/reactivation.
- Abonnement atelier : page `/atelier/abonnement`, formulaire unique de
  declaration de paiement manuel avec choix de l'offre, modales de succes et
  d'erreur, prevention des references deja soumises et des paiements multiples
  en attente sur une meme offre.
- Back-office reglements : validation/rejet avec modale de confirmation puis
  modale de resultat. La liste se rafraichit seulement apres fermeture de la
  modale de succes.
- File d'abonnement : chaque reglement valide porte maintenant une periode
  `access_period_start` / `access_period_end`. Une offre superieure validee
  n'ecrase plus l'offre courante si des echeances d'une offre precedente sont
  encore actives. L'offre courante est calculee a partir de la periode qui
  couvre la date du jour.
- Atelier Elegance (demo) a ete corrige localement apres les tests manuels :
  les echeances Fileo Essentiel courent jusqu'au 2026-12-12, puis les periodes
  Fileo Pro sont planifiees ensuite.
- Les limites du module equipe utilisent la meme notion d'offre courante que
  la page abonnement.
- Le formulaire abonnement a ete aere : espacement augmente entre les labels
  (`Montant paye`, `Moyen`, etc.) et les champs.
- Ajout du script `npm.cmd run check:subscriptions` pour tester la declaration
  manuelle, l'audit, la persistance et le refus de doublon de reference.

Validations executees :

```powershell
.\.tools\node\npx.cmd tsc --noEmit --pretty false
.\.tools\node\npm.cmd run lint
.\.tools\node\npm.cmd run check:subscriptions
```

Resultat : TypeScript, ESLint et le scenario abonnement sont verts.

---

## Mise a jour Codex - 12 septembre 2026 - commandes

Branche active : `feature/enregistrement-commandes`.

Travail realise :

- Ajout de la chaine complete de creation de commande depuis
  `/atelier/commandes/nouvelle` : choix du client, dates, articles dynamiques,
  instructions, reduction et acompte initial si l'utilisateur a le droit
  financier.
- La creation est transactionnelle : document `orders`, lignes `order_items`,
  eventuel mouvement `financial_movements`, audit `order.create` et audit
  `payment.record`.
- Decision produit sur les articles : en V1, les mesures sont saisies
  directement sur chaque article de commande, avec `work_type` (`creation` ou
  `retouche`), `wearer_name` optionnel et `measurement_snapshot`. Le
  client reste le dossier commercial/payeur, pas forcement la personne mesuree.
  `wearer_relation` et `quantity` restent techniques mais ne sont pas exposes
  dans le formulaire pour l'instant.
- La fiche commande affiche les mensurations rattachees a chaque article.
- Evolution possible plus tard : ajouter des profils "personnes a habiller"
  rattaches au client pour reutiliser les mesures, suivre leur historique et
  eviter les ressaisies. Cette evolution ne doit pas supprimer le snapshot sur
  l'article : une commande doit toujours conserver les mesures effectivement
  utilisees au moment de la fabrication.
- Ajout du script `npm.cmd run check:order-create` pour verifier le formulaire
  HTTP, la persistance, l'acompte, l'audit, les mensurations article et la fiche
  detail.
- UX de creation commande : les articles ne sont plus empiles sous forme de
  formulaires repetes. Un seul bloc prepare l'article, puis l'ajoute dans un
  tableau recapitulatif modifiable avant la creation finale.
- Les champs `instructions atelier`, `reduction` et `motif reduction` sont
  masques dans le formulaire de creation commande pour la V1. Le formulaire
  garde seulement le montant global, l'acompte et le reste a payer calcule en
  direct. Le montant global est calcule depuis les prix articles ; si aucun prix
  article n'est saisi, le montant global saisi en fin de formulaire est applique
  a la commande.
- UX client dans la creation commande : le formulaire garde un select de client
  simple, avec une action `+` a droite qui ouvre une modale de creation client.
  La modale prepare une fiche minimale qui sera creee inline a la soumission de
  la commande, sans quitter le flux.
- Apres creation d'une commande, le formulaire affiche une modale de succes avec
  un lien vers la fiche detail. La redirection automatique immediate a ete
  remplacee par cette confirmation utilisateur.

Validations executees :

```powershell
.\.tools\node\npm.cmd exec tsc -- --noEmit --pretty false
.\.tools\node\npm.cmd run lint
.\.tools\node\npm.cmd run check:order-create
```

Resultat : TypeScript, ESLint et le scenario creation de commande sont verts.

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
