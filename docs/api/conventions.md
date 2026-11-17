# Conventions de l'API (SET-05)

> **Statut :** adoptées le 2026-11-17. Elles s'appliquent à tout nouvel endpoint.
> Elles ne sont **pas encore appliquées** au code existant : voir la section 15.
> Les chemins, champs et codes d'erreur cités en exemple illustrent les règles ; les endpoints correspondants
> n'existent pas tant que leur ticket n'est pas réalisé.

## 1. Versionnement et routes

- **Toutes les routes métier sont sous `/api/v1`**, sans exception : authentification, utilisateurs, personnages, classes, monde, combats, inventaire, quêtes, économie.
- Les **routes techniques** restent hors préfixe : `GET /health` (FND-07).
- La version majeure change uniquement pour un changement cassant (section 13).
- URL de base en développement : `http://localhost:4001/api/v1` (port par défaut, configurable avec `PORT`).

## 2. Requêtes

- **Format :**
  - un corps de requête est du JSON en UTF-8, envoyé avec l'en-tête `Content-Type: application/json` ;
  - un corps envoyé dans un autre format donne **415** `UNSUPPORTED_MEDIA_TYPE` ;
  - un corps dépassant la taille maximale (fixée par FND-08) donne **413** `PAYLOAD_TOO_LARGE` ;
  - un JSON illisible donne **400** `INVALID_JSON`.
- **Validation :**
  - les paramètres de chemin (`params`), de requête (`query`) et le corps (`body`) sont validés avant tout traitement métier (FND-04) ;
  - un **champ inconnu** dans le corps ou un **paramètre de requête inconnu** donne **400** `VALIDATION_ERROR`.
- **Valeurs calculées :** le serveur ne reçoit jamais de valeurs calculées (dégâts, XP, monnaie, statistiques, niveau). Ces champs ne figurent pas dans les schémas d'entrée : ils sont donc rejetés comme inconnus.

## 3. Réponses de succès

### 3.1 Enveloppe

| Champ | Type | Présence | Rôle |
|---|---|---|---|
| `success` | booléen | toujours, `true` | Indique un succès |
| `message` | chaîne | toujours | Message informatif en anglais. Le client ne l'affiche pas tel quel et ne l'interprète pas |
| `data` | objet ou tableau | toujours | Contenu de la réponse |
| `meta` | objet | seulement si l'endpoint le déclare | Métadonnées, par exemple la pagination. Stable pour un endpoint donné |

- Une réponse de succès ne contient jamais de champ `error`.
- Les réponses sont envoyées avec `Content-Type: application/json; charset=utf-8`.

### 3.2 Exemples

Lecture (200), `GET /api/v1/characters/:characterId` :

```json
{
  "success": true,
  "message": "Character retrieved successfully",
  "data": {
    "id": "0193a5f2-7c1e-7b3a-9d2f-4e8b1c6a2f10",
    "name": "Arthas",
    "classId": "0193a5f1-1b2c-7d4e-8f90-a1b2c3d4e5f6",
    "level": 12,
    "currentZoneId": null,
    "isAlive": true,
    "createdAt": "2026-11-17T11:43:00.000Z"
  }
}
```

*Les champs réels d'un personnage seront définis par CHAR-02.*

Création (201), `POST /api/v1/characters` : même forme, avec la ressource créée dans `data`.

```json
{
  "success": true,
  "message": "Character created successfully",
  "data": {
    "id": "0193a5f2-7c1e-7b3a-9d2f-4e8b1c6a2f10",
    "name": "Arthas",
    "classId": "0193a5f1-1b2c-7d4e-8f90-a1b2c3d4e5f6",
    "level": 1,
    "currentZoneId": null,
    "isAlive": true,
    "createdAt": "2026-11-17T11:43:00.000Z"
  }
}
```

Liste paginée (200), `GET /api/v1/zones?page=2&pageSize=20` :

```json
{
  "success": true,
  "message": "Zones retrieved successfully",
  "data": [
    { "id": "0193a5f3-0a1b-7c2d-8e3f-405162738495", "name": "Forêt d'Elwynn", "recommendedLevel": 5 }
  ],
  "meta": {
    "pagination": { "page": 2, "pageSize": 20, "totalItems": 21, "totalPages": 2 }
  }
}
```

Liste vide (200, jamais 404) :

```json
{
  "success": true,
  "message": "Characters retrieved successfully",
  "data": []
}
```

### 3.3 Exception : 204 sans corps

Un succès sans contenu à renvoyer, comme une suppression, répond **204 sans corps**, donc sans enveloppe. C'est la seule exception à l'enveloppe.

## 4. Réponses d'erreur

### 4.1 Enveloppe

| Champ | Type | Présence | Rôle |
|---|---|---|---|
| `success` | booléen | toujours, `false` | Indique un échec |
| `message` | chaîne | toujours | Message informatif en anglais. Peut évoluer, le client ne s'en sert pas dans sa logique |
| `error.code` | chaîne | toujours | Code stable en `UPPER_SNAKE_CASE` : **c'est le contrat avec le client** |
| `error.details` | tableau | toujours | Liste `{ field, message }` pour les erreurs de validation. Tableau vide sinon |

- Une réponse d'erreur ne contient jamais de champ `data`.
- `field` désigne le chemin du champ en notation pointée : `name`, `items.0.quantity`, `pageSize`.

### 4.2 Exemples

Validation (400), `POST /api/v1/characters` avec `{ "name": "Arthas", "level": 50 }` :

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "classId", "message": "Required" },
      { "field": "level", "message": "Unknown field" }
    ]
  }
}
```

Paramètres de requête invalides (400), `GET /api/v1/zones?pageSize=500&foo=1` :

```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "pageSize", "message": "Must be less than or equal to 100" },
      { "field": "foo", "message": "Unknown query parameter" }
    ]
  }
}
```

JSON illisible (400) :

```json
{
  "success": false,
  "message": "Malformed JSON body",
  "error": { "code": "INVALID_JSON", "details": [] }
}
```

Ressource de l'URL introuvable ou appartenant à un autre joueur (404). La réponse est **identique** dans les deux cas :

```json
{
  "success": false,
  "message": "Character not found",
  "error": { "code": "CHARACTER_NOT_FOUND", "details": [] }
}
```

Route inconnue (404) :

```json
{
  "success": false,
  "message": "Route not found",
  "error": { "code": "ROUTE_NOT_FOUND", "details": [] }
}
```

Limite de capacité atteinte (409), `POST /api/v1/characters` :

```json
{
  "success": false,
  "message": "Character limit reached",
  "error": { "code": "CHARACTER_LIMIT_REACHED", "details": [] }
}
```

Ressource référencée dans le corps introuvable ou inaccessible (422), `POST /api/v1/characters` avec un `classId` inconnu :

```json
{
  "success": false,
  "message": "Class not found",
  "error": { "code": "CLASS_NOT_FOUND", "details": [] }
}
```

Erreur inattendue (500) :

```json
{
  "success": false,
  "message": "Internal server error",
  "error": { "code": "INTERNAL_ERROR", "details": [] }
}
```

## 5. Codes HTTP

| Statut | Usage |
|---|---|
| 200 | Lecture, modification ou action réussie |
| 201 | Création réussie ; la ressource créée est dans `data` |
| 204 | Succès sans contenu (exception à l'enveloppe) |
| 400 | Requête invalide **quel que soit l'état du serveur** : JSON illisible, champ manquant, champ ou paramètre inconnu, mauvais type, identifiant au mauvais format, paramètre de pagination hors bornes |
| 401 | Authentification absente, invalide ou expirée |
| 403 | Refus lié au **rôle** (route réservée aux administrateurs, par exemple) |
| 404 | Ressource **désignée dans l'URL** inexistante ou privée d'un autre joueur ; route inconnue |
| 409 | Conflit avec l'état des ressources : voir 5.1 |
| 413 | Corps de requête trop volumineux |
| 415 | Corps envoyé dans un format non accepté |
| 422 | Requête valide refusée par une condition de jeu, ou ressource du corps introuvable : voir 5.2 |
| 429 | Trop de requêtes |
| 500 | Erreur inattendue, sans détail interne |

### 5.1 Quand utiliser 409

- **Unicité :** email déjà utilisé, nom de personnage indisponible.
- **Limite de capacité atteinte :** nombre maximal de personnages, inventaire plein, etc.
- **Ressource déjà engagée ou réservée :** monstre déjà en combat.
- **Action déjà effectuée :** compétence déjà apprise, par exemple. C'est le comportement par défaut, sauf si le ticket prévoit explicitement un comportement idempotent.

### 5.2 Quand utiliser 422

- **Condition liée à l'acteur ou aux règles du jeu non remplie :** mana insuffisant, temps de recharge actif, niveau insuffisant, personnage mort, pas son tour, combat terminé, zone inaccessible.
- **Ressource référencée dans le corps introuvable ou inaccessible :** `classId` inconnu, `characterId` d'un autre joueur dans `POST /api/v1/combats`.

### 5.3 Ressource inexistante ou inaccessible

Une ressource à laquelle l'utilisateur n'a pas accès est traitée **exactement comme une ressource inexistante**, avec le même statut, le même code et le même message. Le statut dépend uniquement de l'emplacement de la référence :

| Emplacement | Statut |
|---|---|
| Dans l'URL | 404 |
| Dans le corps | 422 |

## 6. Codes d'erreur

### 6.1 Codes génériques

| Code | Statut | Usage |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Données invalides (détails dans `error.details`) |
| `INVALID_JSON` | 400 | Corps JSON illisible |
| `UNAUTHENTICATED` | 401 | Authentification absente ou invalide (précisée par AUTH-06 et AUTH-07) |
| `FORBIDDEN` | 403 | Rôle insuffisant |
| `NOT_FOUND` | 404 | Ressource introuvable, quand aucun code dédié n'existe |
| `ROUTE_NOT_FOUND` | 404 | Route inconnue |
| `CONFLICT` | 409 | Conflit, quand aucun code dédié n'existe |
| `PAYLOAD_TOO_LARGE` | 413 | Corps trop volumineux |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Format du corps non accepté |
| `RATE_LIMITED` | 429 | Trop de requêtes |
| `INTERNAL_ERROR` | 500 | Erreur inattendue |

### 6.2 Codes métier

- Chaque ticket ajoute ses codes et les documente. Exemples : `EMAIL_ALREADY_USED`, `CHARACTER_NOT_FOUND`, `CHARACTER_LIMIT_REACHED`, `CLASS_NOT_FOUND`, `INSUFFICIENT_MANA`, `SKILL_ON_COOLDOWN`, `NOT_YOUR_TURN`, `CHARACTER_DEAD`, `COMBAT_FINISHED`, `MONSTER_ALREADY_ENGAGED`.
- Règles :
  - en anglais et en `UPPER_SNAKE_CASE` ;
  - **stables** : un code ne change jamais de sens ;
  - un code correspond à une seule cause ;
  - un même code pour une ressource inexistante et une ressource inaccessible.

## 7. Identifiants et autorisations

- **Dans l'API**, un identifiant est une **chaîne opaque** : le client la stocke et la renvoie, sans jamais l'interpréter ni la construire.
- **En base**, on utilise un UUID v7 si la base et l'ORM retenus le permettent, sinon un UUID v4. Choix final en SET-04.
- Le serveur valide le **format** des identifiants reçus : un format invalide donne 400.
- **Un UUID ne remplace jamais un contrôle d'autorisation.** Le fait qu'un identifiant soit impossible à deviner n'est pas une protection : chaque accès vérifie, côté serveur, l'authentification, la propriété de la ressource et les permissions.

## 8. Nommage

| Élément | Convention | Exemple |
|---|---|---|
| Champs JSON | camelCase | `currentZoneId`, `createdAt` |
| Paramètres de requête | camelCase | `pageSize`, `sort` |
| Valeurs d'énumération | `UPPER_SNAKE_CASE` | `IN_PROGRESS`, `LEGENDARY`, `ATTACK` |
| Booléens | préfixe `is` ou `has` | `isAlive`, `hasCompleted` |
| Segments d'URL | pluriel, kebab-case | `/characters`, `/loot-tables` |
| Paramètres de chemin | nom explicite en camelCase | `:characterId`, `:combatId` |
| Actions hors CRUD | sous-ressource appelée en `POST` | `POST /api/v1/characters/:characterId/move` |

### 8.1 Routes de référence des combats

| Méthode | Chemin | Rôle | Ticket |
|---|---|---|---|
| POST | `/api/v1/combats` | Créer un combat (personnage et cible dans le corps) | COMBAT-02 |
| GET | `/api/v1/combats/:combatId` | Consulter un combat | COMBAT-09 |
| POST | `/api/v1/combats/:combatId/actions` | Envoyer une action | COMBAT-07, 12, 13 |
| GET | `/api/v1/combats/:combatId/actions` | Historique des actions, paginé | COMBAT-11 |

Toutes les actions passent par le même endpoint ; le type d'action est donné par le champ `type` :

```json
{ "type": "ATTACK", "targetId": "0193a5f4-2b3c-7d4e-9f50-617283940a1b" }
```

```json
{ "type": "SKILL", "skillId": "0193a5f5-3c4d-7e5f-8a61-728394051b2c", "targetId": "0193a5f4-2b3c-7d4e-9f50-617283940a1b" }
```

*Les champs exacts de chaque type d'action seront définis par les tickets COMBAT.*

## 9. Pagination, tri et filtres

| Paramètre | Défaut | Bornes | Hors bornes |
|---|---|---|---|
| `page` | 1 | entier ≥ 1 | 400 |
| `pageSize` | 20 | entier de 1 à 100 | 400, **sans correction automatique** |

- **Réponse :** `meta.pagination = { page, pageSize, totalItems, totalPages }`.
- **Tri :** `?sort=champ` (croissant) ou `?sort=-champ` (décroissant), uniquement sur les champs autorisés par l'endpoint. Un champ non autorisé donne 400.
- **Filtres :** des paramètres nommés, autorisés explicitement par chaque endpoint. Une valeur invalide donne 400.
- **Listes :** une liste est toujours un tableau dans `data`. Une liste vide renvoie 200 avec `[]`.
- **Pagination par curseur :** réservée à des besoins futurs spécifiques (par exemple l'historique de combat ou les transactions), à décider dans le ticket concerné.

## 10. Dates et durées

- **Dates :** ISO 8601 en UTC avec le suffixe `Z`, par exemple `2026-11-17T11:43:00.000Z`. Les champs sont suffixés par `At` (`createdAt`, `updatedAt`). Le client convertit dans le fuseau du joueur.
- **Durées :** entiers en **millisecondes**, avec l'unité dans le nom du champ (`cooldownMs`, `respawnDelayMs`).
- **Temporisations :** exprimées par leur instant de fin (`cooldownEndsAt`) plutôt que par un temps restant. Cet instant sert à l'affichage ; le serveur reste seul juge de la disponibilité.

```json
{ "skillId": "0193a5f5-3c4d-7e5f-8a61-728394051b2c", "cooldownMs": 8000, "cooldownEndsAt": "2026-11-17T11:43:08.000Z" }
```

## 11. Champs des réponses et tolérance du client

- Les champs prévus dans une réponse sont **toujours présents** ; leur valeur est `null` quand il n'y a pas de valeur.
- Le serveur est **strict en entrée** : un champ ou un paramètre inconnu est rejeté en 400 (section 2).
- Le client doit être **tolérant en lecture** : il ignore les champs qu'il ne connaît pas et gère les valeurs d'énumération inconnues.

## 12. Sécurité des réponses

- Une réponse ne contient jamais :
  - de mot de passe ni de hash ;
  - de token autre que celui délivré volontairement ;
  - de secret, de variable d'environnement ;
  - de trace d'erreur, de requête SQL ou de détail interne.
- Une erreur 500 renvoie toujours le message générique `Internal server error`.
- Les objets internes de la base ne sont jamais renvoyés tels quels : chaque réponse passe par une forme publique explicite (DTO).

## 13. Évolution et dépréciation

**Changements additifs**, autorisés dans v1 :
- nouvel endpoint ;
- nouveau champ de sortie ;
- nouveau champ d'entrée **facultatif** ;
- nouveau code d'erreur ;
- nouvelle valeur d'énumération (le client y est tolérant).

**Changements cassants**, qui imposent une nouvelle version majeure :
- supprimer ou renommer un champ de sortie ou un endpoint ;
- changer le type, le format ou le sens d'un champ ;
- rendre obligatoire un champ d'entrée ;
- **supprimer un champ d'entrée** (il serait alors rejeté comme inconnu) ;
- changer le statut HTTP ou le code d'erreur d'un cas existant.

**Règles d'application :**
- **Période de développement :** tant qu'aucun client n'utilise l'API, les changements cassants restent admis dans v1, à condition d'être documentés dans `docs/architecture/backlog-adaptations.md` ou dans l'historique de ce document.
- **Dépréciation :** lorsqu'un endpoint est réellement déprécié, il est signalé dans la documentation et par les en-têtes HTTP `Deprecation` et `Sunset`, puis maintenu pendant une période définie à ce moment-là.

## 14. Liste de contrôle pour un nouvel endpoint

- [ ] Chemin sous `/api/v1`, au pluriel, en kebab-case, avec des paramètres nommés explicitement.
- [ ] Schémas de validation pour `params`, `query` et `body`, stricts (champs inconnus rejetés).
- [ ] Réponse de succès dans l'enveloppe, ou 204 sans corps.
- [ ] Champs en camelCase, booléens en `is`/`has`, énumérations en `UPPER_SNAKE_CASE`, dates en ISO UTC, durées en `…Ms`.
- [ ] Statuts conformes à la section 5 ; codes d'erreur documentés.
- [ ] Ressource inaccessible traitée comme inexistante.
- [ ] Autorisation vérifiée côté serveur, indépendamment de la forme des identifiants.
- [ ] Pagination conforme pour les listes de taille non bornée.
- [ ] Aucune donnée sensible dans la réponse.

## 15. Mise en conformité de l'existant

| Non-conformité actuelle | Ticket prévu |
|---|---|
| Erreurs au format `{ "error": "..." }`, route inconnue en HTML | FND-03 |
| Validation des paramètres et du corps | FND-04 |
| Routes sans préfixe `/api/v1`, réponses sans enveloppe, route `GET /` | FND-07 |
| Identifiants numériques, accès sans autorisation | DB-04, AUTH-02 |

## 16. Historique

| Date | Changement |
|---|---|
| 2026-11-17 | Adoption des conventions (SET-05) |