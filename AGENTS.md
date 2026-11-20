# AGENTS.md — BackendNode

## 1. Présentation du projet

- **Projet :** API REST Backend pour un MMORPG inspiré de World of Warcraft et Runes of Magic.
- **Objectif :** construire une API robuste, sécurisée, testée et documentée, couvrant notamment les comptes, personnages, statistiques, compétences, monstres, combats, objets, inventaires, quêtes, zones, groupes, guildes et économie.
- **Contexte :** projet d'un étudiant en 3ᵉ année de Bachelor informatique, spécialisation développement.
- **Périmètre :** backend uniquement. Ne jamais développer de Front-End.
- **Outils de test :** Vitest, Supertest, Postman et curl.

L'agent agit comme un développeur Backend expérimenté qui accompagne l'étudiant. Il doit expliquer ses choix techniques et leurs conséquences, sans simplifier excessivement ni introduire de complexité inutile.

### Règle fondamentale

Le serveur ne fait jamais confiance au client. Les règles du jeu, calculs (dégâts, XP, monnaie, statistiques, niveaux) et vérifications de droits sont effectués côté serveur. Le client transmet une intention ; le serveur vérifie, calcule et renvoie le résultat.

## 2. Documents de référence

| Document | Rôle |
|---|---|
| `Backlog_API_Mmorpg.md` | Backlog principal : tickets, priorités, dépendances et critères d'acceptation. |
| `docs/api/conventions.md` | Contrat HTTP : routes, réponses, erreurs, statuts et conventions. |
| `docs/architecture/current-state.md` | État initial du projet ; document historique qui peut être dépassé. |
| `docs/architecture/backlog-adaptations.md` | Journal d'avancement : décisions, adaptations, fichiers modifiés et tests. |
| `AGENTS.md` | Instructions communes aux agents IA. |
| `CLAUDE.md` | Instructions complémentaires propres à Claude Code. |

Le backlog à la racine du dépôt est la référence pour l'ordre des tickets et leurs critères d'acceptation. Ne pas inventer, supprimer ou réorganiser des tickets sans validation.

Les documents et le code peuvent évoluer. Toujours vérifier leur état réel avant de commencer un travail. En cas de contradiction, signaler le problème et demander une décision si nécessaire.

## 3. Stack et architecture

### Stack actuelle

- Node.js 22.x et npm.
- TypeScript en mode strict.
- Express 4, Zod 4 et cors.
- ESM (`"type": "module"`).
- tsx et nodemon pour le développement.
- tsup pour compiler vers `dist/server.cjs` en CommonJS.
- Pino et pino-http pour les logs.
- Helmet pour les en-têtes de sécurité.
- express-rate-limit pour la limitation du débit.
- Vitest et Supertest pour les tests.
- Configuration centralisée dans `src/config/environment.ts`.
- Chargement natif du `.env` avec `process.loadEnvFile()`, sans dotenv.

Les versions indiquées dans `package.json` et le lockfile font foi. Avant d'ajouter ou de mettre à jour une dépendance, vérifier les versions réellement installées et justifier le changement.

Toute nouvelle dépendance doit être justifiée et documentée dans `docs/architecture/backlog-adaptations.md`.

### Base de données : décisions prises, mise en place à venir

Les choix de principe validés sont :
- PostgreSQL 18.
- Prisma ORM 7.10.1.
- `@prisma/adapter-pg` avec un pool `pg.Pool` géré par l'application.
- UUID v7 comme identifiant en base, générés par PostgreSQL 18 (`uuidv7()`).
- Tests utilisant PostgreSQL : variable dédiée `TEST_DATABASE_URL`, jamais `DATABASE_URL`.
- Détail des décisions : `docs/architecture/database.md`.
- Docker Compose avec l'image PostgreSQL 18 pour l'environnement local.
- `DATABASE_URL` obligatoire en développement et en production, mais facultative pour les tests unitaires existants.
- Base de test dédiée nommée exactement `mmorpg_test`, avec une protection empêchant les tests d'utiliser une autre base.
- Les tests existants doivent continuer à fonctionner sans base de données ; les tests nécessitant PostgreSQL sont lancés séparément.

Ces décisions ne signifient pas que PostgreSQL, Docker ou Prisma sont déjà installés. Vérifier le backlog et l'avancement réel avant toute installation.

Le choix de la base et de l'ORM est documenté par SET-04. DB-01 nécessite en plus Docker installé sur le poste.

Le repository utilisateur actuellement en mémoire est temporaire. Ne pas créer de nouvelle persistance définitive en mémoire.

## 4. Architecture et règles de développement

Respecter strictement la séparation des responsabilités :

| Couche | Responsabilité |
|---|---|
| Routes | Déclarer les endpoints et brancher les middlewares. |
| Controllers | Lire la requête, appeler les services et construire la réponse HTTP. |
| Services | Contenir les règles métier, calculs et vérifications. |
| Repositories | Gérer les accès aux données. |
| Schemas | Valider strictement les entrées avec Zod. |
| Middlewares | Gérer les traitements transversaux : sécurité, logs, validation, authentification et erreurs. |
| Config / Utils | Centraliser la configuration et les fonctions réutilisables. |

Principes à respecter :
- Aucune logique métier dans les routes ou controllers.
- Les services ne doivent pas dépendre d'Express (`req`, `res`).
- Les services doivent pouvoir être réutilisés plus tard par un adaptateur WebSocket, sans implémenter le temps réel maintenant.
- Séparer les données de référence des instances propres aux joueurs.
- Utiliser des transactions pour les opérations sensibles : inventaire, récompenses, achats et échanges.
- Éviter les abstractions inutiles et les duplications.
- Ne pas réécrire du code fonctionnel sans raison valable.

### Qualité TypeScript

- Conserver le mode strict.
- Éviter `any` et les transtypages injustifiés.
- Utiliser des types explicites et des noms compréhensibles.
- Centraliser les constantes et éviter les valeurs magiques.
- Avec Express 4, vérifier que les erreurs des handlers asynchrones atteignent bien le middleware d'erreurs.

## 5. Contrat API et sécurité

Avant de créer ou modifier un endpoint, lire `docs/api/conventions.md`.

Conventions actuelles :
- Les routes métier utilisent le préfixe `/api/v1`.
- `GET /health` est indépendant du préfixe.
- Les réponses suivent les enveloppes définies dans les conventions.
- Les erreurs utilisent le format centralisé et des codes documentés.
- Les entrées inconnues ou interdites sont rejetées, jamais ignorées.
- Les messages de l'API et les codes d'erreur sont en anglais.
- Les messages techniques destinés au développeur au démarrage sont en français.

Exigences de sécurité permanentes :
- Hacher les mots de passe ; ne jamais les stocker en clair.
- Vérifier les tokens et les autorisations côté serveur.
- Vérifier la propriété de chaque ressource : connaître un UUID ne donne aucun droit.
- Ne jamais exposer de secret, hash, token, variable d'environnement, trace ou requête SQL dans une réponse.
- Ne jamais journaliser les mots de passe, tokens, cookies, corps ou paramètres de requête.
- Ne jamais placer de secret dans une URL.
- Respecter les protections HTTP existantes : Helmet, CORS, limite de taille JSON, contrôle Content-Type et rate limiting.
- Toute nouvelle règle de sécurité doit être testée et documentée.

## 6. Tests et validation

Tests actuels :
- Vitest et Supertest.
- `tests/unit/` pour les tests unitaires.
- `tests/integration/` pour les tests HTTP.
- Les tests ne doivent pas importer `server.ts`.
- Les modules avec état doivent être isolés conformément aux helpers existants.
- Les tests doivent couvrir les cas nominaux, erreurs, limites et non-régressions.
- Les tests utilisant PostgreSQL devront employer exclusivement la base de test dédiée.

Dernier état connu : **219 tests validés après FND-08**. Ce nombre doit être vérifié dans le dépôt avant d'être présenté comme l'état actuel.

Commandes principales :

| Commande | Utilité |
|---|---|
| `npm run dev` | Démarrage en développement. |
| `npm run typecheck` | Vérification TypeScript. |
| `npm run build` | Vérification et compilation. |
| `npm start` | Démarrage de la version compilée. |
| `npm test` | Exécution des tests. |
| `npx vitest run --sequence.shuffle` | Vérification des tests dans un ordre aléatoire. |

Avant de déclarer un ticket terminé, exécuter les vérifications adaptées, notamment le typecheck, les tests et le build. Ne jamais annoncer un test réussi s'il n'a pas réellement été exécuté.

Postman est l'outil principal de validation manuelle. Les collections sont à créer dans le ticket DOC-01.

## 7. État d'avancement connu

Les tickets suivants sont validés :
- SET-01 et SET-05.
- FND-01, FND-02, FND-03 et FND-04.
- FND-06, FND-07, FND-08 et FND-09 (ticket additionnel).
- FND-05.
- SET-04.

Derniers commits connus :
- FND-09 : `996dc8e`.
- FND-05 : `b1d706e`.
- FND-08 : `2583814`.

FND-08 est **validé**, et non en attente de validation.

État fonctionnel connu :
- API de gestion des utilisateurs (CRUD en mémoire).
- Pas encore de persistance PostgreSQL.
- Pas encore d'authentification.
- Pas encore de Front-End.

Ces informations sont un point de repère, pas une preuve de l'état actuel. Vérifier Git, les fichiers, les scripts et les tests avant chaque intervention.

## 8. Méthode de travail obligatoire

### Organisation

1. Travailler sur **un seul ticket à la fois**.
2. Respecter les dépendances et l'ordre du backlog.
3. Vérifier l'état réel du dépôt avant toute proposition.
4. Analyser le ticket avant de coder : objectif, prérequis, fichiers concernés, risques et critères d'acceptation.
5. Présenter les décisions structurantes sous forme de points D1, D2, etc., et attendre leur validation.
6. Signaler les adaptations au plan sous forme de points E1, E2, etc.
7. Ne jamais prendre seul une décision structurante : base de données, ORM, authentification, dépendance, changement cassant ou règle métier importante.

### Rythme de réalisation

- Ticket simple : une étape peut suffire.
- Ticket intermédiaire : privilégier une étape d'implémentation puis une étape de validation et documentation.
- Ticket complexe : découper davantage uniquement si nécessaire.
- Ne pas multiplier artificiellement les étapes ni passer au ticket suivant avant validation du ticket en cours.

### Règle impérative : approbation avant chaque modification

L'utilisateur souhaite garder le contrôle de toutes les modifications du projet.

**Avant chaque modification d'un fichier :**
1. Présenter le chemin du fichier.
2. Expliquer précisément ce qui va changer et pourquoi.
3. Présenter le contenu complet proposé ou un diff suffisamment détaillé.
4. Attendre une autorisation explicite de l'utilisateur.
5. Ne modifier que ce fichier après autorisation.
6. Vérifier le résultat et présenter ce qui a été réalisé avant de proposer le fichier suivant.

Une autorisation concernant un fichier ne vaut jamais autorisation pour un autre fichier.

Cette règle s'applique également aux modifications de configuration, scripts, dépendances et fichiers générés.

**Avant toute commande modifiant le dépôt, l'environnement ou des données**, expliquer son effet et attendre une autorisation explicite. Cela inclut notamment l'installation de paquets, les migrations, les suppressions, les changements de configuration et les commandes Git qui modifient l'état du dépôt.

Les commandes de lecture et de diagnostic non destructives peuvent être exécutées sans cette autorisation.

Ne jamais effectuer de commit, push, changement de branche, reset, rebase ou autre opération Git modifiant l'historique sans autorisation explicite.

Une validation ne doit jamais être supposée à partir du silence de l'utilisateur. En cas de doute, demander confirmation.

## 9. Documentation et Git

Après chaque ticket, mettre à jour les documents concernés :
- `docs/architecture/backlog-adaptations.md` : statut, décisions, adaptations, fichiers et tests.
- `docs/api/conventions.md` : évolution du contrat HTTP et des codes d'erreur.
- `.env.example` : toute nouvelle variable d'environnement.
- `AGENTS.md` : uniquement si les instructions, la stack ou les commandes évoluent.
- `Backlog_API_Mmorpg.md` : statut du ticket si le format du backlog le prévoit.

Git :
- Utiliser des messages Conventional Commits en français, en mentionnant le ticket.
- Ne jamais committer `.env`, des secrets, `node_modules/` ou `dist/`.
- Ne jamais committer ou pousser sans autorisation explicite.

## 10. Communication

- Toujours répondre en français.
- Expliquer les choix importants et leurs conséquences.
- Être précis, direct et pédagogique.
- Distinguer clairement ce qui a été vérifié, ce qui est proposé et ce qui reste à faire.
- Signaler les risques, incohérences et prérequis manquants.
- Ne jamais prétendre avoir lu, modifié, exécuté ou testé quelque chose qui ne l'a pas été.