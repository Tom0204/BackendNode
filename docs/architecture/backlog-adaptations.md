# Adaptations par rapport au backlog initial

Dernière mise à jour : 2026-11-23

Le backlog de référence (`Backlog_API_Mmorpg.md`) se trouve à la racine du dépôt. Ce fichier recense les écarts décidés par rapport à lui, avec leur raison.

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
| FND-07 | Validé | `f09492f` |
| FND-09 (additionnel) | Validé | `996dc8e` |
| FND-05 | Validé (analyse conservée dans le projet Claude, hors dépôt) | `b1d706e` |
| FND-08 | Validé | `2583814` |
| SET-04 | Validé (voir `docs/architecture/database.md`) | `ea106ef` |
| SET-02 | Validé (voir `docs/gameplay/mvp-scope.md`) | — |
| SET-03 | Validé (voir `docs/gameplay/rules.md`) | — |
| DB-01 | Réalisé et vérifié avec Docker | `f858ab4` |
| DB-02 | Réalisé (voir `docs/architecture/data-model.md`) | `d6285f5` |
| DB-03 | Réalisé (migration `init`, seed des données de référence) | `d6285f5` |
| DB-04 | Validé (repositories persistants) | `037dd8e` |
| AUTH-01 | Réalisé (hash du mot de passe et rôle ; statut de compte reporté à AUTH-06) | — |
| AUTH-02 | **Partiel** : routes `/users` supprimées, DTO public ; permissions reportées après AUTH-07 et AUTH-08 | — |
| AUTH-03 | Réalisé (Argon2id) | — |
| AUTH-04 | Réalisé (`POST /api/v1/auth/register`) | — |

## Ordre de réalisation

L'ordre de la phase A du backlog (`SET-01 → SET-05 → FND-01 à FND-08`) a été adapté :

1. FND-01 et FND-02 ont été réalisés avant SET-02, SET-03, SET-04 et SET-05, car ils ne dépendent que de SET-01.
2. Ordre retenu ensuite : SET-05 (avec la clôture de SET-01) → FND-03 → FND-04 → FND-06 → FND-07 → FND-09, FND-05, FND-08.
3. SET-02, SET-03 et SET-04 sont réalisés. DB-01 a été réalisé dans le même lot que SET-02 et SET-03 (indépendant d'eux). DB-02 et DB-03 ont été réalisés ensemble, puis DB-04.

## Tickets additionnels réalisés

| Ticket | Description | Commit |
|---|---|---|
| Nettoyage Git | Ajout du `.gitignore`, retrait de `node_modules/` de l'index Git | `29c5611` |
| Configuration TypeScript | Création du `tsconfig.json` strict, correction de `npm start`, ajout du script `typecheck` | `4450c2d` |
| FND-09 — Erreurs de démarrage du serveur | Module `src/startup.ts` (`startServer`, `describeStartupError`), messages clairs et code de sortie 1 en cas d'échec d'ouverture du port, 14 tests | `996dc8e` |

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
| FND-03 | Seuls les 415 produits par `express.json()` (jeu de caractères non pris en charge) sont formatés ; le rejet d'un corps envoyé dans un autre format que JSON n'est pas implémenté. | Contrôle du type de contenu rattaché à FND-08 (précisions SET-05). | FND-08 (réalisé : 415 pour tout corps qui n'est pas en JSON) |
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
| FND-09 | Création du module `src/startup.ts`, alors que la définition du ticket prévoyait « modifie uniquement `server.ts` ». | Rendre le démarrage testable sans arrêter le lanceur de tests (Definition of Done, FND-06 étant désormais disponible). `server.ts` ne fait plus qu'afficher le message et arrêter le processus. | — |
| FND-09 | Critères d'acceptation complétés : `EACCES` et erreur inconnue (message clair, sans trace, code 1) ; comportement couvert par des tests automatisés. | La définition d'origine ne citait que le port occupé et ne prévoyait pas de tests, FND-06 n'existant pas encore. | — |
| FND-09 | Seule la phase de démarrage est couverte : les écouteurs temporaires sont retirés dès que le port est ouvert. | Les erreurs d'un serveur déjà démarré relèvent de l'arrêt propre (QUAL-06) et des erreurs fatales (FND-05). | QUAL-06, FND-05 |
| FND-09 | Messages en français, sur le modèle des erreurs de configuration de FND-02 ; affichés avec `console.error`. | Cohérence des messages de démarrage destinés au développeur ou à l'administrateur ; le logger n'existe pas encore. | FND-05 : erreurs de démarrage journalisées en `fatal` (reprise notée dans l'analyse de FND-05, projet Claude) |
| FND-09 | `.then()` et `.catch()` dans `server.ts` plutôt qu'un `await` au niveau supérieur. | Le build produit un fichier CommonJS (`dist/server.cjs`), qui n'accepte pas `await` hors d'une fonction. | — |
| FND-09 | Arrêt réel du processus (`process.exit(1)`) vérifié manuellement, pas automatiquement. | Même raison qu'en FND-02 et FND-06 : un test automatique demanderait un processus séparé. | — |
| FND-09 | `EACCES` testé par son message uniquement, pas sur un vrai port. | Le résultat dépend du système, des droits et des ports réservés (notamment sous Windows). | — |
| FND-09 | Pas de requêtes Postman. | Aucun endpoint n'est ajouté ni modifié. | — |
| FND-05 | Bibliothèques retenues : `pino` (10.4.0) et `pino-http` (11.0.0) en dépendances, `pino-pretty` (13.2.0) en dépendance de développement. | Décision D1 de l'analyse : logs JSON structurés, masquage intégré, identifiant de requête fourni par pino-http, affichage lisible en développement. | — |
| FND-05 | Variable `LOG_LEVEL` ajoutée à la configuration de FND-02 (`fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`, défaut `info`). | Réglage du niveau de log ; une valeur invalide empêche le démarrage, comme les autres variables. | — |
| FND-05 | Les erreurs de configuration restent affichées avec `console.error`. | Le logger dépend de la configuration validée : il n'existe pas encore quand elle est invalide. | — |
| FND-05 | Identifiant de requête exposé uniquement par l'en-tête `X-Request-Id`, pas dans le corps des réponses. | Ne pas modifier le format des réponses défini par SET-05 ; ajout compatible (conventions §13), documenté en conventions §2.1. | — |
| FND-05 | Logs de requête limités à la méthode, au chemin **sans paramètres de requête**, au statut, à la durée et à `reqId` ; ni en-têtes ni corps. | Lisibilité et absence de fuite de données sensibles (précision du propriétaire sur la décision D5). | AUTH-05 : interdire les secrets dans les chemins |
| FND-05 | `GET /health` journalisé au niveau `debug`, donc masqué au niveau par défaut `info`. | Décision prise à la reprise (point laissé ouvert par FND-07) : éviter le bruit des outils de surveillance, tout en gardant la possibilité de voir ces appels avec `LOG_LEVEL=debug`. | — |
| FND-05 | Erreurs fatales du processus (`uncaughtException`, `unhandledRejection`) : log `fatal`, écriture des logs (délai de sécurité d'une seconde), puis arrêt immédiat avec le code 1. | Décision D6 ; l'arrêt propre (fermeture des connexions, signaux) relève de QUAL-06. | QUAL-06 |
| FND-05 | Erreurs de démarrage de FND-09 journalisées en `fatal` (titre, port, code, lignes de cause et de solution), sans trace d'appels ; `describeStartupError` et `startServer` inchangés ; seul `systemErrorCode` est exporté de `src/startup.ts`. | Reprise prévue par FND-09 ; inscrire le code d'erreur dans le log sans dupliquer sa lecture. | — |
| FND-05 | Arrêt du processus après une erreur fatale vérifié manuellement, pas automatiquement. | Même raison qu'en FND-02, FND-06 et FND-09 : un test automatique demanderait un processus séparé. | — |
| FND-05 | En production, un déploiement installé sans les dépendances de développement (`npm ci --omit=dev`) doit définir `NODE_ENV=production`. | `pino-pretty` n'est utilisé qu'en développement et n'est pas installé dans ce cas. | QUAL-06 |
| FND-05 | Le test du 500 (`integration/errors.test.ts`) lit désormais le log produit au lieu d'espionner `console.error` ; `LOG_LEVEL=silent` en test (`vitest.config.ts`). | Reprise prévue par FND-06 ; sortie des tests sans logs. | — |
| FND-05 | Pas de requêtes Postman. | Aucun endpoint n'est ajouté ; seul l'en-tête `X-Request-Id` apparaît dans les réponses. | DOC-01 |
| FND-08 | Bibliothèques retenues : `helmet` (8.3.0) et `express-rate-limit` (8.7.4), en dépendances. | Décisions D3 et D5 : en-têtes de sécurité standard et maintenus ; rate limiting avec en-têtes IETF, sans implémentation maison. | — |
| FND-08 | Limite du corps JSON abaissée de 100 Ko (valeur implicite d'`express.json()`) à 10 Ko, en constante (`JSON_BODY_LIMIT`). | Décision D1 : les corps de l'API sont petits ; moins de mémoire consommée par des requêtes abusives. Changement cassant admis (aucun client). | — |
| FND-08 | Un corps qui n'est pas en JSON passe de 400 (validation) à 415 `UNSUPPORTED_MEDIA_TYPE` ; `Content-Length: 0` n'est pas considéré comme un corps. | Reprise de FND-03 et précision SET-05 ; un POST vide envoyé par Postman ne doit pas être refusé en 415. | — |
| FND-08 | Limites de débit en constantes (300 par minute en global, 10 par 15 minutes pour le limiteur strict) ; compteur en mémoire, propre à chaque processus. | Décision D5 : préparer sans multiplier les variables d'environnement. | QUAL-02 : limites par environnement, stockage partagé |
| FND-08 | Limiteur strict créé par une fonction (`createStrictRateLimiter()`), branché sur aucune route. | Les endpoints de connexion et d'inscription n'existent pas ; chaque route sensible aura besoin de son propre compteur. | QUAL-02 |
| FND-08 | Limiteur global monté **avant** la lecture du corps (écart E1 par rapport au plan d'analyse, qui le plaçait après `express.json()`). | Les requêtes rejetées en 400, 413 ou 415 comptent dans le quota, et une rafale est arrêtée sans lire les corps. | — |
| FND-08 | En-têtes exposés par CORS : `X-Request-Id`, plus `Retry-After`, `RateLimit` et `RateLimit-Policy` (écart E2 ; le plan ne prévoyait que `X-Request-Id`). | Sans cette autorisation, le JavaScript d'un Front-End ne peut pas lire le délai d'attente après un 429. | — |
| FND-08 | `CORS_ORIGINS` vide ou faite d'espaces : traitée comme non définie (écart E3). | Une ligne `CORS_ORIGINS=` dans `.env` ne bloque pas le démarrage ; en production, on retombe sur le cas le plus sûr (aucune origine). | — |
| FND-08 | Origines CORS refusées désignées par leur position (« l'origine n°2… ») sans recopier la valeur ; forme normalisée exigée (minuscules, sans port par défaut) (écart E4). | Règle de FND-02 : aucune valeur dans les messages de configuration (une origine peut contenir des identifiants). Les navigateurs envoient l'origine sous forme normalisée : une autre écriture ne serait jamais reconnue. | — |
| FND-08 | Messages internes de `express-rate-limit` écrits dans les logs Pino (option `logger` de la bibliothèque, adaptateur `createRateLimitLogger`) au lieu de la console (écart E5). | Messages rattachés aux logs de l'application ; aucune modification globale de `console`. | — |
| FND-08 | Production sans `CORS_ORIGINS` : aucune origine autorisée et avertissement au démarrage, sans refus de démarrer. | Décision D4 : un déploiement où l'API n'est appelée que depuis la même origine, derrière un proxy, doit rester possible. | — |
| FND-08 | `trust proxy` non configuré : un en-tête `X-Forwarded-For` est ignoré, et signalé dans les logs seulement s'il est présent sur la première requête traitée par un limiteur (contrôle unique de la bibliothèque). | La configuration du reverse proxy relève de QUAL-06. | QUAL-06 |
| FND-08 | CORS sans cookies (`credentials` non activé) ; pas de `maxAge` pour les préflights ; `helmet` avec sa configuration par défaut. | La gestion des cookies dépend de la stratégie d'authentification ; les réglages fins ne sont pas demandés par le ticket. | AUTH-05 (cookies) |
| FND-08 | Comportement de production vérifié dans de petites applications de test (vrai middleware, politique CORS donnée) et manuellement, sans charger l'application avec `NODE_ENV=production`. | En production, le fichier `.env` local serait lu et pourrait influencer les tests. | — |
| FND-08 | Pas de requêtes Postman. | Aucun endpoint n'est ajouté ; seuls des en-têtes et les statuts 413, 415 et 429 apparaissent. | DOC-01 (prévoir le cas 415 avec un corps « Text » et le cas 429) |

## Écarts introduits par SET-05 (conventions de l'API)

Référence : `docs/api/conventions.md`.

| Ticket | Backlog initial | Décision retenue | Raison |
|---|---|---|---|
| CHAR-03 | Classe inexistante : « 404/400 selon convention » | **422** `CLASS_NOT_FOUND` | Un 404 sur `POST /api/v1/characters` laisserait croire que l'endpoint n'existe pas. Une ressource référencée dans le corps et introuvable relève du 422. |
| COMBAT-02 | `POST /api/v1/characters/:characterId/combat` | `POST /api/v1/combats`, avec le personnage et la cible dans le corps | Ressource au pluriel ; alignement sur les instructions du projet (§5.2). |
| COMBAT-07 | `POST /api/v1/combat/:combatId/actions/attack` | `POST /api/v1/combats/:combatId/actions` avec `type: "ATTACK"` | Point d'entrée unique pour toutes les actions, extensible et réutilisable tel quel pour un futur canal temps réel. |
| COMBAT-09 | `GET /api/v1/combat/:combatId` | `GET /api/v1/combats/:combatId` | Ressource au pluriel. |
| COMBAT-12 | `POST /api/v1/combat/:combatId/actions/skill` | `POST /api/v1/combats/:combatId/actions` avec `type: "SKILL"` | Même raison que COMBAT-07. |
| En-tête du backlog | « Convention exacte des identifiants » à confirmer | API : chaînes opaques. Stockage : UUID v7 générés par PostgreSQL 18 (finalisé en SET-04). | Identifiants impossibles à deviner, ordonnés dans le temps (v7). Un UUID ne remplace jamais un contrôle d'autorisation. |

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
- **FND-05 (réalisé) :** le test de l'erreur 500 espionnait `console.error`. Il lit désormais le log produit, et `LOG_LEVEL=silent` garde la sortie des tests propre (voir « Journalisation (FND-05) »).
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
- **FND-05 (réalisé) :** les appels à `/health` sont journalisés au niveau `debug`, donc masqués par défaut (voir « Journalisation (FND-05) »).
- **DB-01 :** un éventuel contrôle de la base de données dans `/health` sera décidé avec la mise en place de la base.
- **QUAL-04 :** `GET /api/v1/users` n'est pas paginé ; la pagination suivra les conventions (§9).
- **Documentation d'installation (README) :** indiquer l'URL de base et la route `/health`.

## Erreurs de démarrage (FND-09)

Ticket additionnel, issu du point « Gérer proprement les erreurs de démarrage » de FND-01 (voir le tableau des adaptations) : cette reprise est désormais clôturée.

### Comportement

| Situation | Résultat |
|---|---|
| Démarrage normal | `Server is running on http://localhost:<port>` (inchangé) |
| Configuration invalide (`PORT=abc`…) | **Inchangé** : message de FND-02 et code 1, avant toute tentative d'ouverture du port |
| Port déjà utilisé (`EADDRINUSE`) | Message ci-dessous, sans trace d'appels, code de sortie 1 |
| Accès refusé au port (`EACCES`) | Message dédié, sans trace d'appels, code de sortie 1 |
| Autre erreur d'ouverture du port | Message générique avec le code et le message système, sans trace d'appels, code de sortie 1 |

Messages (fonction pure `describeStartupError(error, port)`) :

```text
Le serveur ne peut pas démarrer.
  - Le port 4001 est déjà utilisé par un autre processus.
Arrêtez ce processus ou choisissez un autre port avec la variable PORT (voir .env.example).

Le serveur ne peut pas démarrer.
  - Accès refusé au port 4001 (port réservé par le système ou nécessitant des droits administrateur).
Choisissez un autre port avec la variable PORT, en évitant les ports réservés par le système (voir .env.example).

Le serveur ne peut pas démarrer.
  - Erreur inattendue lors de l'ouverture du port 4001 : <code> <message système>
Vérifiez la configuration réseau et la variable PORT (voir .env.example).
```

### Conception

- **`startServer(app, port)`** (`src/startup.ts`) : crée le serveur avec `http.createServer(app)`, attache les écouteurs temporaires **avant** `listen()`, se résout uniquement à l'événement `listening` (port réellement ouvert) et se rejette avec l'erreur système d'origine. Chaque écouteur retire l'autre dès qu'il se déclenche : aucun écouteur temporaire ne reste attaché après le démarrage. La fonction n'affiche rien et n'arrête pas le processus.
- **`describeStartupError(error, port)`** : construit les lignes du message, sans `any` ni transtypage ; ne reprend jamais `error.stack`.
- **`server.ts`** : `startServer(app, env.PORT).then(...)` affiche le message de démarrage ; `.catch(...)` affiche les lignes avec `console.error`, puis appelle `process.exit(1)`.
- **Inchangés :** `app.ts`, routes, controllers, services, middlewares, configuration, dépendances.

### Tests : 111 au total

| Fichier | Tests | Contenu |
|---|---|---|
| `unit/startup-error.test.ts` | 10 | Textes exacts pour `EADDRINUSE` et `EACCES` ; code inconnu ; `Error` sans code ; 4 valeurs qui ne sont pas des erreurs système ; jamais de trace d'appels ; port réellement repris |
| `integration/start-server.test.ts` | 4 | Résolution quand le serveur écoute réellement ; écouteurs temporaires retirés (comparés à un serveur de référence, Node ajoutant ses propres écouteurs internes) ; rejet `EADDRINUSE` sur un port réellement occupé ; vraie application servie (`GET /health` en 200) |
| Tests existants | 97 | Inchangés |

Les tests d'intégration utilisent uniquement des ports attribués par le système (port `0`) et ferment chaque serveur dans `afterEach`, y compris les connexions maintenues ouvertes.

Contrôles effectués lors de la réalisation :
- 111 tests réussis, y compris en ordre aléatoire ;
- écouteur `error` volontairement non retiré : le test des écouteurs échoue ;
- double démarrage réel (`npx tsx server.ts`, `npm start`, `npm run dev`) : message clair et code 1, au lieu de la trace brute `Error: listen EADDRINUSE …` relevée avant le ticket ;
- configuration invalide et démarrage normal inchangés.

### Critères d'acceptation

| Critère | Comment il est respecté |
|---|---|
| Port occupé : message clair, code 1 | Message `EADDRINUSE` ; vérification manuelle par double démarrage ; tests du message et du rejet |
| `EACCES` et erreur inconnue : message clair, sans trace, code 1 | Messages dédiés et générique ; tests unitaires, dont l'absence de trace |
| Démarrage normal inchangé | Même message ; test de la vraie application servie par `startServer` |
| `dev`, `build`, `start` fonctionnent | Vérifiés manuellement |
| Comportement couvert par des tests automatisés | 14 tests (10 unitaires, 4 d'intégration) |

### Points à reprendre

- **FND-05 (réalisé) :** les erreurs de démarrage sont journalisées avec Pino au niveau `fatal`, le logger est vidé avant l'arrêt, et le message de démarrage est un log `info` structuré. `describeStartupError` et `startServer` sont inchangés (voir « Journalisation (FND-05) »).
- **QUAL-06 :** arrêt propre d'un serveur démarré (signaux, fermeture des connexions).
- **DB-01 :** une éventuelle connexion à la base avant l'ouverture du port pourra s'insérer avant l'appel à `startServer`, sans l'anticiper maintenant.

## Journalisation (FND-05)

Réalisé selon l'analyse validée (décisions D1 à D6), conservée dans le projet Claude « API jeux vidéo », hors dépôt.

### Comportement

| Élément | Règle appliquée |
|---|---|
| Format | Lisible et coloré (pino-pretty) si `NODE_ENV=development` ; JSON, une ligne par événement, en `test` et `production` |
| Niveau | Variable `LOG_LEVEL` (défaut `info`) ; `silent` en test |
| Identifiant de requête | En-tête `X-Request-Id` repris s'il fait 1 à 128 caractères parmi `[A-Za-z0-9._-]`, sinon UUID généré ; toujours renvoyé en réponse ; présent dans chaque log de la requête sous `reqId` |
| Log de fin de requête | Méthode, chemin **sans paramètres de requête**, statut, durée (`responseTime`), `reqId` ; message du type `GET /api/v1/users 200` ; ni en-têtes ni corps |
| Niveau par statut | `info` (2xx/3xx), `warn` (4xx), `error` (5xx) ; `GET /health` réussi en `debug` |
| Masquage | Clés `authorization`, `cookie`, `set-cookie`, `password`, `token`, `accessToken`, `refreshToken`, `secret`, à la racine et un niveau plus bas, remplacées par `[REDACTED]` |
| Erreur inattendue (500) | `req.log.error({ err }, 'Unexpected error')` : trace complète dans les logs, rattachée à `reqId` ; réponse HTTP toujours générique |
| Démarrage | Log `info` « Server is running on http://localhost:<port> » avec `port` et `nodeEnv` |
| Erreur de démarrage (FND-09) | Log `fatal` : titre en message, champs `port`, `code` et `details` (cause et solution), sans trace d'appels ; écriture des logs, puis arrêt avec le code 1 |
| Erreur fatale du processus | `uncaughtException` et `unhandledRejection` : log `fatal` avec `err`, écriture des logs (délai de sécurité d'une seconde), puis arrêt avec le code 1 ; un second appel est ignoré |
| Configuration invalide | Inchangé : `console.error` et code 1 (le logger n'existe pas encore) |

### Fichiers créés ou modifiés

- **Créés :**
  - `src/config/logger.ts` : `createLogger(settings, destination?)`, logger unique `logger`, `flushLoggerAndExit(code)` ;
  - `src/middlewares/request-logger.middleware.ts` : `createRequestLogger(logger)` (pino-http), `resolveRequestId`, `requestPath`, `requestLogLevel` ;
  - `tests/helpers/log-capture.ts` : logger JSON qui écrit en mémoire, pour lire les logs dans les tests.
- **Modifiés :**
  - `src/config/environment.ts` et `.env.example` : `LOG_LEVEL` ;
  - `src/app.ts` : log de requête monté en premier ;
  - `src/middlewares/error.middleware.ts` : `console.error` remplacé par `req.log.error` (logger global en secours) ;
  - `server.ts` : log de démarrage, erreurs de démarrage en `fatal`, gestion des erreurs fatales du processus ;
  - `src/startup.ts` : `export` de `systemErrorCode` (seul changement) ;
  - `vitest.config.ts` : `LOG_LEVEL=silent` ;
  - `package.json`, `package-lock.json` : nouvelles dépendances.
- **Inchangés :** routes, controllers, services, repository, schémas, middleware de validation, réponses JSON de l'API.

### Tests : 159 au total

| Fichier | Tests | Contenu |
|---|---|---|
| `unit/logger.test.ts` | 10 | Masquage de chacune des 8 clés sensibles (racine et un niveau plus bas) ; données non sensibles intactes ; niveau minimal respecté |
| `unit/request-logger.test.ts` | 20 | Identifiant repris ou régénéré (absent, vide, espaces, retour à la ligne, 129 caractères, plusieurs valeurs ; 128 caractères accepté) ; chemin sans paramètres, `originalUrl` préféré ; niveau selon le statut et pour `/health` |
| `integration/request-logger.test.ts` | 10 | Même `reqId` dans l'en-tête et le log ; identifiant client repris ou régénéré ; aucun paramètre de requête, en-tête ni corps dans les logs ; 4xx en `warn` ; JSON illisible sans le corps reçu ; 500 relié à sa requête avec la trace dans les logs et rien dans la réponse ; `/health` en `debug` ; en-tête présent sur l'application réelle |
| `unit/environment.test.ts` | 20 | Adapté : `LOG_LEVEL` par défaut, 7 valeurs acceptées, valeur inconnue refusée |
| `integration/errors.test.ts` | 6 | Adapté : le test du 500 lit le log d'erreur et vérifie son `reqId` |
| Autres fichiers | 93 | Inchangés |

Contrôles effectués lors de la réalisation :
- 159 tests réussis, y compris en ordre aléatoire ;
- chemin journalisé avec ses paramètres (`req.url`) : 1 test échoue ; masquage retiré : 8 tests échouent ;
- en développement : logs lisibles, paramètres de requête absents des chemins, `/health` masqué, double démarrage en `FATAL` puis code 1 ;
- en production : une ligne JSON par événement, aucun secret (en-tête `Authorization`, mot de passe du corps, paramètre de requête) dans le fichier de logs, double démarrage en JSON niveau 60 puis code 1 ;
- `LOG_LEVEL` : `verbose` refusé au démarrage, `warn` masque les requêtes réussies, `debug` affiche `/health` ;
- exception non gérée et promesse rejetée : log `fatal` écrit avant l'arrêt, en mode lisible et en JSON, puis code 1.

### Critères d'acceptation

| Critère | Comment il est respecté |
|---|---|
| Une requête peut être reliée à ses logs | En-tête `X-Request-Id` en réponse, identique au champ `reqId` de chaque log de la requête, y compris le log d'erreur d'un 500 ; tests d'intégration dédiés |
| Aucun secret n'apparaît dans les logs | Ni en-têtes, ni corps, ni paramètres de requête dans les logs de requête ; masquage des clés sensibles ; tests et contrôle manuel en production |
| Les logs de développement restent lisibles | pino-pretty en développement, message court par requête (`GET /api/v1/users 200`), `/health` masqué par défaut |

### Points à reprendre

- **AUTH-05 :** interdire les secrets dans les chemins et les paramètres de requête (le chemin est journalisé).
- **QUAL-06 :** arrêt propre (signaux, fermeture des connexions) ; rappeler que `NODE_ENV=production` est obligatoire sans dépendances de développement.
- **Documentation d'installation (README) :** décrire `LOG_LEVEL` et l'en-tête `X-Request-Id`.

## Protections HTTP (FND-08)

Réalisé selon l'analyse validée (décisions D1 à D6, précisions du propriétaire), avec les écarts E1 à E5 validés (voir le tableau des adaptations).

### Comportement

| Élément | Règle appliquée |
|---|---|
| Taille du corps | 10 Ko au plus (`JSON_BODY_LIMIT`) ; au-delà, 413 `PAYLOAD_TOO_LARGE` |
| Format du corps | Une requête avec un corps (`Content-Length` supérieur à 0 ou `Transfer-Encoding`) doit être en `application/json`, sinon 415 `UNSUPPORTED_MEDIA_TYPE` ; requêtes sans corps non concernées |
| En-têtes de sécurité | `helmet()` avec sa configuration par défaut ; `X-Powered-By` supprimé |
| CORS | `CORS_ORIGINS` définie : ces origines seulement ; non définie en production : aucune, avec un avertissement au démarrage ; non définie en development et test : toutes. En-têtes exposés : `X-Request-Id`, `Retry-After`, `RateLimit`, `RateLimit-Policy`. Pas de cookies |
| Validation de `CORS_ORIGINS` | Origines `http(s)://hôte[:port]` normalisées, séparées par des virgules ; chemin, `/` final, paramètres, fragment, identifiants, autre protocole et joker `*` refusés au démarrage (code 1), avec la position de l'origine fautive |
| Rate limiting global | `/api/v1` : 300 requêtes par minute et par adresse IP ; `/health` non limité ; préflights non comptées ; en-têtes `RateLimit` et `RateLimit-Policy` |
| Dépassement | `next(new HttpError(429, 'RATE_LIMITED', 'Too many requests'))` : réponse produite par le gestionnaire d'erreurs existant, avec `Retry-After` ; log `warn` de la requête avec son `reqId` |
| Limiteur strict | `createStrictRateLimiter()` : 10 requêtes par 15 minutes, branché sur aucune route (QUAL-02) |
| Messages de `express-rate-limit` | Écrits dans les logs Pino (`Rate limiter warning` en `warn`, `Rate limiter error` en `error`, champ `context` quand la bibliothèque fournit un message) ; rien dans la console |

### Ordre des middlewares (`src/app.ts`)

1. Log de requête (FND-05) : toutes les réponses, y compris 413, 415 et 429, sont journalisées avec leur `reqId`.
2. En-têtes de sécurité.
3. CORS : répond aux préflights `OPTIONS`, qui ne consomment donc pas le quota ; une réponse 429 reste lisible par un navigateur autorisé.
4. Limiteur global sur `/api/v1`, avant la lecture du corps.
5. Contrôle du `Content-Type` (415), puis `express.json({ limit: '10kb' })`.
6. `/health`, routes `/api/v1`, 404, gestionnaire d'erreurs.

### Fichiers créés ou modifiés

- **Créés :**
  - `src/config/http.ts` : `JSON_BODY_LIMIT`, `GLOBAL_RATE_LIMIT`, `STRICT_RATE_LIMIT`, `CORS_EXPOSED_HEADERS`, `resolveCorsAllowedOrigins()`, `corsAllowedOrigins` ;
  - `src/middlewares/security.middleware.ts` : `createSecurityHeaders()`, `createCorsMiddleware()`, `requireJsonContentType` ;
  - `src/middlewares/rate-limit.middleware.ts` : `createRateLimitLogger()`, `createRateLimiter()`, `globalRateLimiter`, `createStrictRateLimiter()` ;
  - `tests/integration/security.test.ts` et `tests/integration/rate-limit.test.ts`.
- **Modifiés :**
  - `src/config/environment.ts` et `.env.example` : variable facultative `CORS_ORIGINS` ;
  - `src/app.ts` : ordre des middlewares ci-dessus ;
  - `server.ts` : avertissement au démarrage en production sans `CORS_ORIGINS` ;
  - `tests/unit/environment.test.ts` : tests de `CORS_ORIGINS` ;
  - `package.json`, `package-lock.json` : nouvelles dépendances.
- **Inchangés :** routes, controllers, services, repository, schémas, gestionnaire d'erreurs, logger, démarrage ; aucun nouveau code d'erreur.

### Tests : 219 au total

| Fichier | Tests | Contenu |
|---|---|---|
| `integration/security.test.ts` | 26 | En-têtes de sécurité sur un succès et une erreur, `X-Powered-By` absent, `/health` garde `no-store` ; 11 Ko refusé en 413, 9 Ko accepté ; 415 pour `text/plain`, formulaire, XML et corps sans `Content-Type` ; `charset=utf-8` accepté ; GET, DELETE et POST vide non concernés ; CORS de l'application (toutes origines en test, préflight 204, liste lue depuis `CORS_ORIGINS`) ; politique selon l'environnement ; production avec et sans liste (requêtes sans `Origin` toujours servies) |
| `integration/rate-limit.test.ts` | 15 | 429 au format d'erreur avec `Retry-After` et `RateLimit` ; quota restant sur chaque réponse, sans `X-RateLimit-*` ; un seul log `warn` avec `reqId` ; 429 lisible par CORS ; préflights non comptées ; compteurs indépendants ; `X-Forwarded-For` ignoré, une ligne de log, rien dans la console ; contrôle limité à la première requête ; adaptateur de logs ; limiteur strict 10/15 min et non branché ; limiteur global : 301e requête en 429, `/health` libre, 413 et 415 comptés, préflight non comptée |
| `unit/environment.test.ts` | 39 | 19 tests ajoutés : `CORS_ORIGINS` absente, vide ou faite d'espaces ; liste avec espaces ; 13 refus ; plusieurs erreurs signalées par position ; valeur jamais recopiée |
| Autres fichiers | 139 | Inchangés |

Contrôles effectués lors de la réalisation :
- 219 tests réussis, y compris en ordre aléatoire ;
- régressions introduites volontairement, toutes détectées : contrôle du 415 retiré, limite par défaut, limiteur avant CORS, `helmet` retiré, toutes les origines en production, réponse 429 construite à la main, limiteur après la lecture du corps, forme normalisée non exigée, `Content-Length: 0` traité comme un corps, option `logger` retirée, message de contexte perdu ;
- en développement : en-têtes de sécurité, 413 à 11 Ko, 415 en `text/plain`, DELETE en 204, CORS ouvert, préflight 204 ; rafale de 305 requêtes : 300 réponses 200 puis 5 réponses 429 avec `Retry-After`, `/health` toujours en 200 ;
- en production : avertissement au démarrage sans `CORS_ORIGINS` et aucune origine autorisée ; avec `CORS_ORIGINS`, seule l'origine listée reçoit `Access-Control-Allow-Origin` ; curl servi normalement dans les deux cas ;
- `CORS_ORIGINS` invalide (`*`, `/` final, identifiants, `ftp://`) : arrêt avec le message attendu et le code 1.

### Critères d'acceptation

| Critère | Comment il est respecté |
|---|---|
| Un body trop volumineux est rejeté | Limite explicite de 10 Ko, 413 `PAYLOAD_TOO_LARGE` au format d'erreur ; tests à 11 Ko (refus) et 9 Ko (accepté) |
| CORS n'autorise pas toutes les origines en production par défaut | Production sans `CORS_ORIGINS` : aucune origine, avertissement au démarrage ; `*` refusé dans `CORS_ORIGINS` ; tests et contrôle manuel |
| Les protections ne bloquent pas les tests locaux documentés | CORS ne concerne pas Postman ni curl ; quota large (300 par minute), `/health` exclu ; les 159 tests existants passent sans modification |

### Points à reprendre

- **QUAL-02 :** brancher `createStrictRateLimiter()` sur la connexion et l'inscription ; rendre les limites configurables par environnement ; stockage partagé si plusieurs instances.
- **QUAL-06 :** configurer `trust proxy` derrière un reverse proxy, pour que le rate limiting utilise l'adresse IP réelle du client ; HTTPS (l'en-tête `Strict-Transport-Security` n'a d'effet qu'en HTTPS).
- **AUTH-05 :** décider des cookies et, le cas échéant, activer `credentials` dans CORS avec une liste d'origines obligatoire.
- **DOC-01 :** requêtes Postman pour les cas 413, 415 et 429.
- **Documentation d'installation (README) :** décrire `CORS_ORIGINS`, en plus de `LOG_LEVEL` et de l'en-tête `X-Request-Id` (point de FND-05).

## Base de données (SET-04)

Décisions détaillées dans `docs/architecture/database.md` : PostgreSQL 18, Prisma 7.10.1 avec `@prisma/adapter-pg`, UUID v7 générés par PostgreSQL, migrations Prisma Migrate versionnées, base de test `mmorpg_test` protégée (variable `TEST_DATABASE_URL` dédiée).

| Adaptation | Raison | Reprise |
|---|---|---|
| Aucune dépendance installée, aucun fichier de configuration créé | Le ticket décide et documente ; la mise en place relève de DB-01 | DB-01 (nécessite Docker sur le poste) |
| Aucun test automatisé ni requête Postman | Ticket de documentation, sans modification du code (comme SET-01 et SET-05) | — |
| Garde de la base de test seulement décrite | Implémentation et tests avec la connexion à la base | DB-01 |
| Identifiants numériques des utilisateurs conservés | Passage aux UUID avec les repositories persistants | DB-04 |
| CLI Prisma absente d'une installation de production (`npm ci --omit=dev`) | Dépend de la procédure de déploiement | QUAL-06 |

## Gameplay du MVP (SET-02, SET-03)

Parcours du MVP : `docs/gameplay/mvp-scope.md`. Règles chiffrées : `docs/gameplay/rules.md` (décisions G1 à G12 validées avec leurs valeurs par défaut, complétées par les statistiques des classes et le monde initial).

| Ticket | Adaptation | Raison |
|---|---|---|
| WORLD-07 | Au MVP, chaque combat crée sa propre instance de monstre ; instances partagées, réservation et réapparition reportées | Pas de concurrence entre joueurs dans le premier parcours |
| WORLD-01, ITEM-01 à 04, REWARD-01 | Inclus dans le MVP malgré leur priorité P1 | Nécessaires à la zone de départ et au butin |
| WORLD-06 | Hors MVP : le personnage est placé dans la zone de départ à sa création | Une seule zone au MVP |
| COMBAT-08 | Tour du monstre résolu automatiquement dans la même requête | Fonctionnement REST, sans temps réel |
| STAT-05 | Hors MVP : PV et mana remis au maximum après chaque combat | Pas de soins ni de régénération au MVP |
| SET-02, SET-03 | Aucun test automatisé ni requête Postman | Tickets de documentation, sans modification du code |
| CHAR-01 | `GET /classes` (et le détail d'une classe) est **public** : pas d'authentification, pas de dépendance à AUTH-07 (décision du 2026-11-22) | Donnée de référence sans propriétaire ; cohérent avec les dépendances et critères de CHAR-01 |
| SET-03 (G2) | Statistique de critique retirée du MVP le 2026-11-23, à la validation de DB-02 : supprimée de `rules.md` et du modèle, reportée à COMBAT-05 | Le MVP ne prévoit pas de coups critiques ; une statistique inutilisée aurait été stockée sans règle |
| AUTH-07 | **Point à traiter :** clarifier dans `docs/api/conventions.md` la distinction entre routes publiques et routes protégées, et préciser la portée de la phrase de la section 7 (« chaque accès vérifie […] l'authentification »), qui vise les ressources propres aux joueurs | La convention actuelle ne liste pas les routes publiques |

## Initialisation de la base (DB-01)

Mise en place des décisions de SET-04. Détails et commandes : `docs/architecture/database.md` (sections 2, 4, 6 et 8).

### Dépendances ajoutées (versions exactes)

| Paquet | Type | Justification |
|---|---|---|
| `@prisma/client` 7.10.1 | Exécution | Client typé de l'ORM retenu (SET-04) |
| `@prisma/adapter-pg` 7.10.1 | Exécution | Adaptateur de pilote obligatoire avec Prisma 7, branché sur un `pg.Pool` géré par l'application |
| `pg` 8.23.1 | Exécution | Pilote PostgreSQL, importé directement pour le pool et la vérification de connexion |
| `prisma` 7.10.1 | Développement | CLI : génération du client et migrations |
| `@types/pg` 8.23.1 | Développement | Types de `pg` |

Les autres alertes de `npm audit` (`esbuild`, `minimatch` via `nodemon`) existaient avant DB-01.

### Risque accepté : vulnérabilité `effect` (à réexaminer à chaque mise à jour de Prisma)

| Élément | Constat (2026-11-22) |
|---|---|
| Alerte | GHSA-7589-6fvf-x4pw, sévérité élevée : déni de service par expression régulière dans `Schema.TemplateLiteral`, `effect` ≤ 3.22.0 (corrigé en 3.22.1) |
| Chaîne | `prisma` 7.10.1 → `@prisma/config` 7.10.1 → `effect` 3.20.0 (version exacte). De plus, `node_modules/prisma/build/cli.js` **embarque sa propre copie** d'`effect` 3.20.0 |
| Exposition | Faible : CLI de développement uniquement, qui lit des fichiers du projet (`prisma.config.ts`, schéma) ; `effect` n'est ni dans le build ni dans `@prisma/client`. `@prisma/config` n'utilise pas `TemplateLiteral` |
| Correctif proposé par `npm audit` | `prisma` 6.12.0 : retour à Prisma 6, incompatible avec SET-04 ; refusé |
| Override `"overrides": { "effect": "3.22.5" }` | Testé : compatible (validate, generate, migrations, `test:db`, tests, typecheck, build). **Non appliqué** : il ne remplace que la copie de `@prisma/config` ; la copie embarquée dans `cli.js` reste en 3.20.0, et `npm audit` deviendrait silencieux alors que le code vulnérable resterait installé |
| Réexamen | À chaque mise à jour de `prisma` : vérifier la version d'`effect` dépendante et embarquée (`npm ls effect`, version dans `cli.js`) et relancer `npm audit` |

### Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `docker-compose.yml`, `docker/postgres/init/01-create-test-database.sql` | Conteneur `postgres:18.7`, port sur `127.0.0.1`, volume sur `/var/lib/postgresql`, création de `mmorpg_test` |
| `prisma.config.ts`, `prisma/schema.prisma` | Configuration de la CLI (charge le `.env` avec `process.loadEnvFile()`) ; schéma sans modèle (DB-02) |
| `src/database/client.ts`, `src/database/errors.ts` | Pool, adaptateur et client uniques ; vérification `SELECT 1` ; messages d'échec sans message d'origine ni URL |
| `src/config/environment.ts` | `DATABASE_URL` : URL PostgreSQL, obligatoire hors test |
| `server.ts` | Vérification de la base avant l'ouverture du port ; arrêt avec le code 1 en cas d'échec |
| `tests/helpers/test-database.ts`, `tests/database/*`, `vitest.db.config.ts` | Garde de la base de test, migrations puis tests base de données (`npm run test:db`) |
| `tests/unit/database-error.test.ts`, `tests/unit/test-database-guard.test.ts`, `tests/unit/environment.test.ts` | Tests sans base |
| `package.json`, `vitest.config.ts`, `tsconfig.json`, `.gitignore`, `.env.example` | Dépendances et scripts `db:*`, `test:db`, `pretypecheck` ; exclusion de `tests/database/` de `npm test` ; client généré ignoré ; nouvelles variables |

### Adaptations

| Adaptation | Raison | Reprise |
|---|---|---|
| Option `--shims` ajoutée à tsup dans `npm run build` | Le client généré utilise `import.meta.url`, vide dans un bundle CommonJS : le serveur compilé plantait au démarrage. `moduleFormat = "cjs"` aurait cassé `tsx` (projet ESM) | — |
| Génération du client par `pretypecheck`, pas par `postinstall` | `postinstall` échouerait avec `npm ci --omit=dev` (CLI absente) | QUAL-06 |
| `DATABASE_URL` facultative en test | Les tests unitaires et HTTP n'utilisent aucune base ; les tests de `environment.ts` fournissent une URL factice | — |
| Le pool n'est utilisé qu'au démarrage | Les repositories restent en mémoire jusqu'à DB-04 | DB-04 |
| Fermeture du pool à l'arrêt non gérée | Arrêt propre du serveur | QUAL-06 |
| `db:status` renvoie le code 1 et `migrate diff` ne s'exécute pas | Aucune migration avant DB-02 | DB-02 |

### Tests : 260 au total (`npm test`), 3 tests base de données (`npm run test:db`)

- 41 nouveaux tests sans base (219 → 260) : garde de la base de test (21), messages d'échec de connexion (11, dont l'absence du message d'origine pour chaque code), `DATABASE_URL` (9).
- Tests existants de `environment.ts` adaptés : une URL factice est ajoutée à chaque source et aux valeurs attendues, sans changer leur logique.
- Vérifié aussi : `npx vitest run --sequence.shuffle`, `npm run build`, démarrage du serveur compilé et de `tsx` sans base (ECONNREFUSED), hôte introuvable, `DATABASE_URL` absente ou invalide, refus de `test:db` (URL absente, autre base, hôte distant, paramètres) ; aucun mot de passe dans les sorties.
- `tests/database/connection.test.ts` : connexion, base `mmorpg_test`, génération d'un UUID v7 : 3/3 avec `npm run test:db`.
- Vérifié avec Docker Desktop : conteneur `postgres:18.7` *healthy*, bases `mmorpg_dev` et `mmorpg_test` créées, port publié sur `127.0.0.1` uniquement, volume sur `/var/lib/postgresql`, `db:status` connecté, serveur démarré (`tsx` et build) avec `GET /health` à 200, base arrêtée puis `npm start` : `ECONNREFUSED` et code 1, données conservées après `db:down` puis `db:up`.

## Modèle de données, migration et seed (DB-02, DB-03)

Réalisés dans un même lot : la migration et le seed (DB-03) sont nécessaires pour vérifier le modèle (DB-02) sur une vraie base. Détails : `docs/architecture/data-model.md` ; commandes : `docs/architecture/database.md` (sections 5 et 8).

### Décisions validées

| # | Décision |
|---|---|
| D1 | Modèle : `users`, `characters`, et les données de référence du MVP (`character_classes`, `zones`, `monsters`, `zone_monsters`, `items`, `loot_entries`). Hors périmètre : instances de monstres, combats, inventaire, portefeuille |
| D2 | Données de référence : UUID v7 et `code` unique stable, clé du seed |
| D3 | Nom de personnage unique sans tenir compte de la casse : `normalized_name` unique et `CHECK (normalized_name = lower(name))` |
| D4 | Statistiques calculées (classe et niveau), non stockées ; pas de PV courants au MVP |
| D5 | Suppression : cascade de `users` vers `characters` ; restriction pour toutes les données de référence utilisées, y compris par `zone_monsters` et `loot_entries` |
| D6 | Invariants en base par des `CHECK` écrits dans la migration (liste dans `data-model.md` §4) |
| D7 | Données de référence dans `prisma/seed/reference-data.ts`, vérifiées contre les tableaux de `rules.md` |
| D8 | Seed : mise à jour ou création selon le `code`, dans une transaction, sans suppression |
| D9 | Pas de données de démonstration ; les tests créent et suppriment leurs propres joueurs |

Corrections demandées à la validation : pas de statistique de critique dans `character_classes` (hors MVP) ; email unique sans tenir compte de la casse (`CHECK (email = lower(email))`) ; `current_zone_id` obligatoire (la création d'un personnage attribue la Clairière : responsabilité de DB-04 et CHAR-03) ; restriction cohérente pour `zone_monsters` et `loot_entries`.

### Adaptations

| Ticket | Adaptation | Raison | Reprise |
|---|---|---|---|
| WORLD-01, WORLD-02, WORLD-03, ITEM-01, REWARD-01 | Tables de référence créées et remplies dès DB-02/DB-03 | Nécessaires au seed de DB-03 (« classes, monstres ») ; valeurs déjà fixées par `rules.md` | Ces tickets gardent repositories, services, endpoints et colonnes éventuelles |
| REWARD-01 | `loot_entries` : un seul objet par monstre (clé primaire `monster_id`), sans quantité stockée | Exactement la règle de `rules.md` §7 (au plus un objet, quantité 1) | Quantités ou objets multiples : nouvelle migration |
| WORLD-01 | Pas de description ni de condition d'accès pour les zones | Non prévues par `rules.md` | WORLD-01 |
| DB-04, AUTH-01 | Email écrit en minuscules ; `normalized_name` et zone de départ (`STARTING_ZONE_CODE`) remplis par les repositories | Contraintes `CHECK` et `current_zone_id` obligatoire | DB-04, CHAR-03 |
| `database.md` §5 | Contrôle de cohérence par `migrate diff --from-config-datasource` au lieu de `--from-migrations` | Prisma 7 exige une base « shadow » déclarée pour `--from-migrations` | — |
| Seed en production | Exécuté par `tsx` (dépendance de développement) | Procédure de déploiement non définie | QUAL-06 |

### Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma` | 8 modèles et l'enum `ItemType` |
| `prisma/migrations/20261123092444_init/migration.sql`, `prisma/migrations/migration_lock.toml` | Première migration, avec 10 contraintes `CHECK` ajoutées à la main |
| `prisma/seed/reference-data.ts`, `prisma/seed/seed.ts`, `prisma/seed/index.ts` | Données de référence, seed idempotent, point d'entrée de `npm run db:seed` |
| `prisma.config.ts`, `package.json`, `tsconfig.json` | Commande de seed, script `db:seed`, inclusion de `prisma/**/*.ts` |
| `tests/database/global-setup.ts` | Seed des données de référence après les migrations, sur `mmorpg_test` |
| `tests/helpers/player-fixtures.ts` | Données de joueurs des tests et lecture des erreurs de contraintes |
| `tests/unit/reference-data.test.ts`, `tests/database/schema-constraints.test.ts`, `tests/database/seed.test.ts` | Tests |
| `docs/architecture/data-model.md` (nouveau), `database.md`, `AGENTS.md` | Documentation |

### Tests : 277 sans base (`npm test`), 38 avec base (`npm run test:db`)

- `tests/unit/reference-data.test.ts` (17) : concordance des données du seed avec les tableaux de `rules.md` (lus dans le fichier), codes uniques, références valides, bornes des `CHECK`.
- `tests/database/schema-constraints.test.ts` (30) : UUID v7, email en minuscules et unique, nom unique sans casse, format du nom, niveau, XP, zone obligatoire, cascade, restrictions (code `23001`), `CHECK` des données de référence, un seul butin par monstre. Les écritures refusées sont faites dans des transactions annulées : aucune donnée de référence ne peut être supprimée par erreur.
- `tests/database/seed.test.ts` (5) : seed relancé sans doublon, identifiants conservés, valeurs remises, valeurs conformes, données de joueurs intactes.
- Vérifié aussi : `prisma validate`, migration appliquée sur `mmorpg_dev` et `mmorpg_test`, `db:status` à jour (code 0), aucun écart entre la base migrée et le schéma, `npm run db:seed` lancé deux fois (3 classes, 1 zone, 3 monstres, 3 affectations, 3 objets, 3 butins), ordre aléatoire, build.

## Repositories persistants (DB-04)

Les accès à la base passent uniquement par les repositories Prisma ; les services reçoivent leur repository (injection par fonctions de construction), ce qui permet aux tests d'en fournir un contrôlé.

### Décisions validées

| # | Décision |
|---|---|
| D1 | Repository des personnages créé sans service ni endpoint (`create`, `findById`, `findAllByUserId`, `countByUserId`) ; `create` remplit `normalized_name = lower(name)` et la zone de départ |
| D2 | Injection : `createUserService(repository)`, `createUserController(service)`, `createUserRoutes(controller)`, `createApp({ userService })` ; `server.ts` assemble la version Prisma |
| D3 | Repository en mémoire **dans `tests/helpers/` uniquement** ; une suite de contrat commune vérifie qu'il se comporte comme le repository Prisma |
| D4 | Unicité garantie par la base (plus de lecture préalable) : `P2002` → `UniqueConstraintError` → 409 ; introuvable (`P2025`) → `undefined` / `false` → 404 |
| D5 | Identifiants UUID dans l'API (`z.uuid()`) : un autre format donne 400 |
| D6 | Email mis en minuscules par le service ; le contrôle existant (chaîne non vide) est conservé |
| D7 | Contrat de réponse inchangé (`id`, `name`, `email`) ; tri explicite par `createdAt`, puis `id` |
| D8 | `asyncHandler` : les erreurs des handlers asynchrones atteignent le gestionnaire centralisé (Express 4) |
| D9 | Plus d'utilisateurs initiaux : la base démarre vide |

### Adaptations

| Élément | Adaptation | Raison | Reprise |
|---|---|---|---|
| `src/config/gameplay.ts` | `STARTING_ZONE_CODE` y est défini ; `prisma/seed/reference-data.ts` le réexporte | Une seule définition, utilisée par le code applicatif et par le seed | — |
| `src/repositories/errors.ts` | Erreurs métier reconnues par leur propriété `kind`, pas par `instanceof` | Fiable avec des modules rechargés (`vi.resetModules`) et des repositories de test | — |
| Erreurs `CHECK` (nom, email non normalisé) | Non traduites par les repositories | Les données sont validées avant l'appel (Zod, service) ; une violation est une erreur de programmation (500) | CHAR-03 (validation du nom) |
| Fermeture du pool à l'arrêt | Non gérée | Arrêt propre du serveur | QUAL-06 |
| `tests/helpers/errors.ts` | `captureError` (synchrone) remplacé par `rejectionOf` (promesses) | Le service est désormais asynchrone | — |

### Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `src/repositories/user.repository.ts`, `src/repositories/character.repository.ts`, `src/repositories/errors.ts` | Interfaces, implémentations Prisma, traduction des erreurs |
| `src/types/user.ts`, `src/types/character.ts`, `src/config/gameplay.ts` | Types métier, constante de zone de départ |
| `src/services/user.service.ts`, `src/controllers/user.controller.ts`, `src/routes/user.routes.ts`, `src/routes/index.ts`, `src/app.ts`, `server.ts` | Fonctions de construction, asynchrone, DTO, assemblage |
| `src/utils/async-handler.ts`, `src/schemas/user.schema.ts` | Relais des erreurs asynchrones ; identifiant UUID |
| `tests/helpers/in-memory-user-repository.ts`, `tests/helpers/user-repository-contract.ts`, `tests/helpers/fresh-modules.ts`, `tests/helpers/errors.ts` | Repository contrôlé, contrat, application de test |
| Tests unitaires et d'intégration adaptés ou ajoutés ; `tests/database/user.repository.test.ts`, `character.repository.test.ts`, `users-api.test.ts` | Voir ci-dessous |
| `docs/api/conventions.md` (§1.3, §15, §16), `data-model.md`, `database.md`, `AGENTS.md` | Documentation |

### Tests : 302 sans base (`npm test`), 61 avec base (`npm run test:db`)

- Sans base : contrat sur le repository en mémoire (9), `asyncHandler` (3), service (21, asynchrone, UUID, email en minuscules), API `/users` (31, dont 400 sur un identifiant non UUID, 409 sans casse, 500 sur une erreur asynchrone), validation (UUID).
- Avec base : contrat sur Prisma (9) et spécificités PostgreSQL (3) ; personnages (9 : zone de départ, `normalized_name`, nom unique sans casse, références inexistantes, tri, comptage, cascade) ; API sur PostgreSQL (2) avec **deux instances d'application indépendantes** (modules rechargés, nouveau pool et nouveau client, première connexion fermée) : les données créées par la première sont relues par la seconde.
- Vérifié aussi : aucune référence à Prisma dans `src/services`, `src/controllers` et `src/routes` ; schéma et base migrée sans écart ; test manuel avec `npm run dev` (création, arrêt, redémarrage, relecture, puis suppression de l'utilisateur de test).

## Comptes et inscription (AUTH-01, AUTH-03, AUTH-04 ; AUTH-02 partiel)

Lot L1 de l'EPIC 03. Un compte se crée uniquement par `POST /api/v1/auth/register`, avec un mot de passe hashé en Argon2id. Les routes `/api/v1/users` sont retirées jusqu'à la mise en place des permissions.

### Décisions validées

| # | Décision |
|---|---|
| D1 | Table `users` : `password_hash` (texte, obligatoire) et `role` (énumération `user_role`, `PLAYER` par défaut). **Pas de statut de compte** : aucun critère d'AUTH-01 à AUTH-04 ne l'exige, le refus d'un compte désactivé relève d'AUTH-06 (précision SET-05) |
| D1 bis | `user_role` ne contient que `PLAYER` : AUTH-01 demande le champ, AUTH-08 décide des rôles (« administrateur si retenu ») et l'ajoutera par une migration (`ALTER TYPE … ADD VALUE`, non destructive) |
| D2 | `name` conservé, obligatoire à l'inscription |
| D3 | Argon2id (paquet `argon2`), paramètres OWASP : 19 Mio, 2 passes, 1 fil (`src/config/auth.ts`). Hachage injectable (`PasswordHasher`) : Argon2id dans `server.ts`, hachage rapide dans les tests sans base |
| D4 | Mot de passe de 15 à 128 caractères Unicode, sans règle de composition, sans confirmation ; valeur ni rognée ni normalisée |
| D5 | Email : format vérifié (`z.email()`), 254 caractères au plus, mis en minuscules par le service |
| D6 | Réponse 201 : `{ id, name, email, role }` ; aucun jeton émis (AUTH-05, AUTH-06) |
| D7 | Seule `POST /api/v1/auth/register` est publique. Les six routes `/api/v1/users` sont **supprimées** (404 `ROUTE_NOT_FOUND`) et seront réintroduites avec leurs permissions (AUTH-02 après AUTH-07 et AUTH-08 ; AUTH-09 pour `/users/me`) |
| D8 | Migration `auth_user_fields` générée sans être appliquée (`--create-only`), relue, puis appliquée après vérification que `users` était vide dans `mmorpg_dev` et `mmorpg_test` (aucune réinitialisation, aucune suppression) |

### Dépendance ajoutée

| Paquet | Version | Raison |
|---|---|---|
| `argon2` | `^0.45.2` | Argon2id recommandé par le backlog (AUTH-03) et l'OWASP ; Node 22 ne fournit pas Argon2 (`crypto.argon2` n'existe qu'à partir de Node 24.7). Module natif : binaires précompilés installés sans compilation sous Windows (vérifié) |

### Adaptations

| Élément | Adaptation | Raison | Reprise |
|---|---|---|---|
| AUTH-02 | **Non terminé** : seules la suppression des routes publiques et la forme publique des réponses (DTO) sont faites ; permissions et tests propriétaire / autre utilisateur / administrateur reportés | Ils supposent l'authentification (AUTH-07) et les rôles (AUTH-08), placés après AUTH-02 dans le backlog | AUTH-02 après AUTH-07 et AUTH-08 |
| `src/services/user.service.ts` | Conservé sans `create`, mais exposé par aucune route | Règles métier (modification, conflit d'email, suppression) réutilisables par AUTH-08 et AUTH-09 | AUTH-02, AUTH-09 |
| `user.controller.ts`, `user.routes.ts`, `user.schema.ts` | Supprimés | Couche HTTP des routes retirées ; elle sera reconstruite avec les permissions | AUTH-02, AUTH-09 |
| DTO public | `src/controllers/user.dto.ts` : liste blanche `id`, `name`, `email`, `role` ; le type `User` ne contient jamais le hash et le repository ne lit jamais `password_hash` | Critère « le DTO public n'expose aucun secret » | AUTH-06 ajoutera une lecture dédiée du hash |
| Hachage avant l'écriture | Le hash est calculé même si l'email est déjà pris | La durée de la réponse ne révèle pas l'existence d'un compte | — |
| Réponse 409 | Elle révèle qu'un email est déjà inscrit | Exigée par le backlog (AUTH-04) | QUAL-02 (limitation de débit dédiée) |
| Logs | `passwordHash` ajouté aux clés masquées | Défense en profondeur ; aucun corps de requête n'est journalisé | — |
| Postman | Aucune requête ajoutée | Collections prévues par DOC-01 | DOC-01 |

### Fichiers créés ou modifiés

| Fichier | Rôle |
|---|---|
| `prisma/schema.prisma`, `prisma/migrations/20261123125545_auth_user_fields/` | Colonnes `password_hash`, `role` et énumération `user_role` |
| `src/config/auth.ts`, `src/services/password-hasher.ts` | Règles du mot de passe et de l'email, hachage Argon2id |
| `src/schemas/auth.schema.ts`, `src/services/auth.service.ts`, `src/controllers/auth.controller.ts`, `src/controllers/user.dto.ts`, `src/routes/auth.routes.ts` | Inscription |
| `src/types/user.ts`, `src/repositories/user.repository.ts`, `src/services/user.service.ts` | Rôle, données d'un nouveau compte, hash jamais relu |
| `src/routes/index.ts`, `src/app.ts`, `server.ts`, `src/config/logger.ts` | Montage de `/auth`, retrait de `/users`, assemblage, masquage |
| `src/controllers/user.controller.ts`, `src/routes/user.routes.ts`, `src/schemas/user.schema.ts` | Supprimés |
| `package.json`, `package-lock.json` | Dépendance `argon2` |

### Tests : 316 sans base (`npm test`), 66 avec base (`npm run test:db`)

- Sans base :
  - Argon2id réel : format et paramètres du hash, sel aléatoire, vérification réussie et échouée, mot de passe Unicode de 128 caractères ;
  - service d'inscription : email en minuscules, rôle `PLAYER`, hash vérifiable jamais égal au mot de passe, 409 (y compris avec une autre casse) sans création, hachage même en cas de conflit, erreurs propagées ;
  - API : 201 avec le DTO exact, aucune trace du mot de passe, du hash ni d'un jeton ; 400 (corps vide, email invalide ou trop long, mot de passe de 14 caractères, de 14 emojis ou de 129 caractères, champs `role`, `passwordHash`, `id`, `passwordConfirmation` refusés) ; 409 ; routes `/api/v1/users` en 404 ;
  - tests existants adaptés : contrat du repository (rôle, hash jamais renvoyé), service utilisateur sans `create`, protections HTTP, limitation du débit et erreurs passant par `/auth/register` ;
  - `tests/integration/users.test.ts` supprimé avec les routes.
- Avec base :
  - contrat du repository sur Prisma ;
  - hash enregistré et rôle par défaut ;
  - `password_hash` obligatoire (23502) et rôle hors énumération refusé (22P02) ;
  - `tests/database/auth-api.test.ts` remplace `users-api.test.ts`. Il utilise Argon2id réel et PostgreSQL, et vérifie le hash en base, deux hashs différents pour un même mot de passe, et la persistance avec une seconde instance indépendante (409 après redémarrage).
- Vérifié aussi :
  - tests en ordre aléatoire (deux passages) ;
  - `npm run test:db` deux fois ;
  - schéma et base migrée sans écart ;
  - build OK ;
  - aucune référence à Prisma ni à `argon2` dans les services (hors `password-hasher.ts`), les controllers ou les routes.
- Vérification manuelle du serveur compilé (`node dist/server.cjs`, port 3999, base `mmorpg_test`) : `/health` 200 ; inscription 201 avec `{ id, name, email, role }` ; 409 pour le même email dans une autre casse ; 400 pour un mot de passe trop court ; `/api/v1/users` 404 ; hash `$argon2id$v=19$m=19456,t=2,p=1$` en base ; aucun mot de passe ni hash dans les logs.

## Décisions de fonctionnement

- Le serveur de développement ne surveille pas le `.env` : après une modification, il faut le redémarrer manuellement.

## Tickets additionnels proposés (non démarrés)

- **FND-09 — Gérer les erreurs de démarrage du serveur** (P1, dépendances : FND-01, FND-02). Gestion de l'événement `error` de `listen` (port occupé, accès refusé), message explicite et arrêt avec code 1. Hors périmètre : logger (FND-05), erreurs de base (DB-01), arrêt propre (QUAL-06). Modifie uniquement `server.ts`.
  - **Réalisé** : voir « Tickets additionnels réalisés » et « Erreurs de démarrage (FND-09) ». La définition ci-dessus est conservée telle qu'elle avait été proposée ; ses écarts sont consignés dans le tableau des adaptations.
- **Correction des bugs HTTP identifiés à l'audit** : sans objet. Les bugs ont été corrigés par FND-03 (JSON invalide, route inconnue) et FND-04 (PATCH, identifiant non numérique). Les tests de non-régression ont été ajoutés dans FND-06 (voir « Tests automatisés (FND-06) »).