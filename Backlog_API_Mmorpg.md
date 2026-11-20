# Backlog technique — API Backend MMORPG
 
> Backlog de réalisation destiné à un agent de développement. Le dépôt de départ est `Tom0204/BackendNode`.
> Stack constatée dans l'analyse initiale : Node.js, TypeScript, Express 4, Zod, tsx, nodemon et tsup.
> Le projet est une API REST uniquement : aucun Front-End n'est à développer. Les scénarios manuels sont exécutés avec Postman.
>
> **Règle prioritaire :** commencer par auditer le dépôt et conserver/améliorer le code existant lorsqu'il est correct. Ne pas remplacer une implémentation fonctionnelle sans raison documentée.
>
> **Décisions à confirmer avant implémentation :** PostgreSQL/Prisma, stratégie JWT ou sessions, convention exacte des identifiants, règles de gameplay chiffrées. Les tickets signalent ces décisions ; ne pas les inventer silencieusement.
 
---
 
## 0. Règles de travail pour l'agent
 
### Procédure obligatoire pour chaque ticket
 
1. Lire les fichiers concernés et comprendre le comportement existant.
2. Vérifier les tickets dépendants et les décisions d'architecture déjà prises.
3. Proposer un plan court avant toute modification importante.
4. Implémenter uniquement le périmètre du ticket. Ne pas anticiper plusieurs modules.
5. Ajouter ou adapter les tests automatisés pertinents.
6. Ajouter les requêtes et tests Postman correspondants.
7. Exécuter `npm run build`, les tests et les vérifications disponibles.
8. Mettre à jour la documentation et le statut du ticket.
9. Résumer les fichiers modifiés, les commandes exécutées, les résultats et les points restant à décider.
### Contraintes techniques
 
- Garder TypeScript en mode strict autant que possible ; éviter `any`.
- Respecter l'architecture en couches : routes → controllers → services → repositories.
- Les routes ne contiennent pas de logique métier.
- Les controllers gèrent HTTP et délèguent aux services.
- Les services portent les règles métier et ne dépendent pas d'Express.
- Les repositories encapsulent l'accès aux données.
- Valider les entrées avec Zod avant d'appeler la logique métier.
- Centraliser les erreurs et conserver des codes HTTP cohérents.
- Ne jamais stocker de mot de passe en clair, de secret dans Git ou de donnée de jeu sensible côté client.
- Ne pas renvoyer les objets internes de la base de données sans DTO explicite.
- Une action de jeu qui modifie plusieurs données doit être atomique.
- Ne jamais faire confiance au client pour calculer dégâts, XP, monnaie, inventaire ou récompenses.
- Toute fonctionnalité doit être testable sans Front-End.
- Ne pas introduire WebSocket dans les premiers tickets. Préparer des services indépendants du transport HTTP.
### Priorités
 
- **P0** : bloque le socle jouable ou la sécurité ; à réaliser en premier.
- **P1** : nécessaire au MVP complet ou à la qualité attendue.
- **P2** : extension avancée, à traiter après le parcours MVP.
### Definition of Done (DoD)
 
Un ticket est terminé seulement si :
- les critères d'acceptation sont remplis ;
- les validations et erreurs sont gérées ;
- les tests automatisés pertinents passent ;
- les requêtes Postman sont ajoutées/mises à jour ;
- la documentation utile est actualisée ;
- `npm run build` passe ;
- aucune régression connue n'est introduite ;
- les décisions non prises sont signalées, jamais supposées.
---
 
# EPIC 00 — Audit et décisions de conception
 
## SET-01 — Auditer le dépôt et établir l'état initial
**Priorité : P0 · Dépendances : aucune**
 
**Objectif**  
Établir précisément ce qui existe avant de modifier le projet.
 
**Travail à réaliser**
- Examiner `package.json`, scripts, dépendances et `tsconfig`.
- Parcourir `server.ts`, `src/app.ts`, les routes, controllers, services, repositories, types et utilitaires.
- Examiner les routes utilisateurs existantes et leur comportement réel.
- Repérer les doublons, imports inutilisés, erreurs TypeScript, validations absentes et conventions incohérentes.
- Examiner les fichiers Postman existants.
- Lancer installation, build et serveur selon les scripts disponibles.
- Rédiger `docs/architecture/current-state.md` avec les constats et risques.
**Livrables** : rapport d'audit, liste des fonctionnalités déjà opérationnelles, liste des écarts.
 
**Acceptation**
- Chaque couche existante est décrite.
- Les endpoints existants sont listés avec méthode, chemin et comportement.
- Les commandes exécutées et leurs résultats sont indiqués.
- Aucun code applicatif n'est réécrit dans ce ticket.
**Tests / vérifications** : `npm install`, `npm run build`, démarrage serveur, appels Postman aux endpoints actuels.
 
## SET-02 — Définir le périmètre du MVP jouable
**Priorité : P0 · Dépendances : SET-01**
 
**Objectif**  
Définir le premier parcours complet qui prouve que le backend fonctionne.
 
**Travail à réaliser**
- Décrire le parcours : inscription → connexion → création personnage → consultation statistiques → entrée dans une zone → rencontre d'un monstre → combat → victoire → attribution XP et butin → consultation de l'état mis à jour.
- Pour chaque étape, lister données nécessaires, règles métier, endpoint attendu et erreurs possibles.
- Séparer les fonctionnalités indispensables du MVP des extensions.
- Créer `docs/gameplay/mvp-scope.md`.
**Acceptation**
- Le parcours peut être exécuté uniquement avec Postman.
- Chaque étape a un résultat attendu vérifiable.
- Les fonctionnalités non incluses au MVP sont explicitement listées.
## SET-03 — Formaliser les règles de gameplay initiales
**Priorité : P0 · Dépendances : SET-02**
 
**Objectif**  
Éviter que l'agent invente des règles différentes dans chaque service.
 
**Travail à réaliser**
- Définir avec le propriétaire du projet les classes disponibles au MVP.
- Définir les statistiques (ex. PV, mana, attaque, défense, vitesse, critique) et leur signification.
- Définir formules de progression, dégâts, expérience, niveaux et récompenses.
- Définir les règles de mort, de fuite, de tour et de fin de combat.
- Documenter les paramètres modifiables et leurs valeurs initiales.
- Si une valeur n'est pas décidée, la marquer `À VALIDER` et ne pas la figer dans le code.
**Acceptation**
- Un document de règles versionné existe.
- Les formules ont des exemples chiffrés.
- Aucun ticket de gameplay ne dépend d'une règle implicite.
## SET-04 — Choisir et documenter la base de données
**Priorité : P0 · Dépendances : SET-01**
 
**Objectif**  
Prendre une décision explicite sur la persistance.
 
**Travail à réaliser**
- Comparer les besoins du projet avec PostgreSQL et une solution ORM (Prisma proposé).
- Valider le choix avec le propriétaire du projet avant installation.
- Définir environnements local/test/production et stratégie de migrations.
- Documenter les raisons du choix dans `docs/architecture/database.md`.
**Acceptation**
- La décision est écrite et approuvée.
- Les versions et commandes de mise en place sont documentées.
- Aucun ORM/base n'est ajouté sans validation.
## SET-05 — Définir les conventions API
**Priorité : P0 · Dépendances : SET-01**
 
**Travail à réaliser**
- Fixer le préfixe `/api/v1`.
- Définir format de succès, format d'erreur, pagination, dates ISO 8601 et conventions de nommage.
- Définir les règles de statut HTTP.
- Définir la stratégie d'évolution et de dépréciation des endpoints.
**Acceptation**
- `docs/api/conventions.md` contient des exemples JSON complets.
- Les nouveaux endpoints peuvent suivre les mêmes conventions.
---
 
# EPIC 01 — Fondations de l'API
 
## FND-01 — Stabiliser le démarrage de l'application
**Priorité : P0 · Dépendances : SET-01**
 
**Travail à réaliser**
- Vérifier la séparation entre création de l'application Express et démarrage du serveur.
- Garder `src/app.ts` testable sans ouvrir de port.
- Centraliser la lecture du port et des variables d'environnement.
- Gérer proprement les erreurs de démarrage.
- Préserver les scripts `dev`, `build` et `start` s'ils fonctionnent ; les corriger si nécessaire.
**Acceptation**
- `npm run dev` démarre en développement.
- `npm run build` produit un build exploitable.
- `npm start` démarre le build.
- L'application peut être importée dans les tests sans démarrer un listener.
## FND-02 — Valider les variables d'environnement
**Priorité : P0 · Dépendances : FND-01**
 
**Travail à réaliser**
- Créer un module de configuration centralisé.
- Définir un schéma Zod pour `PORT`, `NODE_ENV`, URL de base de données et secrets requis.
- Échouer au démarrage avec un message explicite si une variable obligatoire manque ou est invalide.
- Créer `.env.example` sans secret réel.
- Vérifier que `.env` est ignoré par Git.
**Acceptation**
- Aucune variable d'environnement n'est lue directement dans les services.
- Une configuration invalide empêche le démarrage.
- Le dépôt ne contient aucun secret.
## FND-03 — Uniformiser la gestion des erreurs HTTP
**Priorité : P0 · Dépendances : FND-01**
 
**Travail à réaliser**
- Auditer `HttpError` et le middleware d'erreur existants.
- Définir une classe/structure d'erreur applicative cohérente : statut, code stable, message public et détails éventuels.
- Distinguer erreurs de validation, authentification, autorisation, ressource absente, conflit et erreur interne.
- Ne pas exposer stack trace ou détails SQL en production.
- Ajouter un handler 404 pour les routes inconnues.
 
**Acceptation**
- Toutes les erreurs API suivent le format défini dans SET-05.
- Une erreur inattendue renvoie 500 sans détail interne.
- Une route inconnue renvoie 404.
## FND-04 — Créer les middlewares de validation Zod
**Priorité : P0 · Dépendances : FND-03**
 
**Travail à réaliser**
- Créer un middleware réutilisable pour valider `params`, `query` et `body`.
- Retourner une erreur 400 structurée avec les champs invalides.
- Inférer les types TypeScript depuis les schémas Zod lorsque possible.
- Supprimer les validations dupliquées dans les controllers, sans supprimer les règles métier des services.
**Acceptation**
- Les routes peuvent déclarer leurs schémas explicitement.
- Un body invalide ne déclenche jamais le service.
- Les erreurs indiquent les champs en cause.
## FND-05 — Ajouter les logs structurés
**Priorité : P1 · Dépendances : FND-01**
 
**Travail à réaliser**
- Choisir une solution de logging adaptée et légère.
- Logger démarrage, erreurs non gérées et événements techniques utiles.
- Ajouter un identifiant de requête/correlation ID.
- Masquer mots de passe, tokens et données sensibles.
**Acceptation**
- Une requête peut être reliée à ses logs.
- Aucun secret n'apparaît dans les logs.
- Les logs de développement restent lisibles.
## FND-06 — Mettre en place les tests automatisés de base
**Priorité : P0 · Dépendances : FND-01, FND-03**
 
**Travail à réaliser**
- Choisir un framework de test (Vitest proposé) et le valider.
- Configurer tests unitaires et tests HTTP d'intégration.
- Créer helpers de test et gestion de la configuration de test.
- Tester au minimum route inconnue, validation et erreur applicative.
- Ajouter un script `test`.
**Acceptation**
- `npm test` exécute les tests de façon reproductible.
- Les tests ne dépendent pas de la base de développement.
- Le démarrage du serveur n'est pas requis pour les tests de services.
## FND-07 — Créer la structure API versionnée
**Priorité : P0 · Dépendances : FND-01, SET-05**
 
**Travail à réaliser**
- Regrouper les routes métier sous `/api/v1`.
- Préserver les routes déjà existantes en adaptant leur montage.
- Ajouter une route de santé `GET /health`.
- Ne pas exposer d'informations sensibles dans le health check.
**Acceptation**
- `GET /health` retourne un statut simple.
- Les routes métier sont sous `/api/v1`.
- Les routes existantes restent fonctionnelles ou leur migration est documentée.
## FND-08 — Ajouter les limites de requêtes et protections HTTP
**Priorité : P1 · Dépendances : FND-01**
 
**Travail à réaliser**
- Définir une taille maximale de body JSON.
- Configurer les en-têtes de sécurité adaptés.
- Préparer le rate limiting, avec limites plus strictes sur les endpoints sensibles.
- Configurer CORS depuis une liste d'origines autorisées en environnement réel.
**Acceptation**
- Un body trop volumineux est rejeté.
- CORS n'autorise pas toutes les origines en production par défaut.
- Les protections ne bloquent pas les tests locaux documentés.
---
 
# EPIC 02 — Persistance et modèle de données
 
## DB-01 — Initialiser la base de données choisie
**Priorité : P0 · Dépendances : SET-04, FND-02**
 
**Travail à réaliser**
- Installer/configurer le driver ou ORM validé.
- Ajouter la connexion via variable d'environnement.
- Prévoir une base distincte pour les tests.
- Ajouter une commande de migration et une commande de génération si ORM.
- Documenter le démarrage local.
**Acceptation**
- L'API se connecte à la base configurée.
- Une base indisponible produit une erreur de démarrage claire.
- Aucun identifiant de connexion n'est commité.
## DB-02 — Définir le modèle relationnel initial
**Priorité : P0 · Dépendances : DB-01, SET-02, SET-03**
 
**Travail à réaliser**
- Modéliser au minimum User, Character, Class et les relations nécessaires.
- Définir clés primaires, contraintes uniques, clés étrangères et dates de création/modification.
- Prévoir les tables de référence pour les données de jeu si pertinent.
- Éviter de stocker des listes structurées dans des colonnes texte sans justification.
- Produire un diagramme ERD dans `docs/architecture/data-model.md`.
**Acceptation**
- Les relations et contraintes sont documentées.
- Un utilisateur peut posséder plusieurs personnages selon la règle décidée.
- Les suppressions suivent une politique explicite (cascade, restriction ou archivage).
## DB-03 — Mettre en place migrations et données de référence
**Priorité : P0 · Dépendances : DB-02**
 
**Travail à réaliser**
- Créer la première migration.
- Créer un mécanisme de seed idempotent pour classes, monstres et autres données de référence.
- Séparer les données de test des données de référence.
- Documenter comment réinitialiser une base locale.
**Acceptation**
- Une base vide peut être créée à partir des migrations.
- Le seed peut être exécuté plusieurs fois sans doublons.
- Les migrations sont versionnées dans Git.
## DB-04 — Créer les repositories persistants
**Priorité : P0 · Dépendances : DB-02, DB-03**
 
**Travail à réaliser**
- Définir les interfaces/méthodes de repository nécessaires aux modules User et Character.
- Implémenter les accès à la base dans les repositories uniquement.
- Gérer les cas non trouvé et unicité.
- Remplacer progressivement les éventuelles données en mémoire du repository utilisateur.
**Acceptation**
- Les services ne contiennent pas de requêtes SQL/ORM.
- Les données persistent après redémarrage.
- Les tests peuvent substituer un repository contrôlé.
---
 
# EPIC 03 — Comptes et authentification
 
## AUTH-01 — Finaliser le modèle utilisateur
**Priorité : P0 · Dépendances : DB-04**
 
**Travail à réaliser**
- Définir les champs utilisateur nécessaires : identifiant, email normalisé, hash du mot de passe, rôle, dates.
- Ajouter une contrainte unique sur l'email.
- Ne jamais retourner le hash dans les DTO.
- Définir les états de compte si nécessaires.
**Acceptation**
- Les doublons d'email sont impossibles en base.
- Le DTO public n'expose aucun secret.
- Les champs obligatoires sont validés.
## AUTH-02 — Adapter les endpoints utilisateurs existants
**Priorité : P0 · Dépendances : AUTH-01, FND-03, FND-04**
 
**Travail à réaliser**
- Réutiliser les routes/controllers/services existants après audit.
- Adapter les chemins au préfixe `/api/v1`.
- Vérifier GET liste, GET par id, création, modification, suppression.
- Interdire à un utilisateur standard de lire/modifier/supprimer un autre compte.
- Restreindre la liste globale à un rôle administratif ou la supprimer de l'API publique.
**Acceptation**
- Les endpoints ont des permissions explicites.
- Les réponses sont des DTO filtrés.
- Les tests couvrent propriétaire, autre utilisateur et administrateur.
## AUTH-03 — Hasher les mots de passe
**Priorité : P0 · Dépendances : AUTH-01**
 
**Travail à réaliser**
- Choisir une bibliothèque reconnue (Argon2id recommandé, bcrypt possible selon décision).
- Hasher avant persistance.
- Comparer les mots de passe via la fonction de vérification de la bibliothèque.
- Ne jamais logger ou retourner le mot de passe.
**Acceptation**
- Deux inscriptions avec le même mot de passe ne stockent pas le mot de passe en clair.
- Le hash n'est jamais présent dans une réponse API.
- Les tests vérifient succès et échec de comparaison.
## AUTH-04 — Créer l'inscription
**Priorité : P0 · Dépendances : AUTH-02, AUTH-03**
 
**Endpoint proposé** : `POST /api/v1/auth/register`
 
**Travail à réaliser**
- Créer le schéma Zod : email, mot de passe et confirmation si retenue.
- Normaliser l'email.
- Refuser un email déjà utilisé avec 409.
- Créer l'utilisateur avec mot de passe hashé.
- Retourner un DTO public, jamais le hash.
**Acceptation**
- Données valides : 201.
- Email invalide ou mot de passe trop faible : 400.
- Email déjà utilisé : 409.
- Aucun token n'est émis sauf si cette décision est explicitement retenue.
**Postman** : inscription valide, email invalide, mot de passe trop court, email déjà existant, body vide.
 
## AUTH-05 — Mettre en place la stratégie de session/token
**Priorité : P0 · Dépendances : SET-05, AUTH-03**
 
**Travail à réaliser**
- Choisir explicitement JWT ou sessions.
- Si JWT : définir durée de vie, algorithme, secret/clé, claims minimaux et stratégie de renouvellement/révocation.
- Si sessions : définir stockage, expiration et invalidation.
- Stocker les secrets uniquement dans l'environnement.
- Documenter les menaces et compromis.
**Acceptation**
- La stratégie est documentée et validée.
- Les tokens ne contiennent pas de données sensibles.
- Les expirations sont testées.
## AUTH-06 — Créer la connexion
**Priorité : P0 · Dépendances : AUTH-04, AUTH-05**
 
**Endpoint proposé** : `POST /api/v1/auth/login`
 
**Travail à réaliser**
- Valider email et mot de passe.
- Retrouver le compte et vérifier le hash.
- Retourner le mécanisme d'authentification décidé.
- Utiliser un message d'erreur générique pour éviter de révéler si l'email existe.
- Ajouter une limitation de tentatives.
**Acceptation**
- Identifiants valides : connexion réussie.
- Identifiants invalides : 401 générique.
- Compte désactivé : refus contrôlé.
- Aucun mot de passe/hash n'est retourné.
**Postman** : succès, mauvais mot de passe, email inconnu, body invalide, compte désactivé.
 
## AUTH-07 — Authentifier les requêtes protégées
**Priorité : P0 · Dépendances : AUTH-05, AUTH-06**
 
**Travail à réaliser**
- Créer un middleware d'authentification.
- Vérifier signature, expiration et format du token/session.
- Ajouter un contexte utilisateur typé à la requête.
- Refuser les credentials absents, invalides ou expirés.
**Acceptation**
- Endpoint protégé sans authentification : 401.
- Token invalide/expiré : 401.
- Token valide : utilisateur authentifié disponible au service.
## AUTH-08 — Gérer les rôles et permissions
**Priorité : P1 · Dépendances : AUTH-07**
 
**Travail à réaliser**
- Définir les rôles nécessaires (joueur, administrateur au minimum si retenu).
- Créer un middleware d'autorisation.
- Vérifier les permissions au niveau des ressources, pas seulement le rôle.
- Ajouter des tests d'accès interdit.
**Acceptation**
- Un joueur ne peut pas effectuer une action admin.
- Un joueur ne peut pas modifier les ressources d'un autre joueur.
- Les refus renvoient 403, ou 404 si la politique anti-énumération le prévoit.
## AUTH-09 — Consulter et modifier son compte
**Priorité : P1 · Dépendances : AUTH-07**
 
**Endpoints proposés** : `GET /api/v1/users/me`, `PATCH /api/v1/users/me`
 
**Travail à réaliser**
- Retourner le profil du compte authentifié.
- Autoriser uniquement les champs modifiables prévus.
- Interdire la modification du rôle et de l'identifiant interne.
- Gérer les conflits d'email.
**Acceptation**
- Le compte courant est déterminé par l'authentification, jamais par un userId fourni par le client.
- Les champs interdits sont rejetés ou ignorés selon convention documentée.
- Les changements persistent.
## AUTH-10 — Ajouter la déconnexion et la révocation
**Priorité : P1 · Dépendances : AUTH-05, AUTH-07**
 
**Travail à réaliser**
- Implémenter la déconnexion selon la stratégie retenue.
- Si JWT stateless, documenter précisément les limites et implémenter une révocation/rotation si exigée.
- Invalider les sessions côté serveur si sessions.
- Tester la réutilisation d'un credential révoqué.
**Acceptation**
- Le comportement après logout est défini et vérifié.
- Aucun endpoint ne prétend révoquer un JWT si aucune révocation réelle n'existe.
---
 
# EPIC 04 — Classes, personnages et progression
 
## CHAR-01 — Créer le catalogue des classes
**Priorité : P0 · Dépendances : DB-03, SET-03**
 
**Endpoints proposés** : `GET /api/v1/classes`, `GET /api/v1/classes/:classId`
 
**Travail à réaliser**
- Définir les classes de départ et leurs statistiques de base.
- Stocker les classes comme données de référence.
- Exposer une réponse publique sans champs internes.
- Prévoir une règle empêchant la modification des classes par les joueurs.
**Acceptation**
- Liste et détail disponibles.
- Classe inconnue : 404.
- Les données seedées sont reproductibles.
## CHAR-02 — Définir le modèle personnage
**Priorité : P0 · Dépendances : DB-02, SET-03**
 
**Travail à réaliser**
- Définir nom, propriétaire, classe, niveau, XP, zone courante et dates.
- Définir les contraintes de nom (longueur, caractères, unicité globale ou par compte).
- Définir le nombre maximal de personnages par compte.
- Prévoir l'état du personnage si nécessaire.
**Acceptation**
- Contraintes validées à l'API et en base.
- Les règles de propriété sont explicites.
- Le modèle est documenté.
## CHAR-03 — Créer un personnage
**Priorité : P0 · Dépendances : CHAR-01, CHAR-02, AUTH-07**
 
**Endpoint proposé** : `POST /api/v1/characters`
 
**Travail à réaliser**
- Récupérer le propriétaire depuis le contexte authentifié.
- Valider nom et classId.
- Vérifier existence de la classe et limite de personnages.
- Initialiser niveau, XP, statistiques et zone de départ depuis les règles serveur.
- Ne pas accepter du client les PV, dégâts, XP ou monnaie initiaux.
**Acceptation**
- Création valide : 201.
- Classe inexistante : 404/400 selon convention.
- Limite atteinte ou nom indisponible : 409.
- Les valeurs initiales proviennent du serveur.
**Postman** : créer avec classe valide, classe invalide, nom invalide, sans token, limite atteinte.
 
## CHAR-04 — Lister les personnages du joueur
**Priorité : P0 · Dépendances : CHAR-03**
 
**Endpoint** : `GET /api/v1/characters`
 
**Travail à réaliser**
- Retourner uniquement les personnages du compte authentifié.
- Ajouter pagination si le volume le justifie.
- Définir les champs publics du résumé personnage.
**Acceptation**
- Aucun personnage d'un autre compte n'est retourné.
- Compte sans personnage : tableau vide.
- Format stable et documenté.
## CHAR-05 — Consulter un personnage
**Priorité : P0 · Dépendances : CHAR-03**
 
**Endpoint** : `GET /api/v1/characters/:characterId`
 
**Travail à réaliser**
- Vérifier l'existence et la propriété.
- Retourner le détail autorisé du personnage.
- Ne pas exposer les données privées ou internes.
**Acceptation**
- Propriétaire : 200.
- Identifiant inconnu : 404.
- Personnage appartenant à un autre joueur : refus conforme à la politique définie.
## CHAR-06 — Modifier le nom du personnage
**Priorité : P1 · Dépendances : CHAR-03**
 
**Endpoint** : `PATCH /api/v1/characters/:characterId`
 
**Travail à réaliser**
- Autoriser uniquement les champs prévus, initialement le nom.
- Vérifier la propriété et les contraintes de nom.
- Ne jamais permettre au joueur de modifier niveau, classe, XP ou statistiques via cette route.
**Acceptation**
- Modification valide persistée.
- Nom invalide/conflit géré.
- Champs protégés rejetés.
## CHAR-07 — Supprimer ou archiver un personnage
**Priorité : P1 · Dépendances : CHAR-03**
 
**Travail à réaliser**
- Décider suppression définitive ou archivage.
- Vérifier la propriété.
- Gérer les dépendances (inventaire, quêtes, historique de combat).
- Utiliser une transaction si plusieurs lignes sont modifiées.
**Acceptation**
- Un personnage ne peut être supprimé par un autre joueur.
- La politique de conservation des données est appliquée.
- Les références ne deviennent pas incohérentes.
## STAT-01 — Définir le calcul des statistiques dérivées
**Priorité : P0 · Dépendances : SET-03, CHAR-02**
 
**Travail à réaliser**
- Distinguer statistiques de base, bonus d'équipement et statistiques dérivées.
- Créer un service pur de calcul.
- Définir les bornes minimales/maximales et l'ordre d'application des bonus.
- Documenter les formules.
**Acceptation**
- Calcul déterministe pour une même entrée.
- Tests unitaires sur valeurs normales, limites et bonus cumulés.
- Aucun calcul de statistique n'est dupliqué dans les controllers.
## STAT-02 — Consulter les statistiques du personnage
**Priorité : P0 · Dépendances : STAT-01, CHAR-05**
 
**Endpoint** : `GET /api/v1/characters/:characterId/stats`
 
**Travail à réaliser**
- Vérifier la propriété.
- Calculer ou lire les statistiques à jour selon le modèle choisi.
- Retourner statistiques de base, dérivées et ressources courantes clairement séparées.
**Acceptation**
- Valeurs cohérentes avec les règles de calcul.
- Données d'un autre joueur non accessibles.
- Les champs sont documentés.
## STAT-03 — Calculer l'expérience et le niveau requis
**Priorité : P0 · Dépendances : SET-03**
 
**Travail à réaliser**
- Créer un service de progression indépendant d'Express.
- Implémenter la formule XP nécessaire par niveau.
- Définir niveau maximal et comportement au-delà.
- Couvrir les seuils exacts.
**Acceptation**
- Tests unitaires pour niveau 1, seuil exact, dépassement et niveau maximal.
- Formule documentée avec exemples.
## STAT-04 — Attribuer de l'expérience
**Priorité : P0 · Dépendances : STAT-03, CHAR-02**
 
**Travail à réaliser**
- Créer une fonction métier d'attribution d'XP, appelée par les récompenses serveur.
- Gérer plusieurs niveaux gagnés en une seule attribution.
- Mettre à jour niveau et statistiques associées de façon atomique.
- Interdire toute route publique permettant de s'attribuer librement de l'XP.
**Acceptation**
- XP et niveau persistent.
- Les passages de niveaux multiples sont corrects.
- Les tests couvrent seuil exact et dépassement.
## STAT-05 — Gérer les ressources courantes du personnage
**Priorité : P1 · Dépendances : STAT-01**
 
**Travail à réaliser**
- Définir PV/mana courants et maximums.
- Définir les règles de restauration, dégâts et mise à jour.
- Empêcher valeurs négatives ou supérieures au maximum.
- Isoler les mutations dans des services métier.
**Acceptation**
- Les invariants sont respectés après chaque mutation.
- Les mises à jour concurrentes ne créent pas de valeurs impossibles.
---
 
# EPIC 05 — Compétences et sorts
 
## SKILL-01 — Créer le catalogue des compétences
**Priorité : P1 · Dépendances : DB-03, SET-03**
 
**Travail à réaliser**
- Définir identifiant, nom, description, type, coût, portée, cooldown, cible et paramètres d'effet.
- Stocker les compétences de référence.
- Valider les données seedées.
- Ne pas coder une formule de dégâts arbitraire dans chaque compétence.
**Acceptation**
- Catalogue consultable.
- Données cohérentes et documentées.
- Seed idempotent.
## SKILL-02 — Définir les compétences accessibles par classe
**Priorité : P1 · Dépendances : SKILL-01, CHAR-01**
 
**Travail à réaliser**
- Définir les prérequis de classe et niveau.
- Modéliser l'association classe-compétence.
- Prévoir compétences débloquées et compétences apprises par personnage si nécessaire.
**Acceptation**
- Une classe ne reçoit que les compétences autorisées.
- Les prérequis sont testés.
## SKILL-03 — Lister les compétences d'un personnage
**Priorité : P1 · Dépendances : SKILL-02, CHAR-05**
 
**Endpoint** : `GET /api/v1/characters/:characterId/skills`
 
**Travail à réaliser**
- Vérifier propriété.
- Retourner compétences connues, niveau, disponibilité et cooldown si applicable.
- Ne pas exposer les paramètres internes sensibles.
**Acceptation**
- Liste cohérente avec classe/niveau.
- Personnage tiers inaccessible.
## SKILL-04 — Apprendre ou débloquer une compétence
**Priorité : P1 · Dépendances : SKILL-02, STAT-03**
 
**Travail à réaliser**
- Vérifier classe, niveau et prérequis.
- Empêcher l'apprentissage multiple non autorisé.
- Enregistrer la compétence acquise.
**Acceptation**
- Prérequis respectés.
- Compétence déjà connue : conflit ou réponse idempotente documentée.
- Tests de refus et succès.
## SKILL-05 — Implémenter le moteur d'effets de compétences
**Priorité : P1 · Dépendances : SKILL-01, STAT-01**
 
**Travail à réaliser**
- Définir un format d'effet limité et typé (dégâts, soin, bouclier, altération).
- Créer un moteur métier qui applique les effets aux entités de combat.
- Valider cibles et paramètres.
- Ne jamais exécuter du code arbitraire stocké en base.
**Acceptation**
- Chaque type d'effet supporté a des tests.
- Un effet invalide est rejeté sans mutation partielle.
- Le moteur est indépendant d'Express.
---
 
# EPIC 06 — Monde, zones et monstres
 
## WORLD-01 — Créer le catalogue des zones
**Priorité : P1 · Dépendances : DB-03, SET-03**
 
**Travail à réaliser**
- Définir zones, niveaux recommandés, description et statut.
- Définir les conditions d'accès.
- Seed des zones initiales.
**Acceptation**
- Catalogue consultable.
- Une zone inconnue renvoie 404.
- Les conditions d'accès sont documentées.
## WORLD-02 — Créer le catalogue des monstres
**Priorité : P0 · Dépendances : DB-03, SET-03**
 
**Travail à réaliser**
- Définir modèle de monstre : nom, niveau, statistiques de base, type, récompenses et zone(s).
- Séparer modèle de référence et instance vivante de monstre.
- Ajouter quelques monstres de test cohérents avec le MVP.
**Acceptation**
- Les monstres de référence ne sont pas modifiables par les joueurs.
- Les données seedées sont validées.
- Le modèle distingue template et instance.
## WORLD-03 — Associer les monstres aux zones
**Priorité : P0 · Dépendances : WORLD-01, WORLD-02**
 
**Travail à réaliser**
- Définir les apparitions autorisées par zone et plages de niveau.
- Définir les taux/fréquences de spawn si nécessaires.
- Ajouter des données initiales.
**Acceptation**
- Une zone expose uniquement ses monstres configurés.
- Les associations invalides sont empêchées.
## WORLD-04 — Consulter les zones disponibles
**Priorité : P1 · Dépendances : WORLD-01**
 
**Endpoints proposés** : `GET /api/v1/zones`, `GET /api/v1/zones/:zoneId`
 
**Travail à réaliser**
- Retourner informations publiques et niveau conseillé.
- Ajouter pagination si utile.
- Ne pas exposer les paramètres administratifs.
**Acceptation**
- Liste et détail fonctionnent.
- Zone inconnue : 404.
## WORLD-05 — Consulter les monstres d'une zone
**Priorité : P0 · Dépendances : WORLD-03, AUTH-07**
 
**Endpoint proposé** : `GET /api/v1/zones/:zoneId/monsters`
 
**Travail à réaliser**
- Vérifier que la zone existe et est accessible.
- Retourner les monstres pertinents et informations publiques.
- Distinguer catalogue des monstres et instances actuellement disponibles.
**Acceptation**
- Résultat cohérent avec les associations zone-monstre.
- Les identifiants d'instances ne sont pas devinables si cela pose un risque.
## WORLD-06 — Déplacer un personnage vers une zone
**Priorité : P1 · Dépendances : CHAR-02, WORLD-01, AUTH-07**
 
**Endpoint proposé** : `POST /api/v1/characters/:characterId/move`
 
**Travail à réaliser**
- Vérifier propriété, existence de la zone et prérequis.
- Refuser le déplacement pendant un combat si cette règle est retenue.
- Mettre à jour la zone courante côté serveur.
- Ne pas accepter un déplacement vers une zone non autorisée.
**Acceptation**
- Déplacement autorisé persiste.
- Niveau insuffisant/zone inexistante/combat actif sont gérés.
- Le client ne peut pas modifier directement `currentZoneId`.
## WORLD-07 — Gérer les instances de monstres
**Priorité : P1 · Dépendances : WORLD-02, WORLD-03**
 
**Travail à réaliser**
- Définir le cycle de vie d'une instance : créée, disponible, engagée, vaincue, réapparition.
- Définir durée de vie et règles de respawn.
- Prévoir une stratégie compatible avec plusieurs joueurs.
- Éviter qu'une instance unique soit attribuée à deux combats incompatibles.
**Acceptation**
- Les transitions d'état sont explicites.
- Les transitions invalides sont refusées.
- Les accès concurrents sont couverts par tests.
---
 
# EPIC 07 — Combats
 
## COMBAT-01 — Définir le modèle et les états d'un combat
**Priorité : P0 · Dépendances : SET-03, CHAR-02, WORLD-07**
 
**Travail à réaliser**
- Définir états : préparé, en cours, victoire, défaite, fuite/annulé selon règles.
- Définir participants, monstre/instance, tour, dates et résultat.
- Définir les transitions autorisées.
- Définir si le MVP est strictement tour par tour.
**Acceptation**
- Diagramme d'état et règles écrits.
- Chaque transition a des préconditions.
- Les états terminaux ne peuvent pas redevenir actifs.
## COMBAT-02 — Créer un combat
**Priorité : P0 · Dépendances : COMBAT-01, CHAR-05, WORLD-07**
 
**Endpoint proposé** : `POST /api/v1/characters/:characterId/combat`
 
**Travail à réaliser**
- Vérifier propriété, état vivant, zone et disponibilité du monstre.
- Créer le combat et figer les données nécessaires au combat (snapshot des stats ou stratégie explicitée).
- Réserver l'instance du monstre de manière atomique.
- Retourner combatId, état, participants et premier acteur attendu.
**Acceptation**
- Un combat valide est créé.
- Un monstre indisponible ne peut pas être engagé.
- Deux requêtes concurrentes ne créent pas deux combats pour une instance exclusive.
- Les erreurs ne laissent aucune réservation orpheline.
**Postman** : combat valide, monstre inexistant, personnage tiers, personnage mort, monstre déjà engagé.
 
## COMBAT-03 — Définir l'ordre des tours
**Priorité : P0 · Dépendances : COMBAT-01**
 
**Travail à réaliser**
- Définir initiative et départage des égalités.
- Définir acteur courant.
- Avancer le tour uniquement après une action valide.
- Prévoir les effets de statut qui se déclenchent au début/fin de tour.
**Acceptation**
- Ordre déterministe selon les règles.
- Un acteur ne joue pas hors de son tour.
- Tests des égalités et transitions.
## COMBAT-04 — Implémenter le calcul des dégâts physiques
**Priorité : P0 · Dépendances : STAT-01, COMBAT-01, SET-03**
 
**Travail à réaliser**
- Implémenter la formule validée dans un service pur.
- Prendre en compte attaque, défense, bonus et réduction selon les règles.
- Borner les dégâts et définir les cas de minimum/maximum.
- Retourner un résultat détaillé interne utile aux tests et au journal de combat.
**Acceptation**
- Cas normaux, défense élevée, attaque minimale et bonus sont testés.
- Résultat identique pour les mêmes entrées si aucune mécanique aléatoire n'est prévue.
- Le calcul ne dépend pas d'Express ou de la base.
## COMBAT-05 — Implémenter les coups critiques et l'aléatoire
**Priorité : P1 · Dépendances : COMBAT-04, SET-03**
 
**Travail à réaliser**
- Définir taux critique et multiplicateur.
- Injecter une source aléatoire contrôlable par les tests.
- Définir les bornes de probabilité.
- Empêcher les valeurs de probabilité impossibles.
**Acceptation**
- Tests déterministes via RNG simulé.
- Critique et non-critique produisent les résultats attendus.
- Les bornes sont respectées.
## COMBAT-06 — Appliquer les dégâts à une cible
**Priorité : P0 · Dépendances : COMBAT-04, STAT-05**
 
**Travail à réaliser**
- Vérifier que la cible appartient au combat.
- Appliquer les dégâts et borner les PV à zéro.
- Détecter la mort.
- Mettre à jour l'état du combat si un participant atteint zéro PV.
- Effectuer les mutations atomiquement.
**Acceptation**
- PV ne deviennent jamais négatifs.
- Une cible hors combat ne peut pas être touchée.
- Une cible morte ne reçoit pas d'action.
- Les changements sont persistés ensemble.
## COMBAT-07 — Ajouter l'action d'attaque de base
**Priorité : P0 · Dépendances : COMBAT-02, COMBAT-03, COMBAT-06**
 
**Endpoint proposé** : `POST /api/v1/combat/:combatId/actions/attack`
 
**Travail à réaliser**
- Vérifier authentification, propriété du personnage participant, état du combat et tour courant.
- Valider la cible.
- Calculer et appliquer dégâts côté serveur.
- Enregistrer l'action et son résultat.
- Avancer le tour si l'action est valide.
**Acceptation**
- Attaque valide modifie les PV.
- Attaque hors tour, cible invalide ou combat terminé refusés.
- Le client ne transmet jamais le montant des dégâts.
## COMBAT-08 — Ajouter les actions des monstres
**Priorité : P0 · Dépendances : COMBAT-03, COMBAT-06**
 
**Travail à réaliser**
- Créer une logique IA simple et déterministe pour le MVP.
- Sélectionner une cible valide.
- Appliquer l'attaque du monstre via le même moteur de combat.
- Enregistrer l'action du monstre.
- Définir comment le tour monstre est déclenché dans le mode REST.
**Acceptation**
- Le monstre agit uniquement à son tour.
- Ses actions passent par le moteur commun.
- Les tests couvrent cible morte et fin de combat.
## COMBAT-09 — Consulter l'état du combat
**Priorité : P0 · Dépendances : COMBAT-02**
 
**Endpoint** : `GET /api/v1/combat/:combatId`
 
**Travail à réaliser**
- Vérifier que le demandeur a le droit de consulter le combat.
- Retourner état, participants, PV, tour et dernier résultat pertinent.
- Ne pas exposer les données internes non nécessaires.
**Acceptation**
- Combat existant accessible aux participants autorisés.
- Combat inconnu : 404.
- Joueur non autorisé : refus.
## COMBAT-10 — Gérer victoire et défaite
**Priorité : P0 · Dépendances : COMBAT-06, COMBAT-07, COMBAT-08**
 
**Travail à réaliser**
- Détecter les conditions de victoire/défaite.
- Passer le combat dans un état terminal une seule fois.
- Libérer ou mettre à jour l'instance du monstre.
- Déclencher les récompenses une seule fois.
- Empêcher toute nouvelle action sur combat terminé.
**Acceptation**
- Un combat terminé ne peut être modifié par une action de jeu.
- Les récompenses ne sont jamais attribuées deux fois.
- Tests des transitions et requêtes répétées.
## COMBAT-11 — Enregistrer l'historique des actions
**Priorité : P1 · Dépendances : COMBAT-07, COMBAT-08**
 
**Travail à réaliser**
- Enregistrer acteur, action, cible, horodatage, résultats et tour.
- Prévoir un ordre stable.
- Exposer un endpoint d'historique paginé si utile.
- Ne pas permettre au client de modifier l'historique.
**Acceptation**
- L'historique permet de reconstituer les actions.
- L'ordre est stable.
- Les actions refusées ne sont pas enregistrées comme actions réussies.
## COMBAT-12 — Ajouter l'utilisation de compétences en combat
**Priorité : P1 · Dépendances : SKILL-05, COMBAT-03, COMBAT-06**
 
**Endpoint proposé** : `POST /api/v1/combat/:combatId/actions/skill`
 
**Travail à réaliser**
- Vérifier compétence apprise, coût en ressources, cooldown, cible, portée et tour.
- Calculer effets côté serveur.
- Consommer ressources uniquement si l'action peut être exécutée.
- Appliquer l'effet et avancer le tour dans une transaction.
**Acceptation**
- Compétence valide appliquée.
- Mana insuffisant/cooldown/prérequis/cible invalide refusés sans consommation.
- Aucun effet partiel en cas d'échec.
## COMBAT-13 — Gérer l'abandon ou la fuite
**Priorité : P1 · Dépendances : COMBAT-01, COMBAT-02**
 
**Travail à réaliser**
- Définir conditions et coût éventuel d'une fuite.
- Vérifier que le personnage est autorisé à quitter.
- Mettre à jour le combat et l'instance du monstre.
- Définir si une pénalité ou récompense est appliquée.
**Acceptation**
- Fuite autorisée selon les règles.
- Combat terminé/état incompatible : refus.
- Les ressources et états restent cohérents.
---
 
# EPIC 08 — Objets, inventaire et équipement
 
## ITEM-01 — Définir le catalogue d'objets
**Priorité : P1 · Dépendances : DB-03, SET-03**
 
**Travail à réaliser**
- Définir type, rareté, niveau requis, poids éventuel, empilabilité, valeur et effets.
- Distinguer définition d'objet et exemplaire possédé.
- Ajouter des objets de test.
**Acceptation**
- Les objets de référence sont consultables.
- Les propriétés sont validées et documentées.
## ITEM-02 — Créer le modèle d'inventaire
**Priorité : P1 · Dépendances : ITEM-01, CHAR-02**
 
**Travail à réaliser**
- Définir inventaire, slots, quantité et relation personnage-objet.
- Définir capacité maximale et règles de pile.
- Prévoir contraintes d'unicité et quantité positive.
**Acceptation**
- Impossible d'avoir quantité nulle/négative.
- Les limites sont appliquées en base et service.
## ITEM-03 — Consulter l'inventaire
**Priorité : P1 · Dépendances : ITEM-02, AUTH-07**
 
**Endpoint** : `GET /api/v1/characters/:characterId/inventory`
 
**Travail à réaliser**
- Vérifier propriété.
- Retourner objets, quantités et informations utiles.
- Ajouter pagination si nécessaire.
**Acceptation**
- Inventaire du personnage courant uniquement.
- Inventaire vide : tableau vide.
## ITEM-04 — Ajouter et retirer des objets via les services internes
**Priorité : P1 · Dépendances : ITEM-02**
 
**Travail à réaliser**
- Créer des méthodes métier `addItem` et `removeItem`.
- Gérer empilement, capacité et quantité.
- Ne pas exposer d'endpoint permettant de créer arbitrairement des objets.
- Prévoir une transaction pour les opérations multi-lignes.
**Acceptation**
- Les invariants d'inventaire sont respectés.
- Les opérations insuffisantes ou impossibles échouent sans mutation partielle.
## ITEM-05 — Équiper et déséquiper un objet
**Priorité : P1 · Dépendances : ITEM-04, STAT-01**
 
**Endpoints proposés** : `POST /api/v1/characters/:characterId/equipment`, `DELETE /api/v1/characters/:characterId/equipment/:slot`
 
**Travail à réaliser**
- Définir les emplacements d'équipement.
- Vérifier possession, classe, niveau et compatibilité.
- Déplacer l'objet entre inventaire et équipement atomiquement.
- Recalculer les statistiques dérivées.
**Acceptation**
- Un objet non possédé ne peut être équipé.
- Un slot incompatible est refusé.
- Aucun objet n'est dupliqué/perdu.
- Les statistiques sont cohérentes après équipement.
## ITEM-06 — Ajouter l'utilisation d'objets consommables
**Priorité : P2 · Dépendances : ITEM-04, STAT-05**
 
**Travail à réaliser**
- Définir effets des consommables.
- Vérifier quantité, cible et conditions d'utilisation.
- Appliquer l'effet et décrémenter la quantité dans une transaction.
**Acceptation**
- Utilisation valide applique l'effet une seule fois.
- Utilisation invalide ne consomme pas l'objet.
---
 
# EPIC 09 — Récompenses, butin et économie
 
## REWARD-01 — Définir les tables de butin
**Priorité : P1 · Dépendances : WORLD-02, ITEM-01, SET-03**
 
**Travail à réaliser**
- Définir les tables de butin par monstre.
- Définir probabilités, quantités min/max et règles d'arrondi.
- Valider que la somme des probabilités suit la convention choisie.
- Injecter le générateur aléatoire pour les tests.
**Acceptation**
- Données invalides rejetées.
- Tests reproductibles.
- Aucun taux de drop négatif ou supérieur à la borne définie.
## REWARD-02 — Attribuer les récompenses de victoire
**Priorité : P0 · Dépendances : COMBAT-10, STAT-04, ITEM-04**
 
**Travail à réaliser**
- Calculer XP et butin côté serveur.
- Appliquer les récompenses dans une transaction.
- Garantir l'idempotence : un combat ne récompense qu'une seule fois.
- Enregistrer le détail des récompenses.
**Acceptation**
- Victoire attribue les récompenses attendues.
- Défaite/fuite n'attribue pas les récompenses de victoire.
- Deux appels concurrents ne doublent pas XP ou butin.
## ECO-01 — Définir le portefeuille du personnage
**Priorité : P1 · Dépendances : CHAR-02, SET-03**
 
**Travail à réaliser**
- Définir monnaies et solde.
- Définir limites et règles d'arrondi.
- Prévoir un journal des mouvements plutôt qu'une modification opaque du solde.
**Acceptation**
- Solde jamais négatif sauf règle explicitement définie.
- Chaque variation est traçable.
## ECO-02 — Ajouter un journal de transactions
**Priorité : P1 · Dépendances : ECO-01**
 
**Travail à réaliser**
- Enregistrer source, destination, montant, motif, date et référence métier.
- Empêcher les doublons via une clé d'idempotence/référence unique si nécessaire.
- Rendre le journal non modifiable par les joueurs.
**Acceptation**
- Chaque mouvement de monnaie a une trace.
- Un même événement ne peut être comptabilisé deux fois.
## ECO-03 — Créer un service de transfert de monnaie
**Priorité : P2 · Dépendances : ECO-02, AUTH-07**
 
**Travail à réaliser**
- Définir si les transferts entre joueurs sont autorisés.
- Vérifier propriété, solde et limites.
- Débiter/créditer atomiquement.
- Prévenir les transferts répétés et les courses concurrentes.
 
**Acceptation**
- Un transfert est entièrement appliqué ou pas du tout.
- Solde insuffisant refusé.
- Tests de concurrence et idempotence.
---
 
# EPIC 10 — Quêtes
 
## QUEST-01 — Définir le catalogue de quêtes
**Priorité : P2 · Dépendances : DB-03, SET-03**
 
**Travail à réaliser**
- Définir titre, description, prérequis, objectifs et récompenses.
- Définir types d'objectifs pris en charge.
- Valider les données seedées.
**Acceptation**
- Catalogue valide et documenté.
- Les types d'objectifs sont explicitement supportés.
## QUEST-02 — Accepter une quête
**Priorité : P2 · Dépendances : QUEST-01, CHAR-02**
 
**Travail à réaliser**
- Vérifier prérequis, disponibilité et limites de quêtes actives.
- Créer la progression propre au personnage.
- Empêcher les acceptations en double.
**Acceptation**
- Quête acceptée si conditions remplies.
- Quête inconnue ou prérequis non remplis refusés.
## QUEST-03 — Mettre à jour les objectifs de quête
**Priorité : P2 · Dépendances : QUEST-02, COMBAT-10**
 
**Travail à réaliser**
- Créer un service de progression déclenché par les événements métier.
- Ne pas accepter un compteur fourni par le client.
- Gérer objectifs multiples et objectifs déjà terminés.
**Acceptation**
- Seuls les événements serveur font progresser une quête.
- Les compteurs ne dépassent pas les objectifs.
- Les événements répétés sont traités de façon idempotente.
## QUEST-04 — Terminer une quête et attribuer les récompenses
**Priorité : P2 · Dépendances : QUEST-03, REWARD-02**
 
**Travail à réaliser**
- Vérifier tous les objectifs.
- Marquer la quête terminée.
- Attribuer récompenses une seule fois et atomiquement.
- Conserver un historique de complétion.
**Acceptation**
- Quête incomplète non validable.
- Récompense attribuée une seule fois.
- État final consultable.
---
 
# EPIC 11 — Qualité, sécurité et exploitation
 
## QUAL-01 — Vérifier les permissions sur toutes les ressources
**Priorité : P0 · Dépendances : AUTH-07, CHAR-03**
 
**Travail à réaliser**
- Auditer chaque route qui accepte un identifiant de ressource.
- Vérifier propriété et permissions dans les services.
- Ajouter des tests d'accès croisé entre deux comptes.
- Ne pas se limiter à cacher les identifiants dans le Front-End.
**Acceptation**
- Les tests démontrent qu'un compte A ne modifie/lit pas les ressources privées de B.
- Chaque endpoint protégé a une règle d'accès documentée.
## QUAL-02 — Ajouter le rate limiting aux endpoints sensibles
**Priorité : P1 · Dépendances : FND-08, AUTH-06**
 
**Travail à réaliser**
- Définir des limites pour login, inscription et actions coûteuses.
- Configurer stockage partagé si plusieurs instances serveur sont envisagées.
- Retourner 429 avec format d'erreur standard.
**Acceptation**
- Le dépassement est détecté.
- Les limites sont configurables par environnement.
- Les tests ne reposent pas sur des délais fragiles.
## QUAL-03 — Gérer les transactions et accès concurrents
**Priorité : P0 · Dépendances : DB-04, COMBAT-02, REWARD-02**
 
**Travail à réaliser**
- Identifier les opérations multi-écritures : création combat, fin combat, récompenses, inventaire, monnaie.
- Utiliser transactions et contraintes/locking adaptés.
- Définir stratégie de conflit et idempotence.
- Tester deux requêtes simultanées sur la même ressource.
**Acceptation**
- Pas de duplication d'objets, XP ou monnaie lors de requêtes concurrentes.
- Les opérations échouées ne laissent pas d'état partiel.
## QUAL-04 — Ajouter pagination, filtres et limites
**Priorité : P1 · Dépendances : SET-05**
 
**Travail à réaliser**
- Définir un format uniforme de pagination.
- Appliquer une limite maximale de résultats.
- Valider filtres et tris autorisés par endpoint.
- Ajouter des index de base si justifié.
**Acceptation**
- Les endpoints de liste ne renvoient pas un volume illimité.
- Les paramètres invalides renvoient 400.
- La pagination est documentée.
## QUAL-05 — Ajouter tests d'intégration des parcours MVP
**Priorité : P0 · Dépendances : AUTH-06, CHAR-05, WORLD-05, COMBAT-10, REWARD-02**
 
**Travail à réaliser**
- Créer un scénario automatisé complet avec base de test isolée.
- Créer deux comptes pour vérifier l'isolation des données.
- Tester succès, erreur et répétition d'une action sensible.
- Nettoyer les données entre tests.
**Acceptation**
- Le parcours compte → personnage → zone → combat → récompense passe en CI/local.
- Les tests sont reproductibles.
- Les tests vérifient la persistance après relecture.
## QUAL-06 — Ajouter une configuration de production
**Priorité : P1 · Dépendances : FND-02, QUAL-02**
 
**Travail à réaliser**
- Documenter variables, secrets, migrations, logs, CORS, reverse proxy et HTTPS.
- Définir gestion des erreurs et arrêt propre.
- Ajouter une checklist de déploiement.
- Ne pas commiter de configuration contenant de vrais secrets.
**Acceptation**
- Un nouvel environnement peut être configuré depuis la documentation.
- Les secrets sont injectés hors du dépôt.
- Le serveur s'arrête proprement.
## QUAL-07 — Vérifier les performances des endpoints critiques
**Priorité : P2 · Dépendances : QUAL-05**
 
**Travail à réaliser**
- Définir un petit scénario de charge réaliste.
- Mesurer endpoints de lecture et actions de combat.
- Repérer requêtes N+1, index manquants et opérations coûteuses.
- Optimiser uniquement à partir de mesures.
**Acceptation**
- Un rapport de mesure est fourni.
- Les optimisations ne changent pas le comportement métier.
- Les limites observées sont documentées.
---
 
# EPIC 12 — Documentation, Postman et intégration future
 
## DOC-01 — Organiser la collection Postman
**Priorité : P0 · Dépendances : FND-07**
 
**Travail à réaliser**
- Organiser les requêtes par dossiers : Health, Auth, Users, Characters, Classes, World, Combat, Inventory, Quests.
- Définir variables `baseUrl`, `accessToken`, `characterId`, `combatId` et autres identifiants utiles.
- Ne pas commiter de token réel.
- Utiliser des exemples de payload valides et invalides.
**Acceptation**
- La collection est importable.
- Les variables d'environnement sont documentées.
- Les requêtes sont nommées selon leur action.
## DOC-02 — Ajouter les tests Postman aux requêtes
**Priorité : P0 · Dépendances : DOC-01**
 
**Travail à réaliser**
- Vérifier code HTTP et structure JSON.
- Extraire les identifiants créés dans les variables d'environnement.
- Ajouter des tests pour erreurs attendues.
- Éviter que les tests dépendent d'identifiants codés en dur.
**Acceptation**
- Les scénarios principaux peuvent être exécutés dans l'ordre.
- Les tests détectent un code HTTP inattendu.
- Les variables sont réinitialisables.
## DOC-03 — Documenter l'API avec OpenAPI
**Priorité : P1 · Dépendances : SET-05, FND-07**
 
**Travail à réaliser**
- Choisir génération OpenAPI depuis le code ou spécification maintenue.
- Documenter routes, schémas, authentification, réponses et erreurs.
- Ajouter exemples de requêtes/réponses.
- Maintenir la documentation à chaque évolution d'endpoint.
 
**Acceptation**
- La spécification est valide.
- Toutes les routes MVP sont documentées.
- Un développeur externe peut tester l'API sans lire le code source.
## DOC-04 — Documenter les règles métier et les erreurs
**Priorité : P1 · Dépendances : SET-03, FND-03**
 
**Travail à réaliser**
- Documenter règles de progression, combat, récompenses et inventaire.
- Lister erreurs métier et conditions de déclenchement.
- Distinguer erreur de validation, permission et conflit métier.
**Acceptation**
- Les règles correspondent au code et aux tests.
- Les exemples sont à jour.
## DOC-05 — Préparer l'intégration d'un futur client
**Priorité : P1 · Dépendances : DOC-03**
 
**Travail à réaliser**
- Documenter le flux d'authentification et les endpoints à appeler dans l'ordre.
- Définir DTO stables et champs optionnels/nullables.
- Documenter pagination, erreurs et stratégie de version.
- Fournir un exemple de parcours Postman réutilisable par un futur client.
- Ne développer aucun Front-End dans ce ticket.
**Acceptation**
- Un développeur Front-End peut comprendre comment créer un compte, se connecter, sélectionner un personnage et consulter son état.
- Les réponses ne nécessitent pas de connaître les modèles internes de la base.
## DOC-06 — Préparer l'évolution temps réel sans l'implémenter
**Priorité : P2 · Dépendances : COMBAT-01, QUAL-03**
 
**Travail à réaliser**
- Vérifier que les règles de combat sont dans des services indépendants d'Express.
- Identifier les événements métier à publier plus tard : combat commencé, tour joué, dégâts, victoire, récompense.
- Documenter une architecture future WebSocket/Socket.IO.
- Ne pas ajouter de dépendance temps réel dans ce ticket.
**Acceptation**
- Les services métier peuvent être appelés depuis HTTP ou un futur adaptateur temps réel.
- Le document distingue clairement état actuel REST et besoins temps réel futurs.
---
 
# Ordre de réalisation recommandé
 
## Phase A — Sécuriser le socle
`SET-01 → SET-05 → FND-01 à FND-08`
 
## Phase B — Persister et sécuriser les comptes
`DB-01 → DB-04 → AUTH-01 à AUTH-07 → AUTH-08 à AUTH-10`
 
## Phase C — Premier personnage jouable
`CHAR-01 → CHAR-07 → STAT-01 à STAT-05`
 
## Phase D — Monde et premier combat
`WORLD-01 → WORLD-07 → COMBAT-01 à COMBAT-10`
 
## Phase E — Récompenses et parcours MVP complet
`ITEM-01 → ITEM-04 → REWARD-01 → REWARD-02 → QUAL-05`
 
## Phase F — Extensions
Compétences, équipement, économie, quêtes, groupes/guildes, performances et temps réel.
 
> Ne pas commencer plusieurs modules avancés en parallèle avant d'avoir un parcours MVP complet et testé.
 
---
 
# Format conseillé pour créer les issues GitHub
 
Pour chaque ticket, conserver :
- **Titre** : `[ID] Verbe + résultat attendu`
- **Epic** : nom de l'épic
- **Priorité** : P0 / P1 / P2
- **Dépendances** : IDs des tickets requis
- **Objectif**
- **Contexte**
- **Travail à réaliser**
- **Critères d'acceptation** sous forme de checklist
- **Tests automatisés**
- **Tests Postman**
- **Risques / décisions à valider**
Labels recommandés : `epic:foundations`, `epic:auth`, `epic:characters`, `epic:combat`, `priority:P0`, `priority:P1`, `priority:P2`, `type:feature`, `type:bug`, `type:tech-debt`, `status:blocked`.
 
## Règle finale à donner à l'agent
 
Ne traite qu'un ticket à la fois. Avant de coder, vérifie ses dépendances et l'état réel du dépôt. Si une information de gameplay ou d'architecture manque, pose la question ou marque-la comme décision à valider ; ne l'invente pas. Ne ferme jamais un ticket uniquement parce que le code compile : les critères d'acceptation, tests automatisés, tests Postman et documentation doivent aussi être satisfaits.