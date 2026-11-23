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
| `docs/architecture/database.md` | Décisions et mise en place de la base de données. |
| `docs/architecture/data-model.md` | Modèle de données : tables, contraintes, politique de suppression, invariants. |
| `docs/gameplay/mvp-scope.md`, `docs/gameplay/rules.md` | Parcours du MVP et règles de jeu chiffrées : référence obligatoire pour tout ticket de gameplay. |
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

### Base de données

Les choix validés (SET-04) et mis en place (DB-01) sont :
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

Prisma, `pg` et la configuration Docker sont installés (DB-01). Le serveur vérifie la base avant d'ouvrir son port : `npm run dev` et `npm start` exigent un `.env` (modèle : `.env.example`) et PostgreSQL démarré (`npm run db:up`, Docker Desktop requis). Le client Prisma est généré dans `src/generated/prisma/` (ignoré par Git) ; le build CommonJS utilise l'option `--shims` de tsup.

Les repositories Prisma (`src/repositories/`) sont la seule couche qui accède à la base (DB-04). Les services sont construits avec le repository qu'on leur fournit : `server.ts` assemble les versions Prisma, les tests peuvent fournir un repository contrôlé (`tests/helpers/`). Ne pas créer de persistance en mémoire dans `src/`.

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
- `tests/database/` pour les tests utilisant PostgreSQL : exclusivement la base `mmorpg_test`, protégée par `tests/helpers/test-database.ts`, et lancés uniquement par `npm run test:db`.

Dernier état connu : **302 tests validés après DB-04** (`npm test`, sans base) et **61 tests base de données** (`npm run test:db`). Ce nombre doit être vérifié dans le dépôt avant d'être présenté comme l'état actuel.

Commandes principales :

| Commande | Utilité |
|---|---|
| `npm run dev` | Démarrage en développement. |
| `npm run typecheck` | Vérification TypeScript. |
| `npm run build` | Vérification et compilation. |
| `npm start` | Démarrage de la version compilée. |
| `npm test` | Exécution des tests. |
| `npx vitest run --sequence.shuffle` | Vérification des tests dans un ordre aléatoire. |
| `npm run test:db` | Tests base de données (PostgreSQL démarré, `TEST_DATABASE_URL`). |
| `npm run db:up` / `npm run db:down` | Démarrage / arrêt du conteneur PostgreSQL. |
| `npm run db:generate`, `db:migrate`, `db:status`, `db:reset` | Client Prisma et migrations (`db:reset` est destructif). |
| `npm run db:seed` | Données de référence (idempotent, à relancer après `db:reset`). |

Avant de déclarer un ticket terminé, exécuter les vérifications adaptées, notamment le typecheck, les tests et le build. Ne jamais annoncer un test réussi s'il n'a pas réellement été exécuté.

Postman est l'outil principal de validation manuelle. Les collections sont à créer dans le ticket DOC-01.

## 7. État d'avancement connu

Les tickets suivants sont validés :
- SET-01 et SET-05.
- FND-01, FND-02, FND-03 et FND-04.
- FND-06, FND-07, FND-08 et FND-09 (ticket additionnel).
- FND-05.
- SET-04.
- SET-02 et SET-03.
- DB-01.
- DB-02 et DB-03.
- DB-04.

Derniers commits connus :
- DB-02 et DB-03 : `d6285f5`.
- DB-01 : `f858ab4`.
- SET-04 : `ea106ef`.
- FND-09 : `996dc8e`.
- FND-05 : `b1d706e`.
- FND-08 : `2583814`.

FND-08 est **validé**, et non en attente de validation.

État fonctionnel connu :
- API de gestion des utilisateurs (CRUD persistant dans PostgreSQL, identifiants UUID).
- PostgreSQL et Prisma configurés (DB-01) ; modèle, migration `init` et données de référence en place (DB-02, DB-03) ; repositories persistants des utilisateurs et des personnages (DB-04).
- Pas encore d'authentification.
- Pas encore de Front-End.

Ces informations sont un point de repère, pas une preuve de l'état actuel. Vérifier Git, les fichiers, les scripts et les tests avant chaque intervention.

## 8. Méthode de travail obligatoire

### Organisation

1. Regrouper les tickets compatibles dans un même lot ; sinon, travailler sur un ticket à la fois.
2. Respecter les dépendances et l'ordre du backlog.
3. Vérifier l'état réel du dépôt avant toute proposition.
4. Analyser le ticket avant de coder : objectif, prérequis, fichiers concernés, risques et critères d'acceptation.
5. Présenter les décisions structurantes sous forme de points D1, D2, etc., et attendre leur validation.
6. Signaler les adaptations au plan sous forme de points E1, E2, etc.
7. Ne jamais prendre seul une décision structurante : base de données, ORM, authentification, dépendance, changement cassant ou règle métier importante.

### Trois phases par ticket ou lot

**Phase 1 — Analyse et préparation.** Analyser les tickets et les fichiers existants, identifier dépendances, problèmes et décisions réellement nécessaires, regrouper les tickets compatibles. Présenter **une seule synthèse** : travail prévu, fichiers concernés, commandes importantes, décisions. Ne pas détailler chaque fichier sur plusieurs échanges. Attendre l'**accord global** de l'utilisateur.

**Phase 2 — Réalisation et vérification.** Après l'accord : modifier directement les fichiers du périmètre validé, exécuter installations, commandes et tests, corriger les problèmes, sans demander de confirmation intermédiaire. S'arrêter uniquement sur un problème bloquant ou une décision non prévue, et ne demander que la clarification nécessaire. Bilan final :
- fichiers créés et modifiés ;
- résumé des changements ;
- commandes exécutées ;
- résultats des tests et vérifications ;
- `git diff` complet ou présentation suffisamment détaillée ;
- points restant à traiter.

**Phase 3 — Validation et commit.** L'utilisateur examine le bilan. Le commit puis le push nécessitent chacun son **autorisation explicite**.

### Garde-fous

- Ne modifier aucun fichier hors du périmètre validé.
- Une compilation ne suffit pas : exécuter les tests pertinents.
- Si une vérification est impossible (par exemple Docker absent), le dire clairement, sans la présenter comme réussie.
- Ne jamais effectuer de commit, push, changement de branche, reset, rebase ou autre opération Git modifiant l'historique sans autorisation explicite.
- Une validation ne doit jamais être supposée à partir du silence de l'utilisateur. En cas de doute, demander confirmation.

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