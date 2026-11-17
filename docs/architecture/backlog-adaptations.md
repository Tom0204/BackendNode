# Adaptations par rapport au backlog initial

Dernière mise à jour : 2026-11-17

Le backlog de référence (`Backlog_API_Mmorpg.md`) est conservé dans le projet Claude « API jeux vidéo ». Ce fichier recense les écarts décidés par rapport à lui, avec leur raison.

## État d'avancement

| Ticket | Statut | Commit |
|---|---|---|
| Nettoyage Git (additionnel) | Validé | `29c5611` |
| Configuration TypeScript (additionnel) | Validé | `4450c2d` |
| FND-01 | Validé (points du travail réaffectés, voir plus bas) | `4450c2d` |
| FND-02 | Validé | `818a426` |
| SET-01 | Livré avec SET-05, en attente de validation | — |
| SET-05 | Livré, en attente de validation | — |

## Ordre de réalisation

L'ordre de la phase A du backlog (`SET-01 → SET-05 → FND-01 à FND-08`) a été adapté :

1. FND-01 et FND-02 ont été réalisés avant SET-02, SET-03, SET-04 et SET-05, car ils ne dépendent que de SET-01.
2. Ordre retenu ensuite : SET-05 (avec la clôture de SET-01) → FND-03 → FND-04 → FND-06 → correction des bugs HTTP → FND-07 → FND-09, FND-05, FND-08.
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

## Décisions de fonctionnement

- Le serveur de développement ne surveille pas le `.env` : après une modification, il faut le redémarrer manuellement.

## Tickets additionnels proposés (non démarrés)

- **FND-09 — Gérer les erreurs de démarrage du serveur** (P1, dépendances : FND-01, FND-02). Gestion de l'événement `error` de `listen` (port occupé, accès refusé), message explicite et arrêt avec code 1. Hors périmètre : logger (FND-05), erreurs de base (DB-01), arrêt propre (QUAL-06). Modifie uniquement `server.ts`.
- **Correction des bugs HTTP identifiés à l'audit** : prévue après FND-06, pour être couverte par des tests.
  - Restent à traiter : PATCH `/users/:id` avec un `name` valide refusé en 400, identifiant non numérique renvoyant 404.
  - Le JSON invalide renvoyant 500 et la route inconnue renvoyant une page HTML relèvent de FND-03.