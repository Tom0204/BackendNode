# Conventions de l'API (SET-05)

> **Statut :** adoptées le 2026-11-17. Elles s'appliquent à tout nouvel endpoint.
> Depuis FND-07, elles s'appliquent aussi aux routes existantes, sauf pour les points encore ouverts de la section 15.
> Les chemins, champs et codes d'erreur cités en exemple illustrent les règles ; les endpoints correspondants
> n'existent pas tant que leur ticket n'est pas réalisé.

## 1. Versionnement et routes

- **Toutes les routes métier sont sous `/api/v1`**, sans exception : authentification, utilisateurs, personnages, classes, monde, combats, inventaire, quêtes, économie.
- Les **routes techniques** restent hors préfixe : `GET /health` (FND-07).
- La version majeure change uniquement pour un changement cassant (section 13).
- URL de base en développement : `http://localhost:4001/api/v1` (port par défaut, configurable avec `PORT`).
- Dans le code, le préfixe est défini une seule fois : constante `API_V1_PREFIX`, exportée par `src/routes/index.ts`.

### 1.1 Route de santé : `GET /health`

| Élément | Règle |
|---|---|
| Chemin | `GET /health`, **hors** du préfixe `/api/v1` ; `HEAD /health` est aussi accepté |
| Réponse | 200, enveloppe de succès minimale (exemple ci-dessous) |
| Contenu | Statut uniquement : ni version, ni environnement, ni information système |
| Cache | En-tête `Cache-Control: no-store` |
| Validation | Aucune : les paramètres de requête sont ignorés (exception à la section 2) |
| Limitation du débit | Aucune : `/health` n'est pas soumis au quota de `/api/v1` (section 2.2) |

```json
{
  "success": true,
  "message": "Service is healthy",
  "data": { "status": "OK" }
}
```

### 1.2 Migration vers `/api/v1` (FND-07)

| Avant FND-07 | Depuis FND-07 |
|---|---|
| `GET`, `POST /users` ; `GET`, `PUT`, `PATCH`, `DELETE /users/:id` | Mêmes méthodes sous `/api/v1/users` et `/api/v1/users/:id` |
| Réponses de succès brutes (utilisateur ou tableau) | Enveloppe de succès (section 3), mêmes données dans `data` ; suppression toujours en 204 sans corps |
| `GET /` → `{ "message": "Server is working" }` | Supprimée ; `GET /health` la remplace |
| Anciens chemins | Supprimés, sans redirection : 404 `ROUTE_NOT_FOUND` |

Ce changement cassant est admis par la section 13 (aucun client ne consomme encore l'API).

### 1.3 Persistance des utilisateurs (DB-04)

| Avant DB-04 | Depuis DB-04 |
|---|---|
| Utilisateurs en mémoire, perdus au redémarrage, deux utilisateurs initiaux | Utilisateurs enregistrés dans PostgreSQL ; aucun utilisateur initial |
| Identifiant numérique (`/api/v1/users/1`) | Identifiant UUID (`/api/v1/users/0193a5f4-2b3c-7d4e-9f50-617283940a1b`) ; un autre format donne 400 `VALIDATION_ERROR` (`Must be a valid UUID`) |
| Email enregistré tel que reçu | Email enregistré et renvoyé en **minuscules** ; deux emails qui ne diffèrent que par la casse sont en conflit (409 `EMAIL_ALREADY_USED`) |
| Liste dans l'ordre d'insertion | Liste triée par date de création, puis par identifiant (ordre stable) |

Les champs renvoyés restent `id`, `name` et `email`. Ce changement cassant est admis par la section 13 (aucun client ne consomme encore l'API).

> Depuis AUTH-04, ces routes `/api/v1/users` sont retirées : voir section 1.4.

### 1.4 Inscription et retrait des routes `/users` (AUTH-01, AUTH-03, AUTH-04)

`POST /api/v1/auth/register` est la seule route publique de gestion des comptes. Les six routes `/api/v1/users` (liste, lecture, création, remplacement, modification, suppression) sont supprimées et renvoient 404 `ROUTE_NOT_FOUND` : elles seront réintroduites avec leurs permissions (AUTH-02 après AUTH-07 et AUTH-08, AUTH-09 pour `/users/me`).

| Champ du corps | Règle |
|---|---|
| `name` | Obligatoire, au moins un caractère non blanc |
| `email` | Obligatoire, format email valide (`Must be a valid email`), 254 caractères au plus ; enregistré en minuscules |
| `password` | Obligatoire, 15 à 128 caractères Unicode (`Must be at least 15 characters`, `Must be at most 128 characters`), sans règle de composition ; ni rogné ni normalisé ; hashé en Argon2id, jamais renvoyé ni journalisé |
| Tout autre champ (`role`, `passwordHash`, `passwordConfirmation`…) | Refusé : 400 `Unknown field` |

```http
POST /api/v1/auth/register HTTP/1.1
Content-Type: application/json

{ "name": "Alice", "email": "Alice@Example.com", "password": "correct horse battery staple" }
```

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": "0193a5f4-2b3c-7d4e-9f50-617283940a1b",
    "name": "Alice",
    "email": "alice@example.com",
    "role": "PLAYER"
  }
}
```

| Cas | Statut |
|---|---|
| Compte créé | 201, sans jeton (la connexion relève d'AUTH-05 et AUTH-06) |
| Corps invalide (champ manquant ou inconnu, email invalide, mot de passe trop court ou trop long) | 400 `VALIDATION_ERROR` |
| Email déjà utilisé, quelle que soit la casse | 409 `EMAIL_ALREADY_USED` |

La forme publique d'un compte est `{ id, name, email, role }` : ni mot de passe, ni hash, ni dates. Le seul rôle existant est `PLAYER` ; les autres rôles sont décidés en AUTH-08. Ce changement cassant (suppression des routes `/users`) est admis par la section 13.

> Depuis le lot L2 (AUTH-02, AUTH-05 à AUTH-10), les routes `/api/v1/users` sont réintroduites avec leurs permissions : voir section 1.5.

### 1.5 Authentification, permissions et comptes (AUTH-02, AUTH-05 à AUTH-10)

**Stratégie (AUTH-05).** Sessions opaques stockées en PostgreSQL :
- la connexion renvoie un jeton aléatoire de 256 bits (43 caractères base64url) qui ne contient aucune donnée ;
- le serveur n'en garde que l'empreinte SHA-256 ;
- durée de vie **absolue** de 24 heures (`SESSION_TTL_HOURS`, de 1 à 720), sans prolongation ni jeton de renouvellement : une nouvelle connexion est nécessaire ensuite ;
- la déconnexion révoque réellement la session. Désactiver ou supprimer un compte invalide immédiatement toutes ses sessions.

**Transport.** Le jeton est envoyé dans l'en-tête `Authorization: Bearer <jeton>`, jamais dans l'URL, un paramètre de requête, le corps ou un cookie. Aucun cookie n'est utilisé : CORS reste sans `credentials`.

| Route | Accès | Succès | Refus |
|---|---|---|---|
| `POST /api/v1/auth/register` | Public | 201 (section 1.4) | 400, 409 |
| `POST /api/v1/auth/login` | Public, 10 requêtes par 15 minutes et par adresse IP | 200 avec le jeton | 400 ; 401 `INVALID_CREDENTIALS` ; 403 `ACCOUNT_DISABLED` ; 429 |
| `POST /api/v1/auth/logout` | Authentifié | 204 : révoque la session utilisée, et elle seule | 401 |
| `GET /api/v1/users` | Administrateur | 200, liste paginée (section 9) | 401 ; 403 `FORBIDDEN` ; 400 |
| `GET /api/v1/users/me`, `PATCH /api/v1/users/me` | Authentifié : son propre compte | 200 | 401 ; 400 ; 409 |
| `GET`, `PATCH`, `DELETE /api/v1/users/:id` | Propriétaire ou administrateur | 200 ; 204 pour la suppression | 401 ; 400 ; **404 `USER_NOT_FOUND`** pour le compte d'un autre joueur (section 5.3) ; 409 |

```http
POST /api/v1/auth/login HTTP/1.1
Content-Type: application/json

{ "email": "alice@example.com", "password": "correct horse battery staple" }
```

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "accessToken": "q4V0Y6mZ2c3l8u1Jb9wGfKpT7rXsEoNaHdLiQyCvBkM",
    "tokenType": "Bearer",
    "expiresAt": "2026-11-25T09:00:00.000Z",
    "user": { "id": "0193a5f4-2b3c-7d4e-9f50-617283940a1b", "name": "Alice", "email": "alice@example.com", "role": "PLAYER" }
  }
}
```

**Règles :**
- **Connexion.** L'email est mis en minuscules. Le mot de passe n'est pas soumis à la longueur minimale de l'inscription, mais 128 caractères au plus.
  - Email inconnu ou mauvais mot de passe : même réponse 401 `INVALID_CREDENTIALS` (« Invalid email or password »), avec une vérification Argon2id dans les deux cas pour une durée de réponse comparable.
  - Compte désactivé : 403 `ACCOUNT_DISABLED`, seulement si le mot de passe est correct.
  - La réponse porte `Cache-Control: no-store`.
- **Routes protégées.** Jeton absent, mal formé, inconnu, expiré, révoqué, ou compte désactivé : 401 `UNAUTHENTICATED` (« Authentication required »), sans distinction, avec l'en-tête `WWW-Authenticate: Bearer realm="api"`. L'authentification est vérifiée avant la validation : sans jeton valide, la réponse est 401 quel que soit le corps.
- **Rôles.** `PLAYER` (par défaut) et `ADMIN`. Le rôle et le statut ne sont modifiables par aucune route : seul le script local `npm run account` les change (section 7). Le rôle est relu à chaque requête : une promotion ou une désactivation prend effet immédiatement.
- **Modification d'un compte.** `name` et `email` seulement ; `role`, `status`, `id`, `password` et tout autre champ sont refusés en 400. **Limite connue :** le mot de passe actuel n'est pas demandé pour changer l'email ; le changement de mot de passe n'existe pas encore.
- **Suppression d'un compte.** Par son propriétaire ou par un administrateur. Un joueur qui vise un autre compte reçoit 404, sans aucun effacement. La suppression est une seule instruction : les personnages et les sessions sont supprimés avec le compte (cascade).
- **Routes absentes.** `POST /api/v1/users` (remplacée par l'inscription) et `PUT /api/v1/users/:id` n'existent pas. Toutes les routes `/users` exigent d'abord un jeton : sans jeton, 401 ; avec un jeton, 404 `ROUTE_NOT_FOUND`.

### 1.6 Classes et personnages (CHAR-01 à CHAR-05)

| Route | Accès | Succès | Refus |
|---|---|---|---|
| `GET /api/v1/classes` | Public | 200 : les trois classes, dans l'ordre du seed | 400 (paramètre inconnu) |
| `GET /api/v1/classes/:classId` | Public | 200 | 400 (identifiant non UUID) ; 404 `CLASS_NOT_FOUND` |
| `POST /api/v1/characters` | Authentifié | 201 | 401 ; 400 ; 422 `CLASS_NOT_FOUND` ; 409 `CHARACTER_LIMIT_REACHED` ; 409 `CHARACTER_NAME_TAKEN` |
| `GET /api/v1/characters` | Authentifié : ses personnages | 200, tableau (vide s'il n'en a aucun), sans pagination | 401 ; 400 |
| `GET /api/v1/characters/:characterId` | Authentifié : son personnage | 200 | 401 ; 400 ; **404 `CHARACTER_NOT_FOUND`** (inexistant ou d'un autre joueur, administrateur compris) |

Forme d'une classe :

```json
{
  "id": "0193a5f1-1b2c-7d4e-8f90-a1b2c3d4e5f6",
  "code": "warrior",
  "name": "Guerrier",
  "baseStats": { "hp": 120, "mana": 20, "attack": 12, "defense": 8, "speed": 8 },
  "statsPerLevel": { "hp": 12, "mana": 2, "attack": 2, "defense": 2, "speed": 1 }
}
```

La forme d'un personnage, identique en liste et en détail, est donnée en section 3.2.

**Règles :**
- **Classes.** Ce sont des données de référence, en lecture seule : aucune route ne les crée ni ne les modifie, administrateur compris. Seul le seed les met à jour.
- **Création.** Le client fournit uniquement `name` et `classId`. Tout autre champ (`level`, `experience`, `currentZoneId`, `userId`, statistiques…) est refusé en 400. Le serveur fixe le niveau 1, l'XP 0 et la zone de départ.
- **Nom.** De 3 à 16 lettres ASCII (`A-Z`, `a-z`), sans accent, espace, chiffre ni autre caractère. Message : « Must be 3 to 16 letters (A-Z, a-z) ». Le nom est conservé tel que saisi, et unique sur le serveur sans tenir compte de la casse.
- **Ordre des contrôles.** Validation (400), puis existence de la classe (422), puis limite de 5 personnages par compte (409 `CHARACTER_LIMIT_REACHED`), puis nom disponible (409 `CHARACTER_NAME_TAKEN`).
- **Créations simultanées.** La limite est appliquée dans une transaction qui verrouille le compte : des créations simultanées ne peuvent pas la dépasser.
- **Propriété.** Le propriétaire est toujours l'utilisateur du jeton. Un personnage n'est visible que par son propriétaire, sans exception pour les administrateurs.
- **Statistiques.** Elles ne figurent pas dans ces réponses : elles seront exposées par `GET /api/v1/characters/:characterId/stats` (STAT-01, STAT-02).
- **Routes absentes.** Renommage et suppression (CHAR-06, CHAR-07) n'existent pas encore : 404 `ROUTE_NOT_FOUND` avec un jeton.

## 2. Requêtes

- **Format :**
  - un corps de requête est du JSON en UTF-8, envoyé avec l'en-tête `Content-Type: application/json` (`application/json; charset=utf-8` est accepté) ;
  - un corps envoyé dans un autre format, ou sans `Content-Type`, donne **415** `UNSUPPORTED_MEDIA_TYPE` (FND-08) ; dans Postman, choisir « raw » puis « JSON » ;
  - une requête **sans corps** n'est pas concernée, quelle que soit sa méthode : pas de `Content-Length`, ou `Content-Length: 0` ;
  - un corps de plus de **10 Ko** donne **413** `PAYLOAD_TOO_LARGE` (FND-08) ;
  - un JSON illisible donne **400** `INVALID_JSON`.
- **Validation :**
  - les paramètres de chemin (`params`), de requête (`query`) et le corps (`body`) sont validés avant tout traitement métier (FND-04) ;
  - un **champ inconnu** dans le corps ou un **paramètre de requête inconnu** donne **400** `VALIDATION_ERROR` ;
  - exception : les routes techniques (`/health`) ne lisent et ne valident aucun paramètre (section 1.1).
- **Valeurs calculées :** le serveur ne reçoit jamais de valeurs calculées (dégâts, XP, monnaie, statistiques, niveau). Ces champs ne figurent pas dans les schémas d'entrée : ils sont donc rejetés comme inconnus.
- **Identifiant de requête :** en-tête facultatif `X-Request-Id` (section 2.1).
- **Protections HTTP :** limitation du débit, CORS et en-têtes de sécurité (section 2.2).

### 2.1 En-tête `X-Request-Id` (FND-05)

Chaque requête reçoit un identifiant, qui permet de retrouver dans les journaux du serveur tout ce qui la concerne (support, diagnostic d'une erreur 500).

| Élément | Règle |
|---|---|
| En requête | **Facultatif.** Le client peut fournir son propre identifiant, par exemple pour suivre une requête de bout en bout |
| Identifiant accepté | 1 à 128 caractères parmi `A-Z`, `a-z`, `0-9`, `.`, `_`, `-` |
| Identifiant absent ou non conforme | **Pas d'erreur** : la valeur reçue est ignorée et le serveur génère un UUID |
| En réponse | **Toujours présent**, sur toutes les réponses : succès, erreurs (y compris 404 et 500) et 204 sans corps. Il contient l'identifiant repris ou généré |
| Corps des réponses | L'identifiant n'y figure **pas** : le format des sections 3 et 4 est inchangé |
| Sécurité | L'identifiant est journalisé : il ne doit **jamais** contenir de donnée sensible. Ce n'est pas un mécanisme d'authentification |

Exemple d'échange :

```text
GET /api/v1/users/0193a5f4-2b3c-7d4e-9f50-617283940a1b HTTP/1.1
X-Request-Id: client-abc-123

HTTP/1.1 404 Not Found
Content-Type: application/json; charset=utf-8
X-Request-Id: client-abc-123
```

Un client qui signale un problème transmet la valeur de `X-Request-Id` de la réponse concernée : elle suffit à retrouver les journaux correspondants.

### 2.2 Protections HTTP (FND-08)

#### Limitation du débit

| Élément | Règle |
|---|---|
| Portée | Toutes les requêtes sous `/api/v1`, y compris les routes inconnues et les requêtes rejetées pour leur corps (400, 413, 415) ; `/health` n'est pas limité |
| Quota global | **300 requêtes par minute et par adresse IP** (fenêtre fixe de 60 secondes) |
| Préflights `OPTIONS` | Traitées par CORS **avant** la limitation : elles ne consomment pas le quota |
| Dépassement | **429** `RATE_LIMITED`, message `Too many requests`, `details` vide, au format d'erreur habituel (section 4) |
| En-têtes, sur chaque réponse de `/api/v1` | `RateLimit-Policy: 300;w=60` et `RateLimit: limit=300, remaining=<restant>, reset=<secondes>` |
| En-tête, en cas de dépassement | `Retry-After: <secondes>` : délai avant de pouvoir réessayer |
| Endpoints sensibles | Un limiteur strict de **10 requêtes par 15 minutes** est prêt ; il sera branché sur la connexion et l'inscription par QUAL-02 |

Le client qui reçoit un 429 attend la durée indiquée par `Retry-After` avant de réessayer ; il ne relance pas la requête immédiatement.

```text
HTTP/1.1 429 Too Many Requests
RateLimit-Policy: 300;w=60
RateLimit: limit=300, remaining=0, reset=42
Retry-After: 42
Content-Type: application/json; charset=utf-8

{"success":false,"message":"Too many requests","error":{"code":"RATE_LIMITED","details":[]}}
```

Limites actuelles : le compteur est en mémoire, propre à chaque processus, et remis à zéro au redémarrage (stockage partagé et réglage par environnement : QUAL-02). Derrière un reverse proxy, l'adresse IP retenue est celle de la connexion tant que `trust proxy` n'est pas configuré (QUAL-06).

#### CORS

CORS ne concerne que les **navigateurs** : une requête sans en-tête `Origin` (Postman, curl, tests, appels entre serveurs) n'est jamais bloquée.

| Configuration | Origines autorisées |
|---|---|
| `CORS_ORIGINS` définie | **Seulement** les origines listées, quel que soit l'environnement |
| `CORS_ORIGINS` non définie, `NODE_ENV=production` | **Aucune** ; un avertissement est journalisé au démarrage |
| `CORS_ORIGINS` non définie, `development` ou `test` | Toutes (`Access-Control-Allow-Origin: *`) |

- **Format de `CORS_ORIGINS` :** origines séparées par des virgules, par exemple `https://jeu.example.com,http://localhost:5173`. Chaque origine s'écrit `http(s)://hôte[:port]`, en minuscules et sans port par défaut. Sont refusés au démarrage : un autre protocole, un chemin, un `/` final, des paramètres, un fragment, des identifiants et le joker `*`. Une valeur vide équivaut à une variable non définie.
- **Origine non autorisée :** la réponse ne contient pas `Access-Control-Allow-Origin` ; le navigateur refuse alors au JavaScript de la lire. Une préflight reçoit quand même un 204, sans autorisation.
- **En-têtes lisibles par le navigateur :** `X-Request-Id`, `Retry-After`, `RateLimit` et `RateLimit-Policy` (`Access-Control-Expose-Headers`).
- **Cookies :** non utilisés (`Access-Control-Allow-Credentials` absent) : l'authentification passe par l'en-tête `Authorization: Bearer` (AUTH-05, section 1.5).

#### En-têtes de sécurité

Toutes les réponses portent les en-têtes par défaut de la bibliothèque `helmet`, notamment `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`, `Strict-Transport-Security` et `Content-Security-Policy`. L'en-tête `X-Powered-By` n'est plus envoyé. Ces en-têtes ne changent ni le corps des réponses ni leur `Content-Type` ; `/health` garde son `Cache-Control: no-store`.

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
    "level": 3,
    "experience": 120,
    "currentZoneId": "0193a5f0-9a8b-7c6d-8e5f-4a3b2c1d0e9f",
    "createdAt": "2026-11-17T11:43:00.000Z"
  }
}
```

Champs d'un personnage (CHAR-02, section 1.6) : `id`, `name`, `classId`, `level` (1 à 10), `experience` (XP acquise dans le niveau courant), `currentZoneId`, `createdAt`. Ni propriétaire, ni nom normalisé, ni statistiques.

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
    "experience": 0,
    "currentZoneId": "0193a5f0-9a8b-7c6d-8e5f-4a3b2c1d0e9f",
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
- Pour une erreur qui porte sur un emplacement entier (un corps qui n'est pas un objet, par exemple), `field` vaut le nom de l'emplacement : `body`, `query` ou `params`.

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

### 6.3 Codes métier en usage

| Code | Statut | Endpoints | Ticket |
|---|---|---|---|
| `USER_NOT_FOUND` | 404 | `GET`, `PATCH`, `DELETE /api/v1/users/:id` (compte inexistant ou d'un autre joueur) | FND-03 (AUTH-02) |
| `EMAIL_ALREADY_USED` | 409 | `POST /api/v1/auth/register`, `PATCH /api/v1/users/:id`, `PATCH /api/v1/users/me` | FND-03 (AUTH-04, AUTH-09) |
| `INVALID_CREDENTIALS` | 401 | `POST /api/v1/auth/login` (email inconnu ou mauvais mot de passe, même réponse) | AUTH-06 |
| `ACCOUNT_DISABLED` | 403 | `POST /api/v1/auth/login` (compte désactivé, mot de passe correct) | AUTH-06 |
| `UNAUTHENTICATED` | 401 | Toute route protégée : jeton absent, invalide, expiré, révoqué ou compte désactivé | AUTH-07 |
| `FORBIDDEN` | 403 | `GET /api/v1/users` pour un joueur | AUTH-08 |
| `CLASS_NOT_FOUND` | 404 / 422 | `GET /api/v1/classes/:classId` (404) ; `POST /api/v1/characters` avec un `classId` inconnu (422) | CHAR-01, CHAR-03 |
| `CHARACTER_LIMIT_REACHED` | 409 | `POST /api/v1/characters` (5 personnages déjà créés) | CHAR-03 |
| `CHARACTER_NAME_TAKEN` | 409 | `POST /api/v1/characters` (nom déjà utilisé, quelle que soit la casse) | CHAR-03 |
| `CHARACTER_NOT_FOUND` | 404 | `GET /api/v1/characters/:characterId` (inexistant ou d'un autre joueur) | CHAR-05 |

## 7. Identifiants et autorisations

- **Dans l'API**, un identifiant est une **chaîne opaque** : le client la stocke et la renvoie, sans jamais l'interpréter ni la construire.
- **En base**, les identifiants sont des UUID v7 générés par PostgreSQL 18 (`uuidv7()`) et stockés dans le type `uuid` natif (voir `docs/architecture/database.md`, SET-04). Un UUID v7 laisse lire son instant de création, à la milliseconde : cette information n'est pas considérée comme confidentielle.
- Le serveur valide le **format** des identifiants reçus : un format invalide donne 400.
- **Un UUID ne remplace jamais un contrôle d'autorisation.** Le fait qu'un identifiant soit impossible à deviner n'est pas une protection : chaque accès vérifie, côté serveur, l'authentification, la propriété de la ressource et les permissions.
- **Routes publiques** (sans jeton) : `GET /health`, `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `GET /api/v1/classes` et `GET /api/v1/classes/:classId` (données de référence sans propriétaire, CHAR-01). **Toutes les autres routes de `/api/v1` sont protégées** (section 1.5) : elles exigent un jeton valide, puis appliquent leurs règles de propriété et de rôle dans les services.
- **Administration locale :** le rôle (`PLAYER`, `ADMIN`) et le statut (`ACTIVE`, `DISABLED`) d'un compte existant se changent uniquement par `npm run account -- promote|demote|disable|enable <email>`, exécuté sur le serveur. Ce script ne crée jamais de compte ; une adresse inconnue est signalée (code de sortie 1) sans rien modifier.

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
| Erreurs au format `{ "error": "..." }`, route inconnue en HTML | Réalisé (FND-03) |
| Validation des paramètres et du corps | Réalisé pour `/users` (FND-04) |
| Routes sans préfixe `/api/v1`, réponses sans enveloppe, route `GET /` | Réalisé (FND-07) : voir section 1.2 |
| Corps envoyé dans un autre format que JSON, refusé en 400 au lieu de 415 | Réalisé (FND-08) |
| Identifiants numériques | Réalisé (DB-04) : voir section 1.3 |
| Accès sans autorisation | Réalisé (AUTH-02, AUTH-05 à AUTH-10) : voir sections 1.5 et 7 |

## 16. Historique

| Date | Changement |
|---|---|
| 2026-11-17 | Adoption des conventions (SET-05) |
| 2026-11-17 | Codes métier USER_NOT_FOUND et EMAIL_ALREADY_USED (FND-03) |
| 2026-11-17 | Champ `field` d'une erreur portant sur un emplacement entier (FND-04) |
| 2026-11-18 | Préfixe `/api/v1` appliqué aux routes existantes, enveloppe de succès, route `GET /health`, suppression de `GET /` (FND-07) ; correction de trois lignes mal formatées |
| 2026-11-18 | En-tête `X-Request-Id` en requête (facultatif) et en réponse (toujours présent) (FND-05) ; changement additif (section 13) |
| 2026-11-18 | Protections HTTP (FND-08) : corps JSON de 10 Ko au plus, 415 pour un corps qui n'est pas en JSON, limitation du débit et 429, CORS selon `CORS_ORIGINS`, en-têtes de sécurité ; le passage de 400 à 415 et la baisse de la limite de 100 Ko à 10 Ko sont des changements cassants admis (section 13) |
| 2026-11-20 | Identifiants en base : UUID v7 générés par PostgreSQL 18, choix finalisé (SET-04) ; précision sans effet sur le contrat actuel de l'API |
| 2026-11-23 | Utilisateurs persistants (DB-04) : identifiants UUID dans `/api/v1/users/:id`, email en minuscules, tri par date de création, plus d'utilisateurs initiaux (section 1.3) ; changement cassant admis (section 13) |
| 2026-11-23 | Inscription `POST /api/v1/auth/register` (AUTH-01, AUTH-03, AUTH-04) ; suppression des routes `/api/v1/users` en attendant leurs permissions ; champ `role` dans la forme publique d'un compte (section 1.4) ; changement cassant admis (section 13) |
| 2026-11-24 | Authentification (AUTH-02, AUTH-05 à AUTH-10) : connexion, déconnexion, jeton `Bearer`, routes `/api/v1/users` réintroduites avec permissions (sans POST ni PUT), `/users/me`, liste paginée ; codes `INVALID_CREDENTIALS`, `ACCOUNT_DISABLED`, `UNAUTHENTICATED`, `FORBIDDEN` ; routes publiques et protégées (sections 1.5 et 7) ; changement cassant admis (section 13) |
| 2026-11-24 | Classes et personnages (CHAR-01 à CHAR-05) : `GET /api/v1/classes`, `POST` et `GET /api/v1/characters`, `GET /api/v1/characters/:characterId` ; champs réels d'un personnage (section 3.2) ; codes `CLASS_NOT_FOUND`, `CHARACTER_LIMIT_REACHED`, `CHARACTER_NAME_TAKEN`, `CHARACTER_NOT_FOUND` (section 1.6) ; changement additif (section 13) |