# État actuel du dépôt (SET-01)

> **Statut :** constat. Ce document décrit ce qui existe dans le dépôt, pas ce qui est prévu.
> Les fonctionnalités prévues figurent dans le backlog et dans `docs/api/conventions.md`.

## 1. Référence

- Dépôt : `Tom0204/BackendNode`, branche `main` (seule branche distante).
- Commit décrit : `818a426` (2026-11-17 12:12, « feat: configuration centralisée et validation des variables d'environnement »).
- Date de rédaction : 2026-11-17.

## 2. Sources des constats

Chaque constat porte l'une des mentions suivantes.

| Mention | Signification |
|---|---|
| **[E-818a426]** | Vérifié par exécution par Claude sur un clone neuf au commit `818a426` (Linux, Node 22.23.4). |
| **[E-29c5611]** | Vérifié par exécution par Claude sur un clone neuf au commit `29c5611` (Linux, Node 22.23.4). Non rejoué depuis. |
| **[E-a6cf863]** | Vérifié par exécution par Claude sur une copie du dépôt au commit `a6cf863` (Linux, Node 22.23.4). Non rejoué depuis. |
| **[L]** | Constaté par lecture du code ou des fichiers, sans exécution. |
| **[R]** | Vérification rapportée par le propriétaire du projet (Windows, Node 22.23.2), non observée directement par Claude. |

Les résultats **[E-a6cf863]** concernant les endpoints restent représentatifs si le code des routes, controllers, services et repositories n'a pas changé de façon significative depuis ce commit. Contrôles effectués :
- `29c5611` : ajout de `.gitignore` et retrait de `node_modules/` de l'index uniquement [E-29c5611].
- `818a426` : ne modifie que `server.ts`, `src/config/environment.ts`, `.env.example` et `docs/architecture/backlog-adaptations.md` [E-818a426].
- `4450c2d` : la présence des modifications prévues a été lue (deux affectations inutilisées retirées dans `user.service.ts`, `tsconfig.json`, scripts npm) [L]. L'absence de toute autre modification n'a pas été vérifiée par un diff.

L'audit initial (premier rapport du 2026-11-17) avait été réalisé sur une reconstitution des fichiers fournis, pas sur le dépôt. Il n'est pas utilisé comme source ici.

## 3. Historique récent

| Commit | Date | Message |
|---|---|---|
| `9acf310` | 2026-11-16 13:38 | splitting server.ts for clean archi |
| `5802834` | 2026-11-16 14:32 | Adding zod to project |
| `b7d814b` | 2026-11-16 14:33 | changing import of server.ts |
| `a6cf863` | 2026-11-16 14:52 | Fixing npm run dev problem |
| `29c5611` | 2026-11-17 10:51 | chore: ignorer node_modules et ajout de .gitignore |
| `4450c2d` | 2026-11-17 11:23 | chore: configuration TypeScript strict et correction script start |
| `818a426` | 2026-11-17 12:12 | feat: configuration centralisée et validation des variables d'environnement |

- L'historique antérieur à `9acf310` n'a pas été examiné (clone superficiel).
- `node_modules/` était versionné jusqu'à `a6cf863` inclus (3 161 fichiers sur 3 175 suivis) [E-a6cf863]. Il reste présent dans l'historique Git.

## 4. Stack et outillage

| Élément | Déclaré (`package.json`) | Installé / observé |
|---|---|---|
| Node.js | non déclaré (`engines` absent) | 22.23.4 [E-818a426] ; 22.23.2 [R]. `process.loadEnvFile()` exige Node ≥ 20.12 [L] |
| TypeScript | `^5.3.3` (dev) | 5.9.3 [E-a6cf863] |
| Express | `^4.18.2` | version exacte non relevée (voir `package-lock.json`) |
| cors | `^2.8.6` | non relevée |
| zod | `^4.6.7` | non relevée ; utilisé uniquement par la configuration [L] |
| tsx | `^4.23.15` (dev) | non relevée |
| nodemon | `^3.0.3` (**dépendance de production**) | 3.1.14 [E-a6cf863] |
| tsup | `^8.0.1` (dev) | 8.5.1 [E-a6cf863] |
| ts-node | `^10.9.2` (dev) | non utilisé par les scripts ni par le code [L] |
| Types | `@types/cors ^2.8.17`, `@types/express ^4.17.21`, `@types/node ^20.11.7` | types Node 20 pour un runtime Node 22 [L] |

- **Modules :** `"type": "module"` ; les sources sont en ESM avec des imports sans extension [L]. Le build produit un fichier CommonJS, `dist/server.cjs`, via tsup [E-818a426].
- **`tsconfig.json`** [L] :
  - `strict`, `noUnusedLocals`, `isolatedModules` ;
  - `module: ESNext`, `moduleResolution: Bundler`, `target: ES2022` ;
  - `noEmit` : `tsc` vérifie uniquement les types, la compilation est faite par tsup ;
  - inclut `server.ts` et `src/**/*.ts`.
- **`.gitignore`** [L] : `node_modules/`, `dist/`, `*.tsbuildinfo`, `.env`, `.env.*` (sauf `.env.example`), `logs/`, `*.log`, `npm-debug.log*`, `coverage/`, `.cache/`, `.vscode/`, `.idea/`, `.DS_Store`, `Thumbs.db`.

## 5. Scripts npm

| Script | Commande | État |
|---|---|---|
| `dev` | `nodemon --watch . -e js,ts,json --exec "tsx watch server.ts"` | Démarre sur le port 4001 [E-818a426]. Double surveillance des fichiers (nodemon et `tsx watch`) [L]. Le `.env` n'est pas surveillé : redémarrage manuel après modification [L] |
| `typecheck` | `tsc --noEmit` | Aucune erreur, code de sortie 0 [E-818a426] |
| `build` | `npm run typecheck && tsup server.ts --format cjs --clean` | Produit `dist/server.cjs` (7,46 Ko) [E-818a426] |
| `start` | `node dist/server.cjs` | Démarre le build, avec ou sans `.env` [E-818a426] |
| `test` | — | **Absent** |
| `lint` | — | **Absent** |

`main` pointe vers `dist/server.cjs` [L].

## 6. Structure des fichiers suivis

Liste établie par `git ls-files` [E-818a426] :

```text
.env.example
.gitignore
.postman/resources.yaml
docs/architecture/backlog-adaptations.md
package-lock.json
package.json
postman/globals/workspace.globals.yaml
server.ts
src/app.ts
src/config/environment.ts
src/controllers/user.controller.ts
src/repositories/user.repository.ts
src/routes/index.ts
src/routes/user.routes.ts
src/services/user.service.ts
src/types/user.ts
src/utils/http-error.ts
src/utils/validators.ts
tsconfig.json
```

**Absents** [E-818a426] : `README.md`, `AGENTS.md`, `tests/`, `src/middlewares/`, `src/schemas/`, `src/utils/response.ts`, `prisma/`, `.github/`, toute collection Postman, `docs/api/`.

## 7. Description des couches

### 7.1 Point d'entrée : `server.ts` [L]

- Importe d'abord la configuration (`src/config/environment`), puis l'application.
- Appelle `app.listen(env.PORT)` et affiche `Server is running on http://localhost:<PORT>`.
- **Aucune gestion de l'erreur d'écoute** (port occupé, accès refusé) : comportement non testé (voir FND-09 proposé).

### 7.2 Configuration : `src/config/environment.ts`

- Seul fichier qui lit `process.env` [E-818a426, `git grep`].
- Charge `.env` avec `process.loadEnvFile()` uniquement si le fichier existe. Les variables déjà définies dans l'environnement système ne sont pas écrasées [L] ; vérifié en section 9 [E-818a426].
- Schéma Zod [L] :
  - `NODE_ENV` ∈ `development | test | production`, défaut `development` ;
  - `PORT` entier de 1 à 65535, défaut `4001`.
- En cas d'erreur : message listant les variables fautives (nom et raison, sans valeur), puis `process.exit(1)` [L, vérifié en section 9].
- `NODE_ENV` est validé mais n'est utilisé par aucun code du projet [L].

### 7.3 Application : `src/app.ts` [L]

- `cors()` sans options : toutes les origines sont autorisées.
- `express.json()` sans options : limite par défaut d'Express.
- `GET /` répond directement dans `app.ts`.
- Monte le routeur principal **sans préfixe** (pas de `/api/v1`).
- Gestionnaire d'erreurs écrit directement dans `app.ts` :
  - une erreur `HttpError` donne son statut et `{ "error": message }` ;
  - toute autre erreur est affichée en console (`console.error`) et donne 500 `{ "error": "Internal Server Error" }`.
- **Aucun gestionnaire 404** : une route inconnue renvoie la page HTML par défaut d'Express [E-a6cf863].

### 7.4 Routes : `src/routes/` [L]

- `index.ts` monte `/users` vers `user.routes.ts`.
- `user.routes.ts` définit six routes (section 8), sans middleware de validation ni d'authentification.

### 7.5 Controllers : `src/controllers/user.controller.ts` [L]

- Convertit `req.params.id` avec `Number(...)`, sans validation : un identifiant non numérique devient `NaN`.
- Transmet `req.body` tel quel au service.
- Renvoie les données brutes, sans enveloppe : `200`, `201`, ou `204` sans corps.
- Handlers synchrones.

### 7.6 Services : `src/services/user.service.ts` [L]

- `getById` : 404 `User not found` si l'utilisateur est absent.
- `create` : `name` et `email` doivent être des chaînes non vides (`isNonEmptyString`), sinon 400. Un email déjà utilisé donne 409.
- `replace` (PUT) : vérifie l'existence, la validité des deux champs et l'unicité de l'email (en excluant l'utilisateur lui-même).
- `patch` : **bug**, la seconde condition (`name !== undefined && isNonEmptyString(name)`) lève une erreur 400 « Email must be a non-empty string » dès qu'un `name` valide est fourni.
- `remove` : 404 si l'utilisateur est absent.
- Le corps est typé `any`. Le format de l'email n'est pas validé. L'email n'est pas normalisé (comparaison sensible à la casse et aux espaces).

### 7.7 Repositories : `src/repositories/user.repository.ts` [L]

- Persistance **en mémoire** : un tableau initialisé avec deux utilisateurs, et `nextId = 3`. Le commentaire du fichier indique que les données sont perdues à chaque redémarrage (non vérifié par exécution).
- `findAll` renvoie la référence du tableau interne.
- `update` modifie l'objet en place ; `delete` retire l'élément du tableau.

### 7.8 Types et utilitaires [L]

- `src/types/user.ts` : `User { id: number; name: string; email: string }`. Pas de mot de passe, de rôle ni de dates.
- `src/utils/http-error.ts` : `HttpError(status, message)`, sans code d'erreur stable.
- `src/utils/validators.ts` : `isNonEmptyString`.

### 7.9 Middlewares, schémas, authentification [L]

- Pas de dossier `middlewares/` : le seul middleware propre au projet est le gestionnaire d'erreurs de `app.ts`.
- Pas de schéma Zod pour les requêtes : Zod n'est utilisé que pour la configuration.
- **Aucune authentification ni autorisation** : toutes les routes sont publiques, y compris la liste des utilisateurs et la suppression.

### 7.10 Postman [L]

- `.postman/resources.yaml` : identifiant du workspace Postman.
- `postman/globals/workspace.globals.yaml` : variables globales vides (`values: []`).
- **Aucune collection ni requête.**

## 8. Endpoints existants

Les endpoints ne sont pas sous `/api/v1`. Les réponses ne suivent pas les conventions de `docs/api/conventions.md`.

| Méthode | Chemin | Cas | Comportement | Source |
|---|---|---|---|---|
| GET | `/` | — | 200 `{"message":"Server is working"}` | E-818a426 |
| GET | `/users` | — | 200, tableau des utilisateurs (deux utilisateurs initiaux) | E-818a426 |
| GET | `/users/:id` | existant | 200, utilisateur | E-818a426 |
| GET | `/users/:id` | inexistant | 404 `{"error":"User not found"}` | E-818a426 |
| GET | `/users/:id` | `abc` (non numérique) | 404 `User not found` au lieu d'un rejet en 400 | E-a6cf863 |
| POST | `/users` | valide | 201, utilisateur créé avec identifiant incrémental | E-818a426 |
| POST | `/users` | email déjà utilisé | 409 `{"error":"Email already taken"}` | E-a6cf863 |
| POST | `/users` | `name` ou `email` manquant ou vide | 400 `Name and email are required` | L |
| POST | `/users` | JSON illisible | **500** `{"error":"Internal Server Error"}` au lieu de 400 | E-818a426 |
| PUT | `/users/:id` | valide | 200, `name` et `email` remplacés | L |
| PUT | `/users/:id` | email d'un autre utilisateur | 409 `Email already taken` | E-a6cf863 |
| PUT | `/users/:id` | inexistant | 404 | L |
| PATCH | `/users/:id` | `name` seul | **400** `Email must be a non-empty string` (bug) | E-818a426 |
| PATCH | `/users/:id` | `name` et `email` valides | **400** même message (bug) | E-a6cf863 |
| PATCH | `/users/:id` | `email` seul | 200 | E-a6cf863 |
| DELETE | `/users/:id` | existant | 204 sans corps | E-818a426 |
| DELETE | `/users/:id` | inexistant | 404 | L |
| toutes | route inconnue (`/inconnue`, `/health`, `/api/v1/users`) | — | 404, page HTML d'Express | E-a6cf863 |

Les appels [E-818a426] ont été faits sur le serveur compilé (`node dist/server.cjs`).

## 9. Configuration : comportements vérifiés

Tous ces cas ont été exécutés sur `818a426` [E-818a426] et rapportés comme fonctionnels sous Windows [R].

| Situation | Résultat |
|---|---|
| Ni `.env` ni variable système | Démarrage sur le port 4001 |
| `.env` avec `PORT=4002` | Démarrage sur 4002 |
| `.env` à 4002 et `PORT=4003` dans l'environnement système | Démarrage sur 4003 : la variable système l'emporte |
| `PORT=abc` | Code de sortie 1, `PORT : Invalid input: expected number, received NaN` |
| `PORT=70000` | Code de sortie 1, `PORT : doit être au plus 65535` |
| `PORT=0` | Code de sortie 1, `PORT : doit être au moins 1` |
| `PORT=4001.5` | Code de sortie 1, `PORT : doit être un entier` |
| `NODE_ENV=prod` | Code de sortie 1, `NODE_ENV : Invalid option: expected one of "development"\|"test"\|"production"` |
| `NODE_ENV=production` | Démarrage normal |
| `PORT=abc` dans le `.env` seul | Code de sortie 1 |
| `PORT=` (valeur vide) dans le `.env` | Code de sortie 1, `PORT : doit être au moins 1` : la valeur vide est convertie en 0, la valeur par défaut ne s'applique pas |
| Build compilé avec `PORT=abc` | Code de sortie 1, même message |

Dans tous les cas d'échec : pas de trace d'erreur, aucune valeur affichée. Les messages mélangent l'anglais (messages par défaut de Zod) et le français (messages personnalisés).

## 10. Commandes exécutées et résultats

### Au commit `a6cf863` [E-a6cf863]

| Commande | Résultat |
|---|---|
| `npm ci` | Installation réussie, avertissement `npm audit` |
| `npx tsc --noEmit` (sans tsconfig) | Rien compilé : affiche l'aide de `tsc` |
| `tsc` avec une configuration stricte temporaire | 2 erreurs TS6133 dans `user.service.ts` (corrigées depuis dans `4450c2d`) |
| `npm run build` | `dist/server.cjs` produit |
| `npm start` | `MODULE_NOT_FOUND` (corrigé depuis dans `4450c2d`) |
| `npm audit --omit=dev` | 2 vulnérabilités modérées, dont `minimatch` via `nodemon` ; la seconde n'a pas été détaillée |
| `npx tsx server.ts` puis appels HTTP | Voir section 8 |
| `npm run dev` | Démarrage sur 4001 |

### Au commit `29c5611` [E-29c5611]

| Commande | Résultat |
|---|---|
| `git ls-files node_modules` | 0 fichier suivi |
| `npm ci` | 178 paquets installés |
| `npm run build` | Succès |
| `npm run dev` puis `GET /` | Démarrage, 200 |
| `git status` après build | Propre (`node_modules/` et `dist/` ignorés) |

### Au commit `818a426` [E-818a426]

| Commande | Résultat |
|---|---|
| `npm ci` | 178 paquets installés |
| `npm run typecheck` | Code de sortie 0 |
| `git grep -n "process.env" -- src server.ts` | Une seule occurrence, dans `src/config/environment.ts` |
| `git check-ignore -v .env` | Ignoré par la règle `.env` |
| Démarrages de la section 9 | Voir section 9 |
| `npm run build` | `dist/server.cjs` (7,46 Ko) |
| `npm start` avec et sans `.env` | Démarrage sur 4002 puis 4001 |
| `npm run dev` | Démarrage sur 4001 |
| Appels HTTP sur le serveur compilé | Voir section 8 |
| `git status` après les tests | Propre |

Les appels HTTP ont été faits avec `curl`, et non avec Postman : aucune collection n'existe.

### Rapporté par le propriétaire [R]

- Nettoyage Git : `git rm -r --cached node_modules`, `npm ci`, `npm run build`, `npm run dev` et `git status` fonctionnent.
- FND-02 : toutes les vérifications prévues fonctionnent.

## 11. Fonctionnalités opérationnelles

- Démarrage en développement (`dev`), vérification des types (`typecheck`), build (`build`) et démarrage du build (`start`) [E-818a426].
- Configuration validée au démarrage, avec chargement facultatif du `.env` et priorité de l'environnement système [E-818a426].
- CRUD des utilisateurs **en mémoire**, sauf la modification partielle avec `name` (bug) [E-818a426 et E-a6cf863].
- Erreurs `HttpError` traduites en statut HTTP et en message JSON [E-818a426].

Rien d'autre n'est implémenté.

## 12. Écarts et risques

### 12.1 Bugs constatés

| Bug | Source | Traitement prévu |
|---|---|---|
| PATCH `/users/:id` avec un `name` valide renvoie 400 | E-818a426 | Ticket de correction proposé après FND-06 |
| JSON illisible renvoie 500 au lieu de 400 | E-818a426 | FND-03 |
| Identifiant non numérique renvoie 404 au lieu de 400 | E-a6cf863 | FND-04 ou ticket de correction |
| Route inconnue renvoie une page HTML | E-a6cf863 | FND-03 |

### 12.2 Absent par rapport au backlog

Toujours absents :
- base de données et migrations ;
- authentification, rôles et permissions ;
- validation Zod des requêtes ;
- format de réponse et d'erreur unifié ;
- préfixe `/api/v1` et route `/health` ;
- logs structurés ;
- limites et protections HTTP ;
- tests automatisés ;
- collection Postman ;
- `README.md` et `AGENTS.md` ;
- tous les modules de jeu (personnages, classes, statistiques, compétences, monde, monstres, combats, objets, inventaire, récompenses, économie, quêtes).

### 12.3 Risques techniques

- **Données perdues au redémarrage** (stockage en mémoire) [L].
- **Routes publiques :** toutes, y compris `GET /users` et `DELETE /users/:id` [L].
- **CORS** ouvert à toutes les origines [L].
- **Démarrage :** aucune gestion des erreurs d'écoute du serveur [L].
- **Erreurs asynchrones :** Express 4 ne transmet pas automatiquement au gestionnaire d'erreurs les promesses rejetées dans un handler `async`. Les handlers actuels sont synchrones, mais le futur accès à une base de données sera asynchrone [L].
- **Typage :** corps des requêtes typé `any` dans le service [L].
- **Emails :** ni normalisés ni validés quant à leur format [L].
- **Repository :** `findAll` expose la référence du tableau interne [L].
- **Dépendances :**
  - `nodemon` est déclaré en dépendance de production ;
  - `ts-node` est inutilisé ;
  - les types Node 20 sont utilisés avec un runtime Node 22 [L].
- **Sécurité des dépendances :** 2 vulnérabilités modérées signalées par `npm audit` [E-a6cf863].
- **Taille du dépôt :** `node_modules/` est encore présent dans l'historique Git, ce qui alourdit les clonages [E-a6cf863].
- **Configuration :** une valeur `PORT` vide produit un message peu explicite (section 9) [E-818a426].

### 12.4 Non-conformités aux conventions de l'API

Le code existant ne respecte pas encore `docs/api/conventions.md` :
- pas de préfixe ;
- pas d'enveloppe ;
- erreurs sans code ;
- identifiants numériques ;
- champs inconnus acceptés.

Le calendrier de mise en conformité est donné dans la section 15 de ce document.

## 13. Points non vérifiés

- Perte effective des données après un redémarrage (déduite du code).
- PUT valide, PUT et DELETE sur un utilisateur inexistant, POST avec champs manquants (déduits du code).
- Comportement en cas de port occupé.
- Rechargement automatique de `npm run dev` après la modification d'un fichier.
- Versions installées d'Express, cors, zod et tsx.
- Détail de la seconde vulnérabilité signalée par `npm audit`.
- Historique antérieur à `9acf310`.
- Comportements sous Windows, au-delà de ce qui a été rapporté.

## 14. Documents liés

- `docs/api/conventions.md` : conventions de l'API (SET-05).
- `docs/architecture/backlog-adaptations.md` : écarts par rapport au backlog.