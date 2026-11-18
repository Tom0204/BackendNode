# Adaptations par rapport au backlog initial

Dernière mise à jour : 2026-11-18

Le backlog de référence (`Backlog_API_Mmorpg.md`) est conservé dans le projet Claude « API jeux vidéo ». Ce fichier recense les écarts décidés par rapport à lui, avec leur raison.

## État d'avancement

| Ticket | Statut | Commit |
|---|---|---|
| Nettoyage Git (additionnel) | Validé | `29c5611` |
| Configuration TypeScript (additionnel) | Validé | `4450c2d` |
| FND-01 | Validé (points du travail réaffectés, voir plus bas) | `4450c2d` |
| FND-02 | Validé | `818a426` |
| SET-01 | Validé | `13e50ef` |
| SET-05 | Validé | `13e50ef` |
| FND-03 | Validé | `f537454` |
| FND-04 | Validé | `e742552` |
| FND-06 | Validé | `1734b41` |
| FND-07 | Livré, en attente de validation | — |
| FND-05 | Analysé, reporté après FND-07 (analyse conservée dans le projet Claude, hors dépôt) | — |

## Ordre de réalisation

L'ordre de la phase A du backlog (`SET-01 → SET-05 → FND-01 à FND-08`) a été adapté :

1. FND-01 et FND-02 ont été réalisés avant SET-02, SET-03, SET-04 et SET-05, car ils ne dépendent que de SET-01.
2. Ordre retenu ensuite : SET-05 (avec la clôture de SET-01) → FND-03 → FND-04 → FND-06 → FND-07 → FND-09, FND-05, FND-08.
3. SET-02, SET-03 et SET-04 ne sont pas encore réalisés. Ils doivent l'être avant leurs tickets dépendants :
   - SET-04 avant DB-01 ;
   - SET-02 et SET-03 avant DB-02 et les tickets de gameplay.

## Tickets additionnels réalisés

| Ticket | Description | Commit |
|---|---|---|
| Nettoyage Git | Ajout du `.gitignore`, retrait de `node_modules/` de l'index Git | `29c5611` |
| Configuration TypeScript | Création du `tsconfig.json` strict, correction de `npm start`, ajout du script `typecheck` | `4450c2d` |

## Adaptations de tickets existants

| Ticket | Adaptation | Raison | Reprise |
|---|---|---|---|
| FND-01 | Le point « Centraliser la lecture du port et des variables d'environnement » est réalisé dans FND-02. | Même livrable que le module de configuration de FND-02. | FND-02 |
| FND-01 | Le point « Gérer proprement les erreurs de démarrage » est sorti de FND-01. | Non couvert ailleurs dans le backlog. | FND-09 (proposé) |
| FND-02 | `DATABASE_URL` et les secrets d'authentification ne sont pas rendus obligatoires. | La base de données (SET-04) et la stratégie d'authentification (AUTH-05) ne sont pas décidées. Les rendre obligatoires bloquerait le démarrage pour des variables inutilisées. | À ajouter dans DB-01 (`DATABASE_URL`) et AUTH-05 (secrets) |
| FND-02 | Le fichier `.env` est chargé avec `process.loadEnvFile()` natif de Node, sans `dotenv`. | Éviter une dépendance supplémentaire. Node ≥ 20.12 requis (version du projet : 22.23.2). | — |
| FND-02 | Aucun test automatisé ni requête Postman. | Le framework de test n'existe pas encore (FND-06) et aucun endpoint n'est modifié. Vérification manuelle. | Tests de configuration à ajouter avec FND-06 |
| SET-01 | Le livrable `docs/architecture/current-state.md` est rédigé dans le cadre de SET-05 ; il décrit l'état au commit `818a426`. | L'audit avait d'abord été rendu dans la conversation, sans document dans le dépôt. | — |
| SET-01 | Les endpoints ont été appelés avec `curl` et non avec Postman. | Aucune collection Postman n'existe encore. | DOC-01 |
| SET-01, SET-05 | Aucun test automatisé ni requête Postman. | Tickets de documentation uniquement, sans modification du code. | — |
| FND-03 | Le format d'erreur s'applique aux routes `/users` existantes : les erreurs passent de `{ "error": "..." }` à l'enveloppe de SET-05. | Critère « Toutes les erreurs API suivent le format défini dans SET-05 ». Changement cassant admis : aucun client. | — |
| FND-03 | Les erreurs de validation des services renvoient `VALIDATION_ERROR` avec un `details` vide. | La réponse 400 structurée par champ relève de FND-04. | FND-04 |
| FND-03 | Seuls les 415 produits par `express.json()` (jeu de caractères non pris en charge) sont formatés ; le rejet d'un corps envoyé dans un autre format que JSON n'est pas implémenté. | Contrôle du type de contenu rattaché à FND-08 (précisions SET-05). | FND-08 |
| FND-03 | Aucun test automatisé ni requête Postman ; vérification manuelle. | FND-06 et DOC-01 ne sont pas réalisés. | FND-06 (prévoit des tests de route inconnue, de validation et d'erreur applicative) |
| FND-04 | Aucune validation n'existait dans les controllers : les validations de format dupliquées se trouvaient dans le service utilisateur. Elles sont remplacées par des schémas Zod déclarés sur les routes ; le service ne garde que les règles métier (existence, unicité de l'email). | Objectif du ticket : « un body invalide ne déclenche jamais le service ». | — |
| FND-04 | Corrige, par conséquence, le PATCH avec `name` refusé et l'identifiant non numérique renvoyé en 404 (désormais 400). | La branche erronée faisait partie des validations supprimées ; les paramètres de chemin sont désormais validés. | Tests de non-régression dans FND-06 |
| FND-04 | Les paramètres de chemin et de requête sont validés mais pas convertis ; seul le corps est remplacé par la sortie du schéma. Un emplacement sans schéma doit être vide. | Types Express exacts ; identifiants traités comme des chaînes (conventions §7) ; rejet des paramètres inconnus (conventions §2). | Lecture typée des paramètres de requête : premier endpoint paginé (QUAL-04) |
| FND-04 | `src/utils/validators.ts` supprimé. | Plus utilisé après le passage aux schémas Zod. | — |
| FND-04 | Règles de format inchangées : pas de validation du format de l'email ni de normalisation. | Relève d'AUTH-01 et AUTH-04. | AUTH-01, AUTH-04 |
| FND-04 | Aucun test automatisé ni requête Postman ; vérification manuelle. | FND-06 et DOC-01 ne sont pas réalisés. | FND-06 |
| FND-06 | Framework retenu : Vitest 5 (5.1.0), avec supertest (7.3.2) et `@types/supertest` (7.2.1) pour les tests HTTP, en dépendances de développement. Vite (8.3.8) est installé par Vitest. | Vitest était proposé par le backlog : TypeScript et ESM sans configuration supplémentaire. supertest teste l'application Express sans démarrer `server.ts`. | — |
| FND-06 | Vitest 5 exige Node.js ≥ 22.12. | Contrainte de la version installée ; le projet utilise Node 22.23.2. | À reprendre dans la documentation d'installation (README) |
| FND-06 | En test, `NODE_ENV=test` est imposé par `vitest.config.ts`, et `environment.ts` ne charge jamais le fichier `.env` dans ce cas. | Tests reproductibles, indépendants du `.env` de chaque machine ; aucune base de développement ne pourra être lue par les tests. | DB-01 : base de test dédiée, configurée explicitement |
| FND-06 | `environment.ts` expose une fonction pure `parseEnvironment(source)` ; le comportement au démarrage est inchangé. | Tester la configuration sans modifier `process.env` et sans arrêter le lanceur de tests. | — |
| FND-06 | L'état du repository en mémoire est isolé par rechargement des modules (`vi.resetModules()` et imports dynamiques), sans code réservé aux tests dans le repository. | Chaque test part des données initiales, quel que soit l'ordre d'exécution. | DB-04 : isolation à revoir avec une base de données |
| FND-06 | L'erreur 500 est testée avec une petite application de test qui assemble les vrais gestionnaires d'erreurs. | Aucune route de test ajoutée à l'application. | — |
| FND-06 | L'arrêt réel du processus sur configuration invalide n'est pas testé automatiquement. | Vérifié manuellement en FND-02 et en FND-06 (étape A4) ; un test automatique demanderait de lancer un processus séparé. | — |
| FND-06 | Les tests sont inclus dans `tsconfig.json` : `npm run typecheck`, donc aussi `npm run build`, vérifient leurs types. | Même exigence de typage strict que le code de l'application. | — |
| FND-06 | Pas de seuil de couverture de code ni d'intégration continue. | Non demandés par le ticket. | — |
| FND-06 | Pas de requêtes Postman. | La collection est prévue en DOC-01, après FND-07. | DOC-01 |
| SET-01 | Commit de rattachement corrigé dans « État d'avancement » : `13e50ef` (et non `818a426`). | `docs/architecture/current-state.md`, livrable de SET-01, a été ajouté par `13e50ef` ; `818a426` est l'état du dépôt décrit par ce document. | — |
| FND-07 | Anciennes routes `/users` et `/users/:id` supprimées, sans redirection : elles renvoient 404 `ROUTE_NOT_FOUND`. | Une seule façon d'appeler l'API ; changement cassant admis par les conventions (§13), aucun client. Migration documentée (critère 3 du ticket). | — |
| FND-07 | Route `GET /` supprimée. | Remplacée par `GET /health`. | — |
| FND-07 | Aucune validation des paramètres sur `/health` ; exception à la règle « paramètre inconnu → 400 ». | Route technique qui ne lit aucun paramètre et doit répondre tant que le service tourne. | — |
| FND-07 | Les tests écrivent les chemins `/api/v1/...` en clair au lieu d'importer `API_V1_PREFIX`. | Un changement accidentel du préfixe doit faire échouer les tests. | — |
| FND-07 | Pas de requêtes Postman. | DOC-01 dépend de FND-07 et peut désormais être réalisé. | DOC-01 |

## Écarts introduits par SET-05 (conventions de l'API)

Référence : `docs/api/conventions.md`.

| Ticket | Backlog initial | Décision retenue | Raison |
|---|---|---|---|
| CHAR-03 | Classe inexistante : « 404/400 selon convention » | **422** `CLASS_NOT_FOUND` | Un 404 sur `POST /api/v1/characters` laisserait croire que l'endpoint n'existe pas. Une ressource référencée dans le corps et introuvable relève du 422. |
| COMBAT-02 | `POST /api/v1/characters/:characterId/combat` | `POST /api/v1/combats`, avec le personnage et la cible dans le corps | Ressource au pluriel ; alignement sur les instructions du projet (§5.2). |
| COMBAT-07 | `POST /api/v1/combat/:combatId/actions/attack` | `POST /api/v1/combats/:combatId/actions` avec `type: "ATTACK"` | Point d'entrée unique pour toutes les actions, extensible et réutilisable tel quel pour un futur canal temps réel. |
| COMBAT-09 | `GET /api/v1/combat/:combatId` | `GET /api/v1/combats/:combatId` | Ressource au pluriel. |
| COMBAT-12 | `POST /api/v1/combat/:combatId/actions/skill` | `POST /api/v1/combats/:combatId/actions` avec `type: "SKILL"` | Même raison que COMBAT-07. |
| En-tête du backlog | « Convention exacte des identifiants » à confirmer | API : chaînes opaques. Stockage : UUID v7 si compatible avec la base et l'ORM, sinon UUID v4. | Identifiants impossibles à deviner, ordonnés dans le temps (v7). Choix du stockage finalisé en SET-04. Un UUID ne remplace jamais un contrôle d'autorisation. |

## Précisions apportées par SET-05

Ces points tranchent des choix que le backlog laissait ouverts. Ils ne modifient pas ses règles.

| Ticket | Choix laissé ouvert | Précision |
|---|---|---|
| AUTH-08, CHAR-05, QUAL-01 | 403 ou 404 selon la politique anti-énumération | 404 pour la ressource privée d'un autre joueur (même code et même message qu'une ressource inexistante) ; 403 pour un refus lié au rôle. |
| AUTH-09, CHAR-06 | Champs interdits « rejetés ou ignorés selon convention » | Champs inconnus ou interdits rejetés en 400, dans le corps comme dans les paramètres de requête. |
| SKILL-04 | Compétence déjà connue : « conflit ou réponse idempotente documentée » | 409 par défaut, sauf comportement idempotent prévu explicitement dans le ticket. |
| ITEM-02, ITEM-04 | Statut d'un inventaire plein non précisé | 409, comme toute limite de capacité atteinte. |
| COMBAT-02, WORLD-06 | Statuts non précisés pour certains refus | Ressource du corps introuvable ou inaccessible (monstre, personnage d'un autre joueur, zone) : 422. Personnage mort, niveau insuffisant, combat actif : 422. |
| COMBAT-11 | Endpoint d'historique « si utile » | `GET /api/v1/combats/:combatId/actions`, paginé. |
| COMBAT-13 | Endpoint de fuite non précisé | `POST /api/v1/combats/:combatId/actions` avec `type: "FLEE"`, si la fuite est retenue. |
| FND-08 | Statut d'un corps trop volumineux non précisé | 413 `PAYLOAD_TOO_LARGE`. Corps dans un format non accepté : 415 `UNSUPPORTED_MEDIA_TYPE`. |
| QUAL-04 | Traitement d'un dépassement de limite non précisé | `pageSize` supérieur à 100 : 400, sans correction automatique. |
| FND-07 | Migration des routes existantes « documentée » | `/users` passe sous `/api/v1` et adopte l'enveloppe de succès dans ce même ticket (un seul changement cassant). `/health` reste hors préfixe et utilise l'enveloppe. |
| REWARD-02, ECO-02 | Mécanisme d'idempotence | Décidé dans chacun de ces tickets. |

Règles du backlog conservées sans changement :
- AUTH-04 : 201, 400, 409.
- AUTH-06 : 401 générique ; le statut d'un compte désactivé sera décidé dans ce ticket.
- AUTH-07 : 401.
- CHAR-03 : **409 pour la limite de personnages atteinte ou un nom indisponible**.
- COMBAT-02 : 409 pour un monstre déjà engagé.
- QUAL-02 : 429.
- QUAL-04 : 400 pour des paramètres invalides.
- FND-03 : 404 pour une route inconnue, 500 sans détail interne.

## Tests automatisés (FND-06)

### Outils et commandes

| Élément | Valeur |
|---|---|
| Framework | Vitest 5.1.0 (dépendance de développement) |
| Tests HTTP | supertest 7.3.2 et `@types/supertest` 7.2.1 |
| Lancer les tests | `npm test` (`vitest run` : une exécution, code de sortie 0 si tout réussit) |
| Mode surveillance | `npx vitest` |
| Ordre aléatoire | `npx vitest run --sequence.shuffle` |

### Organisation

```text
tests/
├── helpers/
│   ├── fresh-modules.ts   # application ou service neufs (vi.resetModules + import dynamique)
│   ├── errors.ts          # captureError : vérifier une erreur par status et code
│   └── http.ts            # expectErrorResponse : format d'erreur des conventions (SET-05)
├── unit/                  # sans HTTP ni serveur
│   ├── http-error.test.ts
│   ├── environment.test.ts
│   ├── user.service.test.ts
│   └── validation.middleware.test.ts
└── integration/           # requêtes HTTP sur l'application Express, via supertest
    ├── errors.test.ts
    └── users.test.ts
```

### Configuration (`vitest.config.ts`)

- `include: ['tests/**/*.test.ts']` : seuls ces fichiers sont des tests ; les outils de `tests/helpers/` n'en sont pas.
- `environment: 'node'` : pas de navigateur simulé.
- `env: { NODE_ENV: 'test' }` : environnement de test imposé ; le `.env` local n'est pas lu.
- `unstubEnvs: true` : les variables modifiées avec `vi.stubEnv()` sont restaurées après chaque test.
- `restoreMocks: true` : les fonctions espionnées avec `vi.spyOn()` sont restaurées après chaque test.

### Règles d'isolation

- Les modules **avec état** (application, service, repository) ne sont jamais importés en haut d'un fichier de test. Ils sont obtenus par `loadFreshApp()` ou `loadFreshUserService()` dans `beforeEach`.
- Les modules **sans état** (`http-error`, schémas, middleware de validation, configuration, `zod`, `express`) sont importés normalement.
- Les erreurs issues de modules rechargés sont vérifiées par leurs propriétés (`status`, `code`), et non avec `instanceof`.
- Les tests de configuration passent un objet à `parseEnvironment()` et ne modifient pas `process.env`. Le seul test qui le modifie utilise `vi.stubEnv()`, restauré automatiquement.

### Couverture : 80 tests

| Fichier | Tests | Contenu |
|---|---|---|
| `unit/http-error.test.ts` | 11 | Structure de `HttpError`, statut, code, message et détails de chaque fonction de création (400, 401, 403, 404, 409, 422) |
| `unit/environment.test.ts` | 12 | Valeurs par défaut ; conversion de `PORT` ; refus de `abc`, `0`, `70000`, `4001.5`, valeur vide et `NODE_ENV` inconnu ; plusieurs problèmes à la fois ; variables étrangères ignorées ; indépendance vis-à-vis de `process.env` ; source non modifiée |
| `unit/user.service.test.ts` | 18 | Règles métier sans HTTP : lecture, `USER_NOT_FOUND`, création, `EMAIL_ALREADY_USED` (création, remplacement, modification partielle) sans modification de l'état, suppression, isolation entre tests |
| `unit/validation.middleware.test.ts` | 11 | Corps remplacé par la sortie du schéma ; paramètres validés mais non convertis ; champs manquants ; champ et paramètre de requête inconnus ; identifiant invalide ; erreur sur le corps entier (`field: "body"`) ; chemins imbriqués ; regroupement des erreurs en un seul appel à `next` |
| `integration/errors.test.ts` | 6 | Route inconnue et méthode non prévue (404 `ROUTE_NOT_FOUND`), JSON illisible (400 `INVALID_JSON`), corps trop volumineux (413), jeu de caractères non pris en charge (415), erreur inattendue (500 générique, sans détail interne ni trace, détail transmis à la console du serveur) |
| `integration/users.test.ts` | 22 | CRUD (200, 201, 204) ; 404 `USER_NOT_FOUND` ; 409 `EMAIL_ALREADY_USED` ; 400 `VALIDATION_ERROR` avec `details` exacts ; espion sur l'instance réelle du service, prouvant qu'une requête invalide ne l'appelle jamais (avec un test témoin) ; isolation entre tests |

Contrôles effectués lors de la réalisation :
- 80 tests réussis, y compris en ordre aléatoire ;
- tests réussis malgré un `.env` local invalide ;
- trois régressions introduites volontairement, chacune détectée puis annulée : le nom ignoré par PATCH, une erreur 500 qui expose le message interne, la validation retirée de `POST /users`.

### Critères d'acceptation du ticket

| Critère | Comment il est respecté |
|---|---|
| `npm test` exécute les tests de façon reproductible | Configuration versionnée, `.env` ignoré, données réinitialisées à chaque test, réussite en ordre aléatoire |
| Les tests ne dépendent pas de la base de développement | Aucune base de données n'existe encore et aucune n'est nécessaire ; le `.env` n'est jamais lu en test, donc une future `DATABASE_URL` de développement ne pourra pas être utilisée |
| Le démarrage du serveur n'est pas requis pour les tests de services | `server.ts` n'est jamais importé ; les tests de services appellent le service directement ; les tests HTTP utilisent supertest, qui ouvre un port temporaire |

### Reprises clôturées par FND-06

| Ticket d'origine | Reprise prévue | Couverture |
|---|---|---|
| FND-02 | Tests de configuration à ajouter avec FND-06 | `unit/environment.test.ts` |
| FND-03 | Tests de route inconnue, de validation et d'erreur applicative | `integration/errors.test.ts`, `integration/users.test.ts`, `unit/http-error.test.ts` |
| FND-04 | Tests de non-régression : PATCH avec `name`, identifiant non numérique | Tests unitaires et d'intégration dédiés, nommés « non-régression » |
| FND-03, FND-04 | Non-régression : JSON invalide (400) et route inconnue (404 JSON) | `integration/errors.test.ts` |
| FND-04 | Aucun test du middleware de validation | `unit/validation.middleware.test.ts` et tests 400 d'intégration |

### Points à reprendre dans les tickets suivants

- **FND-07 (réalisé) :** les tests utilisaient les chemins `/users` et des réponses de succès sans enveloppe. Ils ont été adaptés au préfixe `/api/v1` et à l'enveloppe de succès (voir « Structure API versionnée (FND-07) »).
- **FND-05 :** le test de l'erreur 500 espionne `console.error`. Il sera adapté quand le logger le remplacera, avec `LOG_LEVEL=silent` pour garder la sortie des tests propre.
- **DB-01 et DB-04 :** base de test dédiée, et isolation des données à revoir lorsque le repository utilisera une base.

## Structure API versionnée (FND-07)

### Routes après FND-07

| Méthode | Chemin | Succès | Message |
|---|---|---|---|
| GET | `/health` | 200 | `Service is healthy` |
| GET | `/api/v1/users` | 200 | `Users retrieved successfully` |
| GET | `/api/v1/users/:id` | 200 | `User retrieved successfully` |
| POST | `/api/v1/users` | 201 | `User created successfully` |
| PUT | `/api/v1/users/:id` | 200 | `User replaced successfully` |
| PATCH | `/api/v1/users/:id` | 200 | `User updated successfully` |
| DELETE | `/api/v1/users/:id` | 204 | — (sans corps) |

Les erreurs sont inchangées (format de FND-03, codes `USER_NOT_FOUND`, `EMAIL_ALREADY_USED`, `VALIDATION_ERROR`…). Toute autre route, y compris les anciens chemins, renvoie 404 `ROUTE_NOT_FOUND`.

### Migration des routes existantes

| Avant FND-07 | Depuis FND-07 |
|---|---|
| `/users`, `/users/:id` | `/api/v1/users`, `/api/v1/users/:id` (anciens chemins : 404 `ROUTE_NOT_FOUND`, sans redirection) |
| Succès renvoyés bruts (utilisateur ou tableau) | Enveloppe `{ success, message, data }` ; mêmes données dans `data` ; DELETE toujours en 204 sans corps |
| `GET /` → `{ "message": "Server is working" }` | Supprimée, remplacée par `GET /health` |
| Pas de route de santé | `GET /health` (et `HEAD /health`), hors préfixe |

### Décisions validées

| Décision | Choix retenu | Raison |
|---|---|---|
| D1. Anciennes routes `/users` | Supprimées, 404 `ROUTE_NOT_FOUND`, sans redirection ni alias | Toutes les routes métier sous `/api/v1` ; aucun client à préserver |
| D2. Route `GET /` | Supprimée | Doublon avec `/health` |
| D3. Contenu de `/health` | `{ success: true, message: "Service is healthy", data: { status: "OK" } }`, en-tête `Cache-Control: no-store` | Statut simple, aucune information sensible, aucun cache |
| D4. Validation sur `/health` | Aucune | La route doit répondre 200 même si un outil de surveillance ajoute un paramètre |
| D5. Messages de succès | Voir le tableau « Routes après FND-07 » | Messages en anglais, informatifs (conventions §3) |
| D6. Préfixe | Constante `API_V1_PREFIX = '/api/v1'`, exportée par `src/routes/index.ts` | Préfixe défini une seule fois dans le code ; chemins écrits en clair dans les tests |
| D7. Gestionnaire d'erreurs | Inchangé ; `src/utils/response.ts` ne concerne que les succès | Pas de déplacement de code sans besoin réel |

### Fichiers créés ou modifiés

- **Créés :**
  - `src/utils/response.ts` : fonction pure `successBody(message, data, meta?)`, où `data` est obligatoirement un objet ou un tableau (contrainte de type) ;
  - `src/controllers/health.controller.ts` ;
  - `src/routes/health.routes.ts`.
- **Modifiés :**
  - `src/routes/index.ts` : routeur de la v1 et constante `API_V1_PREFIX` ;
  - `src/app.ts` : `/health`, puis `/api/v1`, puis le gestionnaire 404 et le gestionnaire d'erreurs, dans cet ordre ;
  - `src/controllers/user.controller.ts` : enveloppe de succès, statuts inchangés.
- **Inchangés :** services, repository, schémas, middlewares de validation et d'erreur, configuration, `server.ts`.

### Tests : 97 au total

| Fichier | Tests | Évolution |
|---|---|---|
| `unit/response.test.ts` | 6 | Nouveau : enveloppe avec ou sans `meta`, jamais de `error`, données non copiées, refus à la compilation d'une donnée qui n'est ni un objet ni un tableau |
| `integration/health.test.ts` | 11 | Nouveau : enveloppe exacte de `/health`, `Cache-Control: no-store`, `HEAD`, paramètre ignoré, absence sous `/api/v1`, anciennes routes et `GET /` en 404 (service non appelé), routes inconnues sous `/api/v1` |
| `integration/users.test.ts` | 22 | Adapté : chemins `/api/v1/users` et enveloppe de succès ; mêmes scénarios et assertions métier |
| `integration/errors.test.ts` | 6 | Adapté : chemins `/api/v1/users` ; mêmes scénarios |
| Tests unitaires de FND-06 | 52 | Inchangés |

Outil ajouté : `expectSuccessResponse` dans `tests/helpers/http.ts` (enveloppe exacte, sans `error` ni `meta`).

Contrôles effectués lors de la réalisation :
- 97 tests réussis, y compris en ordre aléatoire ;
- préfixe modifié par erreur (`/api/v2`) : 21 tests échouent ;
- information ajoutée à `/health` (version de Node) : 2 tests échouent.

### Critères d'acceptation du ticket

| Critère | Comment il est respecté |
|---|---|
| `GET /health` retourne un statut simple | `{ "status": "OK" }` dans l'enveloppe ; test sur l'enveloppe exacte |
| Les routes métier sont sous `/api/v1` | Montage par `app.use(API_V1_PREFIX, routes)` ; tests sur `/api/v1/users` et 404 sur les anciens chemins |
| Les routes existantes restent fonctionnelles ou leur migration est documentée | Mêmes opérations, mêmes statuts et mêmes données sous `/api/v1` ; migration documentée ici et dans `docs/api/conventions.md` (§1.2) |

### Points à reprendre

- **DOC-01 :** la collection Postman peut être créée, avec `baseUrl = http://localhost:4001/api/v1` et une requête `GET /health` séparée (hors préfixe).
- **FND-05 :** décider si les appels à `/health` sont journalisés ou ignorés (point déjà noté dans l'analyse de FND-05).
- **DB-01 :** un éventuel contrôle de la base de données dans `/health` sera décidé avec la mise en place de la base.
- **QUAL-04 :** `GET /api/v1/users` n'est pas paginé ; la pagination suivra les conventions (§9).
- **Documentation d'installation (README) :** indiquer l'URL de base et la route `/health`.

## Décisions de fonctionnement

- Le serveur de développement ne surveille pas le `.env` : après une modification, il faut le redémarrer manuellement.

## Tickets additionnels proposés (non démarrés)

- **FND-09 — Gérer les erreurs de démarrage du serveur** (P1, dépendances : FND-01, FND-02). Gestion de l'événement `error` de `listen` (port occupé, accès refusé), message explicite et arrêt avec code 1. Hors périmètre : logger (FND-05), erreurs de base (DB-01), arrêt propre (QUAL-06). Modifie uniquement `server.ts`.
- **Correction des bugs HTTP identifiés à l'audit** : sans objet. Les bugs ont été corrigés par FND-03 (JSON invalide, route inconnue) et FND-04 (PATCH, identifiant non numérique). Les tests de non-régression ont été ajoutés dans FND-06 (voir « Tests automatisés (FND-06) »).