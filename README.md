# Filéo — web et back-office

> Votre atelier, bien organisé.

Solution de gestion pour les ateliers de couture : clients, mesures, commandes,
échéances et encaissements. Ce dépôt contient le **site public**, l'**espace
atelier** et le **back-office**. L'application mobile Expo est un chantier
distinct, prévu par le cahier des charges.

Implémentation de [`Fileo_Cahier_des_charges.md`](Fileo_Cahier_des_charges.md).
Les références `§x.y` dans le code renvoient à ses sections.

## Démarrer

```bash
npm install
npm run db:seed     # crée data/fileo.db et un jeu de démonstration
npm run dev         # http://localhost:3000
```

Comptes créés par le seed :

| Rôle | Téléphone | Mot de passe |
| --- | --- | --- |
| Responsable d'atelier | +242 06 111 11 11 | `Atelier2026!` |
| Collaborateur *(sans droit financier)* | +242 06 222 22 22 | `Atelier2026!` |
| Équipe Filéo (back-office) | +242 06 000 00 01 | `Fileo2026!` |

Le collaborateur sert à vérifier REC-12 : aucun montant ne doit lui être transmis.

## Vérifications

```bash
npm run check:money   # formules du §8.7 et contraintes de schéma
npm run check:smoke   # routes et permissions par rôle (serveur démarré)
npx tsc --noEmit
```

## Décisions structurantes

Cinq exigences du cahier sont coûteuses à rattraper après coup, donc elles sont
dans les fondations :

- **Montants** (§15.3) — entiers d'unité mineure + devise, jamais de flottant.
  L'exposant est par devise : XAF et CDF ont **0 décimale**, donc 2 500 FCFA
  est l'entier `2500`. Voir [`src/lib/money.ts`](src/lib/money.ts).
- **Registre en ajout seul** (§8.7) — un encaissement confirmé n'est jamais
  modifié ni supprimé : il est neutralisé par une contre-écriture motivée.
  Chaque écriture porte une clé d'idempotence.
- **Filtrage serveur** (§4.2) — « masquer un bouton ne suffit pas » : les champs
  financiers sont absents de la réponse, pas seulement du rendu.
- **Isolation** (§16) — `workshop_id` sur chaque table métier, portée forcée
  dans les dépôts.
- **Instantané de mesures** (§8.3) — les mesures sont copiées dans l'article,
  jamais référencées : modifier une fiche client ne change pas une commande.

## Structure

```
src/
├─ app/
│  ├─ (site)/        site public : accueil, mentions, CGV, confidentialité
│  ├─ (auth)/        connexion, inscription
│  ├─ atelier/       espace connecté du tailleur
│  ├─ admin/         back-office Filéo
│  └─ layout.tsx     thème, polices, script anti-flash
├─ components/
│  ├─ layout/        Navbar, Footer, Logo, ThemeToggle
│  ├─ sections/      sections du site public
│  ├─ app/           coquille des espaces connectés
│  └─ ui/            Icon, Reveal, SectionHeading, CookieBanner
└─ lib/
   ├─ db/            connexion + schema.sql (21 tables)
   ├─ auth/          mots de passe, sessions, gardes
   ├─ repos/         accès aux données par domaine
   ├─ actions/       Server Actions
   ├─ money.ts       arithmétique monétaire
   ├─ permissions.ts matrice du §4.2
   └─ audit.ts       journal des actions sensibles
```

## Base de données

SQLite via **`node:sqlite`**, intégré à Node 22+ : aucun module natif à
compiler. `better-sqlite3` exigerait node-gyp, donc les Build Tools Visual
Studio, indisponibles sur un poste où les installeurs MSI sont bloqués.

`node:sqlite` est encore marqué expérimental en amont. Le cahier prévoit
PostgreSQL en production (§15.2) : la bascule touche `src/lib/db/` et les
dépôts, pas les pages.

Les mots de passe utilisent **scrypt** de `node:crypto`, pour la même raison
que ci-dessus — bcrypt et argon2 sont natifs.

## État d'avancement

**Fait** — socle données et permissions, authentification et création
d'atelier, site public (tarifs et FAQ lus en base, donc éditables), tableau de
bord atelier, clients, commandes et détail de commande avec soldes, back-office
avec tableau de bord, ateliers et validation des règlements.

**À faire, par ordre de priorité :**

- [ ] **Vérification du téléphone** (§7.1 AUTH-01) — aucun fournisseur SMS
      retenu, les comptes sont actifs à la création. Bloquant avant toute
      ouverture publique des inscriptions.
- [ ] Formulaires de création : client, commande, encaissement.
- [ ] Pages atelier manquantes : planning, paiements, dépenses, équipe,
      abonnement, paramètres *(la navigation y renvoie déjà)*.
- [ ] Pages admin manquantes : offres, contenus, tickets, audit.
- [ ] Photos et pièces jointes (§8.5), reçus et exports (§8.8).
- [ ] Messages WhatsApp préremplis (§8.10).
- [ ] API de synchronisation mobile (§10) — les tables `sync_operations` et les
      colonnes `row_version` existent déjà.
- [ ] Compléter mentions légales, confidentialité et CGV : ce sont des modèles
      à faire valider (§17.2).
