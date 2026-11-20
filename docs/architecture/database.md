# Base de données (SET-04)

> **Statut :** décisions approuvées par le propriétaire du projet (SET-04, 2026-11-20).
> Rien n'est encore installé : la mise en place relève de DB-01. Les commandes de ce document y seront appliquées.

## 1. Besoins et choix

Besoins du projet :
- données fortement relationnelles : comptes, personnages, classes, inventaires, combats, quêtes ;
- transactions pour les opérations sensibles : récompenses, inventaire, achats, échanges ;
- contraintes garanties par la base : unicité (email, nom de personnage), quantités positives, clés étrangères ;
- accès concurrents : un monstre ne peut pas être engagé dans deux combats ;
- schéma versionné et reproductible.

| Option | Verdict | Raison |
|---|---|---|
| **PostgreSQL** | **Retenu** | Relationnel, transactions et verrous fiables, contraintes riches, type `uuid` natif et `uuidv7()` depuis la version 18 |
| MySQL / MariaDB | Écarté | Convient, mais pas de génération native d'UUID v7 et contraintes moins riches |
| SQLite | Écarté | Concurrence d'écriture limitée, inadapté à un serveur multi-joueurs |
| MongoDB | Écarté | Modèle document peu adapté à des données très relationnelles et transactionnelles |
| **Prisma ORM** | **Retenu** | Schéma déclaratif, migrations versionnées, client typé pour TypeScript strict |
| Drizzle, TypeORM | Écartés | Viables ; Prisma offre l'outillage de migration le plus complet pour ce projet |
| `pg` seul | Écarté | SQL et mapping à écrire à la main, sans migrations intégrées |

## 2. Versions et architecture d'accès

| Élément | Version |
|---|---|
| PostgreSQL | 18 (image Docker `postgres:18.x`, mineure épinglée en DB-01) |
| `prisma` (CLI, dépendance de développement) | 7.10.1 exacte |
| `@prisma/client`, `@prisma/adapter-pg` | 7.10.1 exacte |
| `pg`, `@types/pg` | Fixées en DB-01 |
| Node.js | ≥ 20.19 exigé par Prisma 7 (projet : 22.x) |

Les versions sont installées **exactes** : le tag `latest` de `prisma` sur npm ne pointe pas vers la branche 7.

Architecture :
- un `pg.Pool` géré par l'application, transmis à `PrismaPg`, puis un **seul** `PrismaClient` partagé ;
- accès à la base **uniquement dans les repositories** ; services indépendants d'Express et de Prisma ;
- transactions `$transaction` pour toute opération qui modifie plusieurs données liées ;
- fermeture du pool à l'arrêt du serveur : QUAL-06.

Particularités de Prisma 7 :
- l'URL de connexion est déclarée dans le fichier de configuration Prisma, plus dans `schema.prisma` ;
- ce fichier charge le `.env` avec `process.loadEnvFile()`, comme `src/config/environment.ts` (pas de `dotenv`) ;
- `prisma generate` et le seed ne sont plus lancés automatiquement après une migration.

## 3. Identifiants

- Clés primaires en **UUID v7**, générées par PostgreSQL : `@default(dbgenerated("uuidv7()")) @db.Uuid`.
- Type de colonne `uuid` natif, jamais `text`.
- **Pourquoi la base :** une seule source de vérité, valable pour toute insertion (Prisma, seed SQL, `psql`), sans dépendance supplémentaire. Les UUID v7 sont ordonnés dans le temps, ce qui garde les index compacts.
- **Dans l'API :** chaîne opaque (conventions §7). Un format invalide est refusé en 400 par un schéma UUID Zod.
- **Limite :** un UUID v7 laisse lire son instant de création, à la milliseconde. C'est acceptable pour ce projet.
- Les identifiants numériques actuels des utilisateurs (repository en mémoire) passeront en UUID avec DB-04.

## 4. Environnements et variables

| Environnement | Base | Variable | Création |
|---|---|---|---|
| Développement | `mmorpg_dev` | `DATABASE_URL` (obligatoire) | Conteneur Docker local |
| Test | `mmorpg_test` | `TEST_DATABASE_URL` (tests base de données uniquement) | Même conteneur, script d'initialisation |
| Production | Définie au déploiement | `DATABASE_URL` (obligatoire) | Hors dépôt (QUAL-06) |

- Format : `postgresql://utilisateur:motdepasse@hôte:port/base`.
- Aucun identifiant de connexion dans Git : valeurs réelles dans `.env` (ignoré), valeurs factices dans `.env.example` (DB-01).
- Les tests actuels (`npm test`) n'utilisent aucune base et ne lisent ni `DATABASE_URL` ni `TEST_DATABASE_URL`.

Environnement local : **un conteneur** `postgres:18.x` contenant les deux bases, avec un port publié sur `127.0.0.1` uniquement.

> **Piège PostgreSQL 18 :** le volume de données doit être monté sur `/var/lib/postgresql`
> (et non plus `/var/lib/postgresql/data` comme jusqu'à la version 17).

## 5. Migrations

Règles :
- outil : Prisma Migrate. Les migrations (`prisma/migrations/`) sont **versionnées dans Git** ;
- une migration appliquée ailleurs que sur sa machine n'est jamais modifiée : on en crée une nouvelle ;
- `prisma db push` est interdit : il ne laisse aucun historique ;
- suppression ou renommage d'une colonne contenant des données : ajouter, copier, puis supprimer dans une migration ultérieure.

| Environnement | Commandes | Interdit |
|---|---|---|
| Développement | `npx prisma migrate dev --name <nom>` puis `npx prisma generate` ; `npx prisma migrate status` ; réinitialisation : `npx prisma migrate reset` (destructif) | — |
| Test | `npx prisma migrate deploy`, lancé uniquement par le script de test qui applique la protection (section 6) | `migrate dev`, `reset`, `db push` |
| Production | `npx prisma migrate deploy` comme étape de déploiement, **après une sauvegarde** et avant le démarrage du serveur ; `npx prisma migrate status` | `migrate dev`, `reset`, `db push` |

Contrôle de cohérence entre le schéma et les migrations :
`npx prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma --exit-code`
(code 2 : écart à corriger par une nouvelle migration).

Point ouvert, à traiter dans QUAL-06 : la CLI `prisma` est une dépendance de développement, absente d'une installation `npm ci --omit=dev`.

## 6. Protection de la base de test

Les tests base de données ne doivent jamais toucher une autre base que `mmorpg_test`.

1. **Variable dédiée :** ces tests lisent uniquement `TEST_DATABASE_URL`. Un `DATABASE_URL` de développement ou de production présent dans l'environnement est ignoré.
2. **Garde avant toute connexion :** une fonction refuse de continuer si :
   - `NODE_ENV` n'est pas `test` ;
   - `TEST_DATABASE_URL` est absente ou illisible ;
   - le nom de la base n'est pas **exactement** `mmorpg_test` ;
   - l'hôte n'est pas `localhost`, `127.0.0.1` ou `::1` ;
   - l'URL contient des paramètres (`?host=…` permettrait de se connecter ailleurs).

   Le message d'erreur ne recopie jamais l'URL, qui contient un mot de passe.
3. **Commandes séparées :** `npm test` reste sans base de données. Les tests base de données ont leur propre commande et leur propre configuration Vitest.

Implémentation et tests de cette garde : DB-01.

## 7. Suites

| Ticket | Travail |
|---|---|
| DB-01 | Installation, Docker Compose, configuration Prisma, `DATABASE_URL` et `TEST_DATABASE_URL`, garde de la base de test, scripts npm |
| DB-02, DB-03 | Modèle, première migration, seed idempotent (après SET-02 et SET-03) |
| DB-04 | Repositories persistants, passage des identifiants en UUID |
| QUAL-06 | Migrations et CLI en production, sauvegardes, arrêt propre |

## Historique

| Date | Changement |
|---|---|
| 2026-11-20 | Création (SET-04) |
