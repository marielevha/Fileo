# Filéo — Cahier des charges fonctionnel et technique

**Signature :** Votre atelier, bien organisé.  
**Version :** 1.0 — 10 septembre 2026  
**Porteur du projet :** Mariel Evha ABIR  
**Marchés visés :** République du Congo et République démocratique du Congo, avec un premier déploiement envisagé à Brazzaville et Kinshasa.  
**Statut :** document de cadrage proposé, destiné à la conception, au chiffrage, au développement et à la recette. Les propositions identifiées comme telles ne constituent pas des décisions déjà validées.

## Sommaire

1. Présentation et objectifs
2. Décisions acquises et hypothèses
3. Périmètre et priorités
4. Utilisateurs et droits d’accès
5. Parcours utilisateurs
6. Site vitrine
7. Comptes et création d’atelier
8. Gestion de l’atelier
9. Application mobile Expo
10. Hors connexion et synchronisation
11. Abonnements Filéo
12. Back-office administrateur
13. Tutoriels et assistance
14. Ergonomie et identité visuelle
15. Architecture technique
16. Modèle de données
17. Sécurité, confidentialité et exploitation
18. Performances et compatibilité
19. Mesure du succès et hypothèses économiques
20. Recette et critères d’acceptation
21. Organisation, lots et livrables
22. Risques et arbitrages
23. Références et glossaire

## 1. Présentation et objectifs

### 1.1. Présentation

Filéo est une solution de gestion destinée aux ateliers de couture. Elle centralise les clients, leurs mesures, les modèles et tissus associés aux commandes, les échéances, l’avancement du travail et les paiements reçus.

La solution comprend un site public, un espace web « Mon atelier » donnant accès à l’ensemble des fonctions métier, une application Android et iOS développée avec Expo et un back-office réservé à l’équipe Filéo. Ces interfaces utilisent les mêmes données et les mêmes règles de gestion.

Le client final du tailleur n’a pas besoin de créer un compte ni d’installer une application.

### 1.2. Problèmes à résoudre

- Informations dispersées entre carnets, téléphone, messages et mémoire du tailleur.
- Mesures perdues, anciennes ou difficiles à retrouver.
- Confusions entre tissus, modèles et commandes.
- Dates promises difficiles à suivre lorsque les commandes s’accumulent.
- Acomptes et soldes insuffisamment documentés.
- Temps consacré à répondre aux demandes d’avancement.
- Faible visibilité sur la charge de travail et les encaissements.

Ces problèmes constituent les hypothèses de départ du projet. Leur fréquence et leur importance devront être confirmées pendant le pilote.

### 1.3. Objectifs produit

| Objectif | Résultat attendu |
| --- | --- |
| Centraliser les informations | Retrouver un client et son historique depuis le web ou le mobile |
| Fiabiliser les commandes | Associer chaque article aux bonnes mesures, photos et instructions |
| Suivre les engagements | Identifier les échéances proches et les retards |
| Suivre les paiements | Connaître les encaissements et le solde de chaque commande |
| Faciliter l’adoption | Réaliser les actions courantes sans formation longue |
| Réduire l’assistance répétitive | Accéder à une vidéo ou une aide depuis la fonction concernée |
| Permettre le travail avec un réseau intermittent | Enregistrer les opérations essentielles sur mobile, puis les synchroniser |

### 1.4. Positionnement

Filéo est un carnet d’atelier numérique assorti d’un suivi opérationnel et financier simple. La première version ne doit pas se transformer en logiciel de comptabilité générale, de paie ou de production industrielle.

## 2. Décisions acquises et hypothèses

### 2.1. Éléments retenus dans les échanges

- Nom de travail : **Filéo**, sous réserve de vérification de disponibilité.
- Site vitrine présentant la solution, ses offres, ses tarifs, une FAQ, les nouveautés et des vidéos de prise en main.
- Liens de téléchargement vers les applications Android et iOS.
- Espace web connecté permettant de gérer l’intégralité des fonctionnalités métier.
- Back-office pour les administrateurs Filéo.
- Application mobile développée avec **Expo** pour l’usage quotidien.
- Tutoriels vidéo par fonctionnalité afin de réduire le besoin d’accompagnement.
- Hypothèse commerciale étudiée : **2 500 FCFA par atelier et par mois**, avec un objectif initial de **45 ateliers payants**.

### 2.2. Propositions de cadrage

Les choix suivants sont proposés pour rendre le périmètre réalisable et chiffrable. Ils pourront être ajustés avant développement sans remettre en cause les décisions précédentes.

| Sujet | Proposition initiale |
| --- | --- |
| Langue | Français au lancement ; architecture permettant d’autres langues ultérieurement |
| Organisation | Un atelier par abonnement ; comptes individuels pour les membres |
| Offre pilote | Une offre mensuelle simple, sans catalogue complexe d’options |
| Essai | 14 jours, durée paramétrable, à confirmer |
| Moyens d’accès | Téléphone vérifié et mot de passe ; récupération par canal vérifié |
| Paiements des clients | Enregistrement manuel des encaissements, sans collecte par Filéo |
| Messages aux clients | Message WhatsApp prérempli, envoyé volontairement par le tailleur |
| Hors connexion | Fonctions essentielles sur mobile ; espace web connecté au lancement |
| Exploitation | Hébergement administré, sauvegardes et surveillance centralisées |

### 2.3. Adaptation aux deux pays

Les informations pays, indicatif téléphonique, fuseau horaire et devise doivent être explicites. Le tarif en FCFA étudié concerne le Congo-Brazzaville ; il ne doit pas être affiché comme un tarif local validé pour la RDC.

Prévoir une devise métier par atelier, avec les codes XAF, CDF et USD disponibles dans la configuration. Le choix effectif pour chaque marché, et les tarifs commerciaux correspondants, restent à confirmer. Aucun taux de change automatique ni total mélangeant plusieurs devises n’est prévu au lancement.

## 3. Périmètre et priorités

### 3.1. Règles de priorité

- **P0 — indispensable :** requis pour le lancement commercial de la première version complète.
- **P1 — évolution proche :** utile après validation du fonctionnement de base ; chiffrage séparé.
- **P2 — évolution ultérieure :** hors engagement initial.

Un pilote fermé peut utiliser une partie des fonctions P0 pour recueillir des retours. Il ne constitue pas la livraison complète.

### 3.2. Matrice de périmètre

| Domaine | P0 | P1 / P2 |
| --- | --- | --- |
| Site public | Présentation, tarifs, FAQ, nouveautés, tutoriels, téléchargement, contact | Contenus multilingues, campagnes avancées |
| Atelier web | Ensemble des fonctions métier de la V1 | Mode hors connexion web |
| Mobile | Android et iOS avec Expo ; fonctions métier de la V1 | Optimisations avancées par appareil |
| Clients | Fiches, recherche, historique, archivage | Import guidé de carnets ou fichiers |
| Mesures | Modèles de mesures, versions datées, copie dans les commandes | Suggestions et automatisation |
| Commandes | Plusieurs articles, photos, prix, échéances, avancement | Devis complexes, validation client en ligne |
| Planning | Liste et calendrier, échéances, affectation | Estimation automatique de capacité |
| Finance atelier | Acomptes, paiements, remboursements, soldes, dépenses simples, reçus et exports | Comptabilité, rapprochement bancaire |
| Communication | WhatsApp prérempli, alertes internes | Envoi automatique WhatsApp/SMS/push |
| Équipe | Responsable et collaborateurs, droits simples | Permissions sur mesure, multisite |
| Abonnement | Offre mensuelle, statut, échéances et validation des paiements | Autres offres et facturation avancée |
| Administration | Ateliers, utilisateurs, abonnements, contenus, assistance, audit | Analyses commerciales avancées |
| Hors connexion | Clients, mesures, commandes et encaissements sur mobile | Administration ou facturation hors connexion |

### 3.3. Hors périmètre initial

Marketplace de tailleurs, application client final, livraison, gestion détaillée de stock de tissus, paie, calcul fiscal, comptabilité réglementaire, création de patrons, mesures automatiques par photo, intelligence artificielle et encaissement des clients du tailleur par Filéo.

## 4. Utilisateurs et droits d’accès

### 4.1. Rôles

| Rôle | Accès |
| --- | --- |
| Visiteur | Site public, tutoriels publics et formulaire de contact |
| Responsable d’atelier | Toutes les données et fonctions de son atelier ; équipe et abonnement |
| Collaborateur | Clients, mesures, commandes, planning ; accès financier attribué explicitement |
| Support Filéo | Informations techniques de compte et tickets ; aucun accès automatique aux mesures ou photos |
| Gestionnaire de contenu Filéo | FAQ, tutoriels, actualités et contenus publics |
| Administrateur Filéo | Gestion opérationnelle de la plateforme dans les limites de ses habilitations |

Un utilisateur Filéo peut cumuler plusieurs rôles administratifs. La création des premiers administrateurs suit une procédure contrôlée ; l’inscription publique ne donne jamais ces droits.

### 4.2. Matrice minimale des permissions

| Action | Responsable | Collaborateur standard | Collaborateur avec droit financier | Équipe Filéo |
| --- | --- | --- | --- | --- |
| Lire/créer/modifier clients et mesures | Oui | Oui | Oui | Seulement accès d’assistance autorisé |
| Créer une commande et modifier son avancement | Oui | Oui | Oui | Seulement accès d’assistance autorisé |
| Voir/modifier les prix et paiements | Oui | Non | Oui | Selon habilitation d’assistance |
| Annuler une commande ou corriger un paiement | Oui | Non | Non | Pas en fonctionnement normal |
| Exporter l’ensemble des données atelier | Oui | Non | Non | Pas en fonctionnement normal |
| Gérer membres, abonnement et suppression atelier | Oui | Non | Non | Gestion administrative tracée selon procédure |
| Publier les contenus du site | Non | Non | Non | Gestionnaire de contenu habilité |

Les contrôles sont effectués par le serveur, y compris pour les fichiers, recherches, exports et synchronisations. Masquer un bouton ne suffit pas. Les champs financiers ne sont pas transmis aux utilisateurs qui n’ont pas le droit de les consulter.

## 5. Parcours utilisateurs

### 5.1. Découverte et première utilisation

1. Le visiteur consulte les fonctionnalités, le prix applicable à son pays et une démonstration.
2. Il crée son compte, vérifie son téléphone et renseigne son atelier.
3. Il choisit sa devise et découvre un guide court.
4. Il crée son premier client puis une commande.
5. Il installe l’application mobile et retrouve l’atelier avec le même compte.

Les données de démonstration, si utilisées, sont identifiées et séparées des données réelles.

### 5.2. Enregistrement d’une commande

1. Rechercher un client ou créer une fiche minimale.
2. Ajouter un ou plusieurs articles : robe, pantalon, ensemble ou catégorie personnalisée.
3. Photographier le tissu et le modèle ; ajouter les instructions utiles.
4. Sélectionner des mesures existantes ou en saisir de nouvelles.
5. Définir les prix, la date promise et, si nécessaire, un essayage.
6. Enregistrer l’acompte réellement reçu.
7. Valider la commande et proposer un récapitulatif partageable.

### 5.3. Travail quotidien et remise

Le tailleur ouvre les commandes à traiter, consulte les informations de chaque article, met à jour l’avancement et signale les tenues prêtes. Il prépare un message client, enregistre les encaissements puis la remise effective. Une tenue remise avec un solde restant apparaît dans les impayés.

### 5.4. Retour d’un client

Le tailleur retrouve l’historique, vérifie la date des mesures et crée une nouvelle version si nécessaire. Une nouvelle commande peut reprendre les informations d’une ancienne, mais ses échéances, paiements et statuts sont réinitialisés.

## 6. Site vitrine

### 6.1. Arborescence minimale

| Page | Contenu attendu |
| --- | --- |
| Accueil | Promesse, aperçu produit, bénéfices concrets, accès inscription et téléchargement |
| Fonctionnalités | Clients, mesures, commandes, planning, paiements, équipe et fonctionnement mobile/web |
| Offres et tarifs | Pays/devise, prix et période, fonctions incluses, limites éventuelles, conditions de l’essai |
| Prise en main | Tutoriels classés par tâche et moteur de recherche |
| FAQ | Compte, tarifs, paiements, appareils, connexion, données et assistance |
| Nouveautés | Articles datés, fonctions disponibles, supports concernés |
| Télécharger | Liens officiels Android/iOS et QR codes associés |
| Contact | Formulaire, coordonnées d’assistance publiées et horaires lorsqu’ils sont définis |
| Connexion / inscription | Accès au compte et récupération |
| Informations légales | Identification de l’éditeur, conditions et confidentialité validées avant publication |

### 6.2. Exigences publiques

- Affichage adapté au téléphone, à la tablette et à l’ordinateur.
- Pas de faux avis, chiffres clients inventés ou promesses de disponibilité non tenues.
- Afficher « bientôt disponible » si une application n’est pas encore publiée ; aucun lien de téléchargement factice.
- Titres, descriptions, sitemap et indexation des pages publiques ; pages privées exclues de l’indexation.
- Images optimisées, lecture des vidéos déclenchée volontairement et aucun démarrage automatique lourd.
- Protection du formulaire contre les abus ; retour clair après envoi réussi ou échoué.
- Tous les prix, limites et conditions affichés doivent correspondre à l’offre réellement attribuée lors de la souscription.
- Gestion éditoriale par le back-office avec brouillon, aperçu et publication.

## 7. Comptes et création d’atelier

### 7.1. Compte utilisateur

**AUTH-01 — Inscription.** Nom, téléphone avec indicatif, mot de passe et acceptation des conditions applicables. Email facultatif tant qu’il n’est pas utilisé comme seul moyen de récupération. Vérification du téléphone avant activation ; fournisseur et coût des codes à sélectionner.

**AUTH-02 — Connexion.** Même identité sur web et mobile, erreurs compréhensibles, limitation des tentatives, gestion sécurisée des sessions. Les comptes et mots de passe ne sont jamais partagés entre collaborateurs.

**AUTH-03 — Récupération.** Réinitialisation par canal préalablement vérifié. Un changement de téléphone exige une vérification renforcée ; l’assistance ne remet pas un compte sur simple déclaration.

**AUTH-04 — Appareils.** Consulter les sessions actives et révoquer un appareil. Déconnexion globale après compromission ou réinitialisation sensible. Décrire la limite de révocation lorsque le téléphone reste hors connexion, conformément à la section 10.

**AUTH-05 — Suppression.** Permettre de demander la suppression du compte, préciser les conséquences et traiter le cas d’un responsable disposant d’un atelier actif ou de collaborateurs.

### 7.2. Atelier

Champs : nom, responsable, pays, ville, téléphone, devise, fuseau horaire, adresse facultative, logo facultatif et message de reçu facultatif. Les changements de devise ne doivent jamais convertir silencieusement des montants existants. Après la première transaction, tout changement doit suivre une migration contrôlée ou être bloqué en V1.

### 7.3. Équipe

Le responsable invite un collaborateur, attribue ses droits et peut le désactiver. Invitation à durée limitée et liée au destinataire. La désactivation bloque les nouveaux accès serveur sans supprimer l’auteur historique de ses opérations. Le transfert de propriété exige une confirmation sécurisée et conserve au moins un responsable actif.

## 8. Gestion de l’atelier

### 8.1. Tableau de bord — AT-01

Afficher selon les droits : commandes à livrer aujourd’hui, échéances des sept prochains jours, retards, articles prêts non remis, soldes restant à encaisser et encaissements de la période. Chaque indicateur ouvre la liste correspondante.

Un retard signifie qu’une date promise est dépassée et que l’article n’est ni remis ni annulé. Il s’agit d’un indicateur calculé, pas d’un statut qui efface l’avancement. Les totaux excluent les éléments annulés selon les règles financières ci-dessous et sont toujours accompagnés de leur devise.

### 8.2. Clients — AT-02

- Créer, consulter, modifier, rechercher et archiver un client.
- Champs : nom ou appellation obligatoire, téléphone conseillé, autre contact facultatif, notes utiles et date de création.
- Autoriser une fiche sans téléphone pour ne pas bloquer une commande ; le partage direct est alors indisponible.
- Rechercher par nom, téléphone normalisé ou référence.
- Avertir d’un possible doublon sans interdire les téléphones partagés par une famille.
- Afficher commandes, mesures, encaissements et solde global selon les permissions.
- Pour un enfant, permettre un contact parent/tuteur distinct sans imposer de collecter une date de naissance.
- Archiver sans casser l’historique ; la suppression définitive suit une procédure distincte.

### 8.3. Mesures — AT-03

Prévoir des modèles par type de vêtement : haut, pantalon, robe, ensemble, personnalisé. Exemples de champs : épaules, poitrine, taille, bassin, longueur de manche, tour de bras, longueur totale et entrejambe. Le responsable peut ajouter des champs ; tous ne sont pas obligatoires pour chaque vêtement.

- Unité initiale : centimètre, affichée explicitement ; saisie décimale acceptée.
- Une valeur absente reste vide et ne devient pas zéro.
- Contrôle des valeurs négatives et avertissement pour les valeurs incohérentes.
- Chaque relevé possède une date, un auteur, des notes et une version.
- La modification crée une nouvelle version consultable.
- Chaque article conserve un instantané des mesures utilisées : une modification de la fiche client ne change pas une commande existante.
- Distinguer mesure du corps, aisance et ajustement souhaité lorsque ces informations sont saisies.
- Avertissement proposé lorsque le relevé a plus de six mois ; ce seuil est paramétrable et ne remplace pas la vérification par le tailleur.

### 8.4. Commandes — AT-04

Une commande appartient à un client et contient au moins un article. Champs : identifiant stable, référence lisible, date, client, devise de l’atelier, articles, instructions, date promise, essayages facultatifs, responsable du suivi et auteur.

Chaque article possède une catégorie, une description, une quantité, un prix unitaire, des photos de tissu et de modèle identifiées séparément, un instantané des mesures, un collaborateur affecté facultatif, son échéance et son avancement. Un ensemble peut être un article composé avec notes ou plusieurs articles si les pièces doivent être suivies séparément.

Le système calcule les totaux. La réduction éventuelle s’applique à la commande, avec un montant et une justification ; elle ne peut rendre le total négatif. Les modifications de prix après acompte sont réservées au responsable et historisées.

**Statuts des articles :** à réaliser → en cours → à essayer, si nécessaire → prêt → remis. Un article peut être annulé ; un retour à une étape précédente exige un motif. Les remises partielles sont enregistrées par article ou quantité remise.

L’état global de la commande est dérivé : nouvelle, en cours, prête, partiellement remise, remise ou annulée. Une commande dont tous les articles non annulés sont remis est « remise ». Elle peut rester financièrement impayée.

Les changements de date conservent ancienne date, nouvelle date, auteur et motif. Annuler une commande ne supprime ni les encaissements ni les remboursements ; un montant à restituer doit être signalé.

### 8.5. Photos et pièces jointes — AT-05

Prise de photo, import depuis la galerie, aperçu et suppression autorisée. Proposition de limites techniques : dix images par article et 10 Mo maximum par image entrante ; compression avant transfert pour viser 500 Ko par image, sans rendre les détails illisibles. Les limites définitives seront vérifiées pendant le pilote et affichées.

Les images restent privées, sont rattachées au bon atelier et ne sont pas accessibles par une URL publique permanente. Le chargement différé des photos ne bloque pas l’accès au texte d’une commande. Les originaux volumineux ne sont pas conservés sans besoin explicite.

### 8.6. Planning — AT-06

Vues liste, jour et semaine, avec filtres par collaborateur et état. Distinguer essayage, date promise et remise effective. Trier par urgence puis échéance. Le calendrier présente des informations sans dépendre uniquement des couleurs.

La V1 alerte sur les échéances ; elle ne promet pas de calculer automatiquement la capacité réelle d’un atelier. Des seuils simples de commandes quotidiennes pourront être étudiés en P1.

### 8.7. Paiements clients — AT-07

Cette fonction suit l’argent reçu par l’atelier. Elle est distincte du paiement de l’abonnement Filéo.

Chaque encaissement comporte : commande, montant strictement positif, devise, date effective, moyen déclaré, référence facultative, auteur et identifiant unique. Moyens configurables : espèces, mobile money, virement ou autre. Un enregistrement manuel n’atteste pas une vérification auprès d’un opérateur.

Règles de calcul :

```text
Total commande = somme des lignes non annulées − réduction applicable
Encaissement net = paiements confirmés − remboursements confirmés
Solde signé = total commande − encaissement net
Reste à payer = maximum(solde signé, 0)
Trop-perçu à traiter = maximum(−solde signé, 0)
```

- Paiements fractionnés autorisés ; l’acompte est un premier encaissement.
- Pas de modification destructive d’un encaissement confirmé : contre-écriture avec motif, puis nouvelle écriture si nécessaire.
- Le remboursement référence la commande et les encaissements concernés ; il ne dépasse pas le montant disponible à rembourser.
- Les paiements en attente de synchronisation sont identifiés comme tels et ne sont pas présentés comme confirmés par le serveur.
- Les doublons de transmission ne créent jamais deux encaissements.
- Un trop-perçu concurrent est conservé et signalé, sans être transformé silencieusement en revenu supplémentaire.
- La remise avec solde est autorisée après confirmation d’un utilisateur habilité et reste visible dans les créances.

### 8.8. Reçus et exports — AT-08

Produire un reçu d’encaissement téléchargeable et partageable avec atelier, référence, commande, date, montant reçu, cumul et solde. Le reçu ne doit pas se présenter comme une facture fiscalement conforme sans validation spécifique.

Un reçu définitif est émis après confirmation serveur. Hors connexion, un justificatif provisoire indique clairement son statut. Les références définitives sont uniques par atelier ; les annulations restent traçables.

Exports réservés au responsable : clients et mesures en CSV, commandes et mouvements en CSV, récapitulatif individuel en PDF. Prévoir une exportation complète avec manifeste et pièces jointes pour la réversibilité ; son traitement peut être asynchrone avec lien privé expirant.

### 8.9. Dépenses et synthèse simple — AT-09

Enregistrer une dépense : date, libellé, catégorie, montant, moyen, pièce jointe facultative. Présenter séparément valeur des commandes, encaissements, remboursements, dépenses et créances.

« Encaissements nets − dépenses saisies » est un solde simplifié de trésorerie, pas un bénéfice comptable. Les dépenses ne constituent pas une comptabilité complète et ne génèrent pas de calcul fiscal.

### 8.10. Communication — AT-10

Boutons de préparation de messages : confirmation, essayage, tenue prête et rappel de solde. Le tailleur peut modifier le texte et vérifie le destinataire avant l’envoi.

En P0, Filéo prépare un message et ouvre le canal choisi ; il ne peut pas affirmer que le message a été envoyé, reçu ou lu. Sans WhatsApp disponible, proposer de copier le texte. L’historique indique « message préparé » et sa date.

Les envois automatiques P1 nécessitent une intégration officielle, un modèle de coûts, la gestion des préférences et un suivi réel des statuts fournis par le prestataire. Aucune automatisation par simulation de clics n’est prévue.

## 9. Application mobile Expo

### 9.1. Fonctions et navigation

Application Android et iOS basée sur Expo et React Native. Expo est une contrainte retenue ; le choix des versions doit être figé au démarrage. Expo permet un projet JavaScript/TypeScript destiné notamment à Android et iOS ; les livraisons sur stores doivent suivre une procédure de compilation et de soumission. [Documentation Expo](https://docs.expo.dev/)

Navigation proposée : **Accueil**, **Commandes**, **Clients**, **Planning**, **Plus**. Le menu Plus contient paiements, dépenses, équipe, paramètres, abonnement, tutoriels et assistance selon les droits.

Toutes les fonctionnalités métier P0 accessibles sur le web doivent aussi être utilisables dans l’application. Les fonctions publiques éditoriales et le back-office restent sur le web. Les parcours d’achat d’abonnement peuvent différer selon les exigences des stores, sans changer les droits métier obtenus.

### 9.2. Comportement attendu

- Appareil photo et galerie, avec demande de permission au moment utile.
- Saisie téléphonique et numérique adaptée aux champs.
- Enregistrement local fiable et reprise après fermeture inattendue.
- Indication visible de la connexion et de la synchronisation.
- Partage des reçus et messages via les possibilités du téléphone.
- Tutoriels lisibles dans l’application ; téléchargement volontaire pour consultation hors connexion.
- Ne pas demander l’accès global au carnet d’adresses pour saisir un téléphone.
- En cas de permission refusée, expliquer comment poursuivre ou autoriser l’accès ; l’application ne doit pas planter.
- Compilations de test installables sur appareils réels ; Expo Go ne constitue pas le livrable de production.

## 10. Hors connexion et synchronisation

### 10.1. Périmètre

| Opération | Hors connexion mobile |
| --- | --- |
| Consulter les clients et commandes déjà synchronisés | Oui |
| Créer un client, des mesures ou une commande | Oui |
| Modifier une commande et ajouter des photos | Oui, stockage local et transfert différé |
| Saisir un encaissement | Oui, provisoire jusqu’à validation serveur |
| Consulter les vidéos téléchargées | Oui |
| Première connexion, récupération de compte | Non |
| Gérer droits, abonnement, suppression définitive | Non |
| Émettre un reçu définitif ou lancer un export complet | Non |
| Envoyer un message distant | Dépend de la connexion et de l’application de messagerie |

Les informations jamais téléchargées ne sont pas accessibles hors connexion. Le téléphone indique la date de dernière synchronisation. Il avertit que des opérations locales non synchronisées ne sont pas encore sauvegardées sur le serveur.

### 10.2. Mécanisme requis

Base locale persistante sur mobile, file d’opérations durables, identifiant unique par opération, version par enregistrement et validation transactionnelle côté serveur. `expo-sqlite` constitue une option pour la persistance locale ; sa documentation décrit une base conservée entre redémarrages. La synchronisation et les conflits restent à développer. [Documentation Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)

États visibles : enregistré sur cet appareil, synchronisation en cours, synchronisé, conflit et échec nécessitant une action. L’application réessaie après retour du réseau et au premier plan, sans dépendre exclusivement d’une exécution en arrière-plan.

Synchroniser les entités parentes avant leurs dépendances ; une photo qui échoue ne doit pas empêcher la conservation du client ou de la commande. Reprise progressive des fichiers avec limite de concurrence et tentatives espacées.

### 10.3. Conflits

- Toute modification envoie la version connue de l’enregistrement.
- Si deux appareils modifient la même commande, aucun écrasement silencieux de prix, mesures, échéances ou statut.
- Présenter la version serveur et la version locale à un utilisateur habilité pour résolution ; conserver l’historique.
- Les champs distincts ne sont fusionnés automatiquement que si une règle explicite et testée le permet.
- Les mouvements financiers sont ajoutés, pas fusionnés par remplacement de total.
- Les actions d’annulation et de remboursement contradictoires exigent une résolution.
- Les suppressions sont représentées par une trace synchronisable afin d’éviter la réapparition d’un objet effacé.

### 10.4. Sessions, expiration et données locales

Proposition : autorisation de travail local limitée à sept jours depuis la dernière validation serveur, à ajuster au pilote. Passé ce délai, consultation locale et conservation des opérations en attente, mais nouvelle connexion requise pour poursuivre les modifications.

Une révocation serveur ne peut pas effacer instantanément un appareil sans réseau ; cette limite doit être documentée. Au retour du réseau, les opérations sont soumises aux permissions actuelles. Les écritures rejetées sont conservées dans un état de récupération, sans être intégrées silencieusement ; le responsable peut les reprendre par un parcours contrôlé.

L’expiration d’un abonnement ne doit pas détruire les opérations légitimes restées en attente. Une voie de synchronisation de récupération doit les préserver tout en bloquant les nouvelles modifications non autorisées.

La déconnexion avertit de toute donnée non synchronisée et propose la synchronisation ou la conservation sécurisée sous le compte concerné. Aucun autre compte ne peut la consulter. La désinstallation peut faire perdre les opérations jamais synchronisées ; une alerte doit expliquer ce risque avant une procédure de dépannage qui l’exigerait.

## 11. Abonnements Filéo

### 11.1. Offre initiale

Hypothèse étudiée : un abonnement mensuel par atelier à 2 500 XAF au Congo-Brazzaville, donnant accès au web et aux applications. Les plafonds de collaborateurs, stockage et commandes doivent être fixés après mesure des coûts ; ne pas promettre « illimité » avant arbitrage. Le tarif pour la RDC reste à définir.

Le site et les applications doivent indiquer le prix applicable, la période, les fonctions incluses, les limites, le renouvellement et les conditions de résiliation. Déterminer avant commercialisation si le prix annoncé inclut les taxes applicables.

### 11.2. Cycle de vie proposé

États : essai, actif, renouvellement attendu, délai de grâce, expiré, suspendu. Une résiliation planifiée est distincte d’une expiration immédiate et conserve l’accès jusqu’à la fin de la période payée.

Proposition : essai de 14 jours et délai de grâce de 7 jours. Après expiration, passage en lecture seule, accès aux données et export pendant une durée proposée de 90 jours. Aucun effacement automatique à la seule expiration ; appliquer ensuite une politique de conservation validée et des notifications préalables. Une suspension pour sécurité suit une procédure différente et peut restreindre l’accès.

Les renouvellements ajoutent une période à l’échéance existante s’ils interviennent avant expiration ; après expiration, ils repartent de la date d’activation. Définir le mois calendaire et le traitement des fins de mois ; ne pas confondre systématiquement un mois et 30 jours.

### 11.3. Paiement et validation

Deux niveaux à chiffrer séparément :

- **P0 :** enregistrement d’un règlement externe par référence, puis validation par un administrateur habilité après rapprochement réel. Une capture d’écran seule n’active pas automatiquement l’abonnement.
- **P1 :** prestataire de paiement intégré, sous réserve de disponibilité commerciale dans les pays visés, contrat, frais et compatibilité avec les canaux de distribution.

Toute intégration doit gérer notifications serveur authentifiées, répétitions, paiement échoué, montant ou devise incorrects, remboursement et rapprochement. Aucun succès ne se fonde uniquement sur le retour du navigateur.

### 11.4. Distribution et règles des stores

Le parcours d’achat mobile est un point de validation avant publication. Les achats intégrés et liens vers un paiement externe font l’objet de règles spécifiques chez Apple et Google, dont les exceptions dépendent du contexte. La solution ne doit pas supposer qu’un paiement web ou mobile money peut être proposé sans examen dans toutes les versions mobiles. Le développeur doit documenter le parcours retenu et ses conditions, puis vérifier les règles au moment de soumettre l’application. [Apple — App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), [Google Play — Payments](https://support.google.com/googleplay/android-developer/answer/9858738)

L’accès par un compte disposant déjà d’un abonnement et l’éventuelle souscription dans l’application doivent être distingués. Aucune approbation des stores n’est garantie par le présent document.

## 12. Back-office administrateur

### 12.1. Tableau de bord — ADM-01

Ateliers inscrits, activés et payants, essais en cours, expirations proches, recettes Filéo effectivement encaissées, tickets ouverts et incidents techniques. Filtrer par période et pays ; séparer les devises. Les recettes Filéo ne doivent pas inclure les encaissements des clients des tailleurs.

### 12.2. Ateliers et utilisateurs — ADM-02

Rechercher un atelier, consulter ses métadonnées et son abonnement, gérer une suspension motivée, réactiver, inviter ou désactiver les comptes selon habilitation. Toute action sensible conserve auteur, date, motif et valeurs avant/après.

Pas de consultation générale des photos ou mesures depuis le tableau de bord. Si un diagnostic métier l’exige, créer un accès d’assistance temporaire, autorisé par le responsable, limité et audité. Pas d’usurpation invisible d’un utilisateur.

### 12.3. Offres et règlements — ADM-03

Créer une offre avec pays, devise, montant, période, limites et date d’effet. Archiver une offre sans altérer rétroactivement les abonnements existants. Les conditions acceptées lors de la souscription restent consultables.

Valider les paiements externes, enregistrer un rejet motivé, attribuer une prolongation exceptionnelle avec motif et suivre les remboursements. Les changements de tarifs pour les clients existants exigent une règle de préavis à définir.

### 12.4. Contenus — ADM-04

Gérer pages publiques, FAQ, tutoriels, miniatures, transcriptions, actualités et liens vers les stores. Champs : titre, URL lisible, contenu, langue, état brouillon/publié, date et auteur. Prévisualisation et assainissement du contenu riche avant affichage. Publication réservée aux rôles habilités.

### 12.5. Assistance et exploitation — ADM-05

Tickets avec atelier, catégorie, description, pièce jointe facultative, responsable et états ouvert/en cours/en attente/résolu. Accès aux diagnostics techniques nécessaires sans collecter inutilement mesures ou photos.

Afficher erreurs de synchronisation, échecs de transfert et incidents de facturation. Aucun bouton de maintenance ne doit permettre une suppression globale sans confirmation renforcée et journalisation.

## 13. Tutoriels et assistance

### 13.1. Bibliothèque initiale

Une vidéo courte par tâche, objectif de 30 à 60 secondes lorsque cela suffit : créer son atelier ; ajouter un client ; prendre et actualiser des mesures ; créer une commande ; ajouter des photos ; enregistrer un acompte ; consulter le planning ; mettre à jour l’avancement ; prévenir un client ; enregistrer le solde et remettre une tenue ; travailler sans réseau ; renouveler l’abonnement ; gérer un collaborateur ; exporter les données.

### 13.2. Exigences pédagogiques

- Accès depuis le site, l’application et le bouton d’aide de l’écran concerné.
- Exemple réaliste et anonymisé, consignes simples en français.
- Sous-titres et transcription écrite courte ; compréhension possible sans son.
- Vidéos compressées, poids annoncé avant téléchargement, pas de lecture automatique.
- Cache après téléchargement volontaire, suppression possible pour libérer de l’espace.
- Référence à la version de l’interface ; retirer ou actualiser les vidéos devenues trompeuses.
- FAQ contextuelle et recherche par tâche.

### 13.3. Assistance humaine

Formulaire accessible depuis le web et le mobile. Catégories : compte, abonnement, commande, paiement atelier, synchronisation et autre. Un canal WhatsApp d’assistance peut être publié après définition d’un numéro et d’horaires. Ne pas annoncer de disponibilité permanente sans organisation correspondante.

Les demandes récurrentes doivent alimenter la simplification de l’interface et la création de tutoriels. Le succès se mesure par les tâches accomplies et la baisse des demandes répétées, pas uniquement par les vues des vidéos.

## 14. Ergonomie et identité visuelle

### 14.1. Principes

Interface sobre, lisible et adaptée au travail au comptoir. Employer « Ajouter un client », « Acompte reçu », « Reste à payer » et « Tenue prête ». Éviter les termes techniques dans les parcours métier.

Boutons tactiles suffisamment grands, typographie lisible, contraste adapté, navigation clavier sur web, libellés pour lecteurs d’écran, focus visible et erreurs associées aux champs. Objectif de conception : accessibilité de niveau AA pour les parcours principaux, à évaluer lors de la recette.

Afficher toujours les états vide, chargement, succès, erreur, absence de réseau et permission refusée. Préserver les données saisies après erreur. Demander confirmation avant annulation, suppression ou opération financière sensible.

### 14.2. Écrans à maqueter

Site : accueil, fonctionnalités, tarifs, FAQ, tutoriels, nouveauté, téléchargement, contact et connexion. Atelier : accueil, liste/fiche client, mesures, liste/fiche/formulaire commande, planning, paiements, dépenses, reçu, équipe, paramètres, abonnement, aide et synchronisation. Administration : tableau de bord, ateliers, détail abonnement, paiements, contenus, tickets et audit.

Livrer les variantes web ordinateur et mobile natif, ainsi que les états d’erreur et hors connexion. Le logo, les couleurs et les polices restent à concevoir ; le nom Filéo ne préjuge pas d’une identité graphique déjà validée.

## 15. Architecture technique

### 15.1. Principes obligatoires

- Serveur métier et base de données communs au web et au mobile.
- Isolation stricte des ateliers et permissions centralisées.
- API documentée et versionnée ; aucune clé d’administration dans les applications.
- Stockage privé des fichiers distinct des données relationnelles.
- Traitements asynchrones pour exports, vidéos et intégrations lentes.
- Environnements de développement, préproduction et production séparés.
- Déploiement reproductible, migrations contrôlées et retour arrière documenté.

### 15.2. Choix techniques proposés, hors contrainte Expo

| Composant | Proposition à confirmer lors du cadrage technique |
| --- | --- |
| Mobile | Expo / React Native avec TypeScript |
| Web | Framework React adapté au référencement du site public et à l’espace connecté |
| Backend | Service applicatif TypeScript ou service administré offrant une API et les contrôles requis |
| Base centrale | Base relationnelle PostgreSQL |
| Base mobile | SQLite avec protection adaptée aux données locales |
| Médias | Stockage objet privé, miniatures et accès temporaires |
| Identité | Service d’authentification éprouvé avec vérification et récupération |
| Supervision | Erreurs, journaux, métriques et alertes sans données métier inutiles |

La réutilisation des types, validations et règles communes est souhaitée ; elle n’impose pas que le web et le mobile partagent tous leurs composants d’interface. Éviter une architecture en microservices pour la première version sans besoin démontré.

### 15.3. Contrats API

Domaines : identité, ateliers, membres, clients, relevés, commandes, articles, paiements, dépenses, fichiers, abonnements, contenus, tickets et synchronisation. Pagination, filtres, erreurs structurées, limites de taille et contrôle d’autorisation pour chaque opération.

Les montants utilisent une représentation décimale exacte ou des unités monétaires entières selon la devise, jamais des calculs financiers fondés sur des flottants approximatifs. Les dates techniques sont stockées avec un référentiel cohérent ; dates promises et rendez-vous sont interprétés selon le fuseau de l’atelier.

## 16. Modèle de données

| Entité | Principaux champs et relations |
| --- | --- |
| Utilisateur | Identifiant, nom, contacts vérifiés, identité d’authentification, état |
| Atelier | Identifiant, responsable, pays, devise, fuseau, coordonnées |
| Appartenance | Utilisateur, atelier, rôle, permissions, statut |
| Client | Atelier, nom, contacts, notes, archivage |
| Modèle de mesures | Atelier ou modèle commun, catégorie, champs, unités |
| Relevé de mesures | Client, version, date, valeurs, auteur |
| Commande | Atelier, client, référence, dates, réduction, version |
| Article | Commande, description, quantité, prix, état, échéance, mesures figées |
| Remise | Article, quantité, date, auteur, confirmation du solde éventuel |
| Média | Atelier, objet lié, type, taille, clé privée, état de transfert |
| Mouvement financier atelier | Commande, type paiement/remboursement/correction, montant, devise, référence, auteur |
| Dépense | Atelier, catégorie, montant, date, justificatif |
| Reçu | Atelier, mouvement, référence, état provisoire/définitif/annulé |
| Offre | Pays, devise, prix, période, limites, version, date d’effet |
| Abonnement | Atelier, version d’offre, statut, échéance, résiliation éventuelle |
| Paiement Filéo | Abonnement, montant, devise, canal, référence externe, état, rapprochement |
| Contenu | Page/FAQ/tutoriel/actualité, titre, langue, version, état |
| Ticket | Atelier, demandeur, catégorie, messages, état, responsable |
| Journal d’audit | Atelier si applicable, acteur, action, objet, date, motif |
| Opération de synchronisation | Identifiant unique, appareil, entité, version, état, erreur |

Chaque donnée métier porte son atelier de rattachement. Les liens entre entités sont validés afin d’interdire une commande liée à un client d’un autre atelier. Les suppressions et l’archivage respectent l’intégrité des historiques financiers.

## 17. Sécurité, confidentialité et exploitation

### 17.1. Sécurité

- Communications chiffrées, protection des secrets et stockage sécurisé des jetons mobiles.
- Protection des données locales ; clés séparées du contenu et procédure de purge au changement de compte.
- Authentification renforcée obligatoire pour les administrateurs Filéo.
- Validation serveur des entrées, protection contre injections, scripts malveillants, abus et accès directs non autorisés.
- Contrôle du format réel des pièces jointes, limites et traitement sécurisé des fichiers.
- Liens de fichiers et exports privés, limités dans le temps et aux bénéficiaires autorisés.
- Journaux sans mots de passe, jetons, mesures ou photos ; masquage des données personnelles dans les diagnostics.
- Audit des modifications de permissions, prix, paiements, abonnements, accès support et suppressions.

### 17.2. Confidentialité et conservation

Le responsable d’atelier maîtrise les données de ses clients ; Filéo ne les utilise pas à des fins publicitaires sans base et autorisation appropriées. Prévoir information des utilisateurs, collecte minimale, export et traitement des demandes de correction ou suppression.

Avant mise en production, faire valider les textes, responsabilités, durées de conservation, hébergement et éventuels transferts selon les territoires effectivement desservis. Le présent cahier des charges définit des exigences de conception ; il ne certifie pas une conformité juridique.

La suppression doit couvrir les données actives, fichiers et caches accessibles, avec traitement documenté des sauvegardes et des éventuelles données à conserver. Une restauration ne doit pas réintroduire durablement des données ayant fait l’objet d’une suppression validée.

### 17.3. Sauvegarde et continuité

Cibles proposées : sauvegarde quotidienne, conservation glissante de 30 jours, perte maximale de données serveur de 24 heures et remise en service sous 8 heures en cas d’incident majeur. Ces objectifs doivent être confrontés au budget et à l’offre d’hébergement ; ils ne couvrent pas les écritures encore uniquement présentes sur un téléphone.

Tester une restauration avant lancement puis au moins chaque trimestre. Couvrir base et fichiers, documenter le responsable d’intervention et tenir un registre des incidents. Le cache mobile ne remplace pas une sauvegarde serveur.

## 18. Performances et compatibilité

Les valeurs suivantes sont des cibles de recette proposées, pas des performances déjà démontrées.

| Critère | Cible |
| --- | --- |
| Site public | Contenu principal visible en moins de 3 secondes sur profil de test mobile à 5 Mb/s et 150 ms de latence, hors vidéo |
| Actions serveur courantes | 95 % sous 1 seconde côté API dans la charge de référence, hors transferts et prestataires |
| Recherche locale | 95 % sous 500 ms avec 1 000 clients déjà synchronisés sur appareil de référence |
| Reprise de synchronisation | Démarrage sous 10 secondes au retour au premier plan avec réseau utilisable |
| Fiabilité mobile | Cible de 99,5 % de sessions sans crash pendant le pilote, à mesurer |
| Disponibilité serveur | Objectif mensuel de 99,5 %, périmètre de mesure et maintenance annoncée à définir |
| Charge de recette | 45 ateliers, 10 utilisateurs simultanés, 1 000 clients et 2 000 commandes par atelier, médias testés séparément |

Tester sur au moins un Android d’entrée de gamme retenu au pilote et un iPhone supporté. Versions minimales Android/iOS à arrêter selon le SDK Expo choisi et les appareils des premiers ateliers. Pour le web : versions stables récentes de Chrome, Safari, Firefox et Edge, sur ordinateur et mobile ; consigner les versions exactes de recette.

Limiter le volume initial téléchargé, paginer les historiques et donner le contrôle du cache photo/vidéo. Préparer l’extension à plusieurs centaines d’ateliers sans changement du modèle de données, sans facturer dès le départ une infrastructure surdimensionnée.

## 19. Mesure du succès et hypothèses économiques

### 19.1. Indicateurs

- Activation : atelier ayant créé au moins un client et une commande réelle sous sept jours.
- Usage hebdomadaire : atelier ayant réalisé une action métier significative, pas seulement ouvert l’application.
- Adoption : part des commandes réelles enregistrées, mesurée auprès du pilote.
- Conversion : essais arrivés à échéance devenus payants.
- Rétention : ateliers toujours payants après trois mois et après douze mois, par cohorte.
- Assistance : demandes et temps consacré par atelier actif.
- Fiabilité : opérations non synchronisées, conflits non résolus, pertes de données et doublons financiers.
- Économie : revenu récurrent, encaissements réels, coûts variables par atelier et coût d’acquisition.

### 19.2. Prévision arithmétique

| Hypothèse | Montant |
| --- | --- |
| Abonnement mensuel étudié | 2 500 FCFA |
| 45 ateliers payants sur un mois | 112 500 FCFA |
| 45 ateliers payants pendant douze mois complets | 1 350 000 FCFA |
| Croissance régulière de 0 à 45 sur l’année, moyenne approximative de 22,5 | Environ 675 000 FCFA sur l’année |

Il s’agit de scénarios de chiffre d’affaires brut, sans garantie d’acquisition ou de rétention. L’encaissement réel dépend des dates de souscription, essais, impayés et départs. Le traitement des taxes et frais n’est pas arrêté.

Le budget devra isoler conception, développement, production des tutoriels, comptes de distribution, hébergement, fichiers, vérification téléphonique, frais de paiement, maintenance, prospection et assistance. Aucun budget de réalisation ni calendrier ferme n’est fixé dans les échanges.

## 20. Recette et critères d’acceptation

### 20.1. Scénarios obligatoires

| ID | Scénario | Résultat attendu |
| --- | --- | --- |
| REC-01 | Inscription, vérification, création atelier, connexion mobile | Même atelier accessible sur web et mobile |
| REC-02 | Modifier les mesures après création d’une commande | Nouvelle version client ; anciennes mesures préservées dans la commande |
| REC-03 | Commande à 20 000 XAF, paiements de 5 000 puis 7 500 | Encaissement net 12 500 ; reste 7 500 |
| REC-04 | Réenvoyer trois fois la même opération de paiement | Un seul mouvement confirmé |
| REC-05 | Annuler une commande à 20 000 avec 5 000 reçus, puis rembourser | Alerte de restitution ; historique intact ; solde final cohérent |
| REC-06 | Remettre une commande partiellement payée | Confirmation requise ; état remis et créance conservée |
| REC-07 | Commande avec deux articles, un seul remis | Commande partiellement remise ; second article toujours suivi |
| REC-08 | Créer hors connexion client, commande, photo et acompte, fermer puis rouvrir | Données locales conservées puis synchronisées une seule fois |
| REC-09 | Modifier la même échéance sur deux appareils | Conflit visible ; aucune perte silencieuse |
| REC-10 | Deux encaissements distincts créent un trop-perçu | Deux mouvements conservés ; trop-perçu signalé |
| REC-11 | Accéder par API à un client ou fichier d’un autre atelier | Accès refusé sans fuite de données |
| REC-12 | Collaborateur sans droit financier consulte une commande | Aucun prix/paiement transmis ou affiché |
| REC-13 | Préparer un message WhatsApp | Texte et destinataire vérifiables ; aucun faux statut envoyé |
| REC-14 | Télécharger un tutoriel puis couper le réseau | Lecture locale et accès à la transcription |
| REC-15 | Faire expirer l’abonnement avec une opération locale en attente | Pas de perte ; récupération possible ; nouvelles écritures restreintes |
| REC-16 | Révoquer un collaborateur puis reconnecter son appareil | Permissions retirées ; opérations rejetées traitées sans perte silencieuse |
| REC-17 | Valider deux fois une référence de règlement Filéo | Une seule activation/prolongation |
| REC-18 | Publier une nouveauté et un tarif depuis le back-office | Contenu correct, daté et cohérent sur le site |
| REC-19 | Exporter puis rapprocher les données | Commandes, mesures et mouvements complets ; accès privé |
| REC-20 | Restaurer une sauvegarde de test | Base et fichiers cohérents, procédure et durée documentées |
| REC-21 | Refuser caméra, réseau ou messagerie disponible | Message utile et parcours alternatif, sans crash |
| REC-22 | Déconnexion/changement de compte avec données locales | Avertissement et aucune exposition au second compte |
| REC-23 | Réaliser chaque fonction métier sur web, Android et iOS | Parité P0 effective ; différences de présentation documentées |
| REC-24 | Suppression validée puis restauration de sauvegarde | Réapplication des suppressions conformément à la procédure |

### 20.2. Conditions de livraison

Tous les scénarios P0 doivent être validés. Aucune anomalie bloquante de sécurité, perte de données, calcul financier ou synchronisation ne peut rester ouverte. Les anomalies mineures résiduelles sont listées avec impact et échéance acceptée.

Conserver un rapport de recette indiquant version, environnement, appareils, jeux de données et résultats. Les interfaces seules, boutons factices, données exclusivement simulées ou application uniquement utilisable dans un environnement de développement ne constituent pas une livraison opérationnelle.

## 21. Organisation, lots et livrables

### 21.1. Découpage de réalisation

| Lot | Contenu | Condition de sortie |
| --- | --- | --- |
| 0 — Validation terrain et cadrage | Entretiens avec cinq ateliers proposés, relevé des appareils, prix, moyens de paiement et parcours | Hypothèses et arbitrages consignés |
| 1 — Conception | Maquettes, données, permissions, contrats API et stratégie de synchronisation | Parcours et architecture revus |
| 2 — Socle | Identité, ateliers, équipe, isolation, environnements et déploiement | Connexion multi-support et séparation des données testées |
| 3 — Métier | Clients, mesures, commandes, planning, paiements, dépenses, exports | Scénarios métier validés web/mobile |
| 4 — Résilience mobile | Stockage local, reprise, conflits, photos et tests appareils | Recette hors connexion validée |
| 5 — Commercial et administration | Site complet, abonnements, back-office, tutoriels et assistance | Parcours de souscription/exploitation utilisables |
| 6 — Pilote | Usage réel par les ateliers, mesures, corrections et restauration | Décision de lancement basée sur les résultats |
| 7 — Publication | Préparation stores, site de production, supervision et transfert | Supports livrés, accès remis et procédure opérationnelle |

Le prestataire doit chiffrer effort, durée, dépendances et coûts récurrents par lot. Les délais de validation des opérateurs ou stores sont identifiés séparément. Le calendrier ferme sera établi après ces estimations ; le présent document ne promet pas une date de livraison.

### 21.2. Livrables attendus

1. Maquettes, composants graphiques et parcours d’erreur/hors connexion.
2. Code source web, mobile, backend et scripts de déploiement dans un dépôt sous contrôle du porteur.
3. Schéma de base, migrations et documentation des données.
4. Documentation API, permissions et synchronisation.
5. Site public, espace atelier complet et back-office fonctionnels.
6. Builds Android et iOS de production, éléments de soumission et suivi des publications.
7. Tutoriels vidéo, transcriptions et fichiers sources éditables.
8. Jeux de données anonymisés et rapport de recette.
9. Guides administrateur, assistance, sauvegarde, restauration, mise à jour et incidents.
10. Inventaire des services, licences, coûts et dépendances.
11. Transfert des accès et procédure de rotation des secrets, sans secrets inscrits en clair dans la documentation.
12. Conditions écrites de maintenance, périmètre de garantie corrective et traitement des évolutions.

Les noms de domaine, comptes de stores, hébergement, facturation et dépôts doivent être détenus ou contrôlés par le porteur du projet. Une livraison ne doit pas dépendre exclusivement des comptes personnels du développeur.

## 22. Risques et arbitrages

### 22.1. Risques principaux

| Risque | Réponse prévue |
| --- | --- |
| Saisie trop longue | Formulaires courts, réutilisation contrôlée et observation des premiers utilisateurs |
| Réseau instable | Stockage local, états explicites, reprise et recette de conflits |
| Coût d’assistance élevé | Tutoriels contextuels et suivi du temps réel par atelier |
| Coûts supérieurs au petit abonnement | Limites explicites, compression et séparation des intégrations payantes |
| Erreurs ou doublons financiers | Mouvements non destructifs, idempotence et rapprochement |
| Fuite entre ateliers | Contrôles serveur, accès fichiers privés et tests systématiques |
| Refus de distribution | Examiner les parcours d’achat et préparer les comptes avant soumission |
| Extension prématurée du périmètre | P0 figé après cadrage et évolutions chiffrées séparément |
| Offre mal adaptée à l’un des pays | Pilote et prix propres à chaque marché |

### 22.2. Décisions restant à prendre

| Décision | Proposition / question à résoudre | Échéance |
| --- | --- | --- |
| Nom et domaine | Vérifier Filéo et choisir le domaine | Avant identité finale |
| Premier terrain pilote | Choisir ville, ateliers et interlocuteurs | Avant lot 0 |
| Tarifs pays | Confirmer 2 500 XAF et définir l’offre RDC | Avant publication des tarifs |
| Limites d’offre | Nombre de membres et stockage inclus | Avant engagement commercial |
| Identité | Téléphone/mot de passe proposé ; choisir le prestataire de vérification | Avant lot 2 |
| Abonnement | Essai, grâce, résiliation, fiscalité et parcours par canal | Avant lot 5 |
| Paiements | Règlement externe contrôlé au pilote ; choix du prestataire intégré | Avant intégration |
| Appareils | Versions minimales selon parc réel et Expo retenu | Avant architecture finale |
| Hébergement | Fournisseur, région, budget, sauvegardes | Avant production |
| Conservation | Durées et procédure de suppression validées | Avant production |
| Assistance | Canal, horaires, responsable et engagements réalistes | Avant pilote |
| Budget et planning | Chiffrage par lots, maintenance et frais récurrents | Avant engagement de réalisation |

Ces arbitrages ne bloquent pas l’utilisation du document comme base de consultation. Ils doivent être tranchés au jalon indiqué ; aucune hypothèse ne doit être transformée en promesse commerciale sans validation.

## 23. Références et glossaire

### 23.1. Références

Le périmètre fonctionnel provient des échanges de cadrage du projet Filéo et de l’idée de carnet numérique pour tailleurs présentée dans l’image fournie. Les compléments sont des exigences proposées, pas des résultats d’étude de marché.

Références techniques consultées le 10 septembre 2026 :

- [Expo — documentation officielle](https://docs.expo.dev/).
- [Expo SQLite — persistance locale](https://docs.expo.dev/versions/latest/sdk/sqlite/).
- [Apple — App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).
- [Google Play — Payments](https://support.google.com/googleplay/android-developer/answer/9858738).

Les règles des services externes doivent être revérifiées au moment de leur intégration et de la publication. Aucun prestataire de paiement, de messagerie ou d’hébergement n’a été sélectionné par le présent document.

### 23.2. Glossaire

| Terme | Définition |
| --- | --- |
| Atelier | Espace métier d’un tailleur ou d’une équipe, isolé des autres ateliers |
| Client | Personne qui commande une tenue à l’atelier |
| Utilisateur | Personne possédant un accès Filéo |
| Back-office | Interface réservée à l’équipe qui administre Filéo |
| API | Interface permettant au web et au mobile d’échanger avec le serveur |
| Expo | Environnement retenu pour développer et distribuer l’application mobile |
| Synchronisation | Échange contrôlé entre les données locales et celles du serveur |
| Idempotence | Propriété garantissant qu’une opération répétée ne produit pas plusieurs effets |
| Instantané de mesures | Copie des mesures conservée pour un article donné |
| Recette | Vérification formelle des fonctions et exigences avant acceptation |
| P0 / P1 / P2 | Priorités de livraison définies dans la section 3 |
| XAF / CDF / USD | Codes des devises prévues dans la configuration |

---

**Fin du cahier des charges — version 1.0.**
