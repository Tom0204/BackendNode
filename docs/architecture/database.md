# Base de données (SET-04)

> **Statut :** décisions approuvées par le propriétaire du projet (SET-04, 2026-11-20), mises en place par DB-01 (2026-11-22).
> Modèle relationnel, première migration et seed : DB-02 et DB-03 (2026-11-23), détaillés dans `docs/architecture/data-model.md`.
> Vérifications avec Docker Desktop effectuées le 2026-11-22 (voir section 8).

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
| PostgreSQL | 18 (image Docker `postgres:18.7`) |
| `prisma` (CLI, dépendance de développement) | 7.10.1 exacte |
| `@prisma/client`, `@prisma/adapter-pg` | 7.10.1 exacte |
| `pg`, `@types/pg` | 8.23.1 exacte |
| Node.js | ≥ 20.19 exigé par Prisma 7 (projet : 22.x) |

Les versions sont installées **exactes** : le tag `latest` de `prisma` sur npm ne pointe pas vers la branche 7.

Architecture :
- un `pg.Pool` géré par l'application, transmis à `PrismaPg`, puis un **seul** `PrismaClient` partagé ;
- accès à la base **uniquement dans les repositories** (`src/repositories/`) ; services indépendants d'Express et de Prisma, construits avec le repository qu'on leur fournit (`server.ts` assemble les versions Prisma) ;
- transactions `$transaction` pour toute opération qui modifie plusieurs données liées ;
- fermeture du pool à l'arrêt du serveur : QUAL-06.

Mise en œuvre (DB-01) :
- `src/database/client.ts` : `createDatabase` (pool, adaptateur, client), `checkDatabaseConnection` (`SELECT 1`, délai de connexion de 5 s), `closeDatabase` ;
- `server.ts` vérifie la base **avant** d'ouvrir le port ; en cas d'échec, `src/database/errors.ts` produit un message clair (code d'erreur uniquement, jamais le message d'origine ni l'URL) et le processus s'arrête avec le code 1 ;
- `GET /health` ne contrôle pas la base ;
- client généré dans `src/generated/prisma/` (ignoré par Git), régénéré par `npm run db:generate` et automatiquement avant `typecheck` et `build` ;
- le client généré utilise `import.meta.url` : le build CommonJS (tsup) utilise l'option `--shims`.

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
- Les identifiants numériques des utilisateurs (ancien repository en mémoire) ont été remplacés par des UUID avec DB-04.

## 4. Environnements et variables

| Environnement | Base | Variable | Création |
|---|---|---|---|
| Développement | `mmorpg_dev` | `DATABASE_URL` (obligatoire) | Conteneur Docker local |
| Test | `mmorpg_test` | `TEST_DATABASE_URL` (tests base de données uniquement) | Même conteneur, script d'initialisation |
| Production | Définie au déploiement | `DATABASE_URL` (obligatoire) | Hors dépôt (QUAL-06) |

- Format : `postgresql://utilisateur:motdepasse@hôte:port/base`.
- Aucun identifiant de connexion dans Git : valeurs réelles dans `.env` (ignoré), valeurs factices dans `.env.example` (DB-01).
- Les tests actuels (`npm test`) n'utilisent aucune base et ne lisent ni `DATABASE_URL` ni `TEST_DATABASE_URL`.

Environnement local : **un conteneur** `postgres:18.7` (`docker-compose.yml`) contenant les deux bases, avec un port publié sur `127.0.0.1` uniquement. `mmorpg_test` est créée par `docker/postgres/init/01-create-test-database.sql`, exécuté seulement au premier démarrage (volume vide). Identifiants : `POSTGRES_USER`, `POSTGRES_PASSWORD` (obligatoire) et `POSTGRES_PORT` dans le `.env`.

> **Piège PostgreSQL 18 :** le volume de données doit être monté sur `/var/lib/postgresql`
> (et non plus `/var/lib/postgresql/data` comme jusqu'à la version 17).

## 5. Migrations

Règles :
- outil : Prisma Migrate. Les migrations (`prisma/migrations/`) sont **versionnées dans Git** ;
- une migration appliquée ailleurs que sur sa machine n'est jamais modifiée : on en crée une nouvelle ;
- `prisma db push` est interdit : il ne laisse aucun historique ;
- suppression ou renommage d'une colonne contenant des données : ajouter, copier, puis supprimer dans une migration ultérieure ;
- contraintes que Prisma ne sait pas décrire (`CHECK`) : créer la migration avec `npx prisma migrate dev --create-only --name <nom>`, ajouter le SQL à la fin du fichier, puis l'appliquer avec `npx prisma migrate dev`. Les documenter dans `data-model.md`.

Migration existante : `20261123092444_init` (DB-03), qui crée toutes les tables de `data-model.md` et leurs `CHECK`.

| Environnement | Commandes | Interdit |
|---|---|---|
| Développement | `npx prisma migrate dev --name <nom>` puis `npx prisma generate` ; `npx prisma migrate status` ; réinitialisation : `npx prisma migrate reset` (destructif) | — |
| Test | `npx prisma migrate deploy`, lancé uniquement par le script de test qui applique la protection (section 6) | `migrate dev`, `reset`, `db push` |
| Production | `npx prisma migrate deploy` comme étape de déploiement, **après une sauvegarde** et avant le démarrage du serveur ; `npx prisma migrate status` | `migrate dev`, `reset`, `db push` |

Contrôle de cohérence entre le schéma et une base construite par les migrations (`mmorpg_dev`, après `db:migrate`) :
`npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`
(code 0 : aucun écart ; code 2 : écart à corriger par une nouvelle migration).
Avec Prisma 7, la comparaison directe à partir du dossier (`--from-migrations`) exige une base « shadow » déclarée (`datasource.shadowDatabaseUrl`), non configurée dans ce projet.

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

Implémentation : `tests/helpers/test-database.ts` (tests : `tests/unit/test-database-guard.test.ts`). `npm run test:db` (`vitest.db.config.ts`) applique la garde, puis `prisma migrate deploy` et le seed des données de référence sur `mmorpg_test` (`tests/database/global-setup.ts`), avant les tests de `tests/database/`. Les données de joueurs nécessaires aux tests sont créées et supprimées par les tests (`tests/helpers/player-fixtures.ts`). `TEST_DATABASE_URL` est lue dans l'environnement, sinon dans le `.env`, dont aucune autre clé n'est lue.

## 7. Suites

| Ticket | Travail |
|---|---|
| DB-01 | Réalisé et vérifié avec Docker (section 8) |
| DB-02, DB-03 | Réalisés : modèle, migration `init`, seed idempotent (`data-model.md`, section 8 ci-dessous) |
| DB-04 | Réalisé : repositories Prisma des utilisateurs et des personnages, identifiants UUID dans l'API |
| QUAL-06 | Migrations et CLI en production, sauvegardes, arrêt propre |

## 8. Commandes et premier démarrage

Prérequis : Docker Desktop. Copier `.env.example` en `.env` et choisir un mot de passe (identique dans `POSTGRES_PASSWORD`, `DATABASE_URL` et `TEST_DATABASE_URL`).

| Commande | Rôle |
|---|---|
| `npm run db:up` / `npm run db:down` | Démarrer (en attendant l'état *healthy*) / arrêter le conteneur ; les données restent dans le volume |
| `npm run db:generate` | Régénérer le client Prisma |
| `npm run db:migrate -- --name <nom>` | Créer et appliquer une migration en développement, puis `db:generate` |
| `npm run db:seed` | Mettre à jour les données de référence (`prisma/seed/`), sans doublon ni suppression ; à relancer après chaque migration qui en a besoin |
| `npm run db:status` | État des migrations |
| `npm run db:reset` | Réinitialiser la base de développement (**destructif**) |
| `npm run test:db` | Tests base de données sur `mmorpg_test` |

Premier démarrage d'une base vide : `npm run db:up`, `npm run db:migrate` (applique la migration `init`), puis `npm run db:seed`.

Réinitialiser la base locale de développement (**destructif**, toutes les données sont perdues) : `npm run db:reset`, puis `npm run db:seed`. Avec Prisma 7, `migrate reset` ne relance pas le seed. Pour repartir d'un conteneur entièrement vide, `docker compose down -v` supprime aussi le volume, donc les deux bases. Ces commandes sont à lancer par le développeur : la CLI Prisma refuse `migrate reset` lancé par un agent IA sans accord explicite.

Vérifications effectuées (DB-01, 2026-11-22), avec le résultat attendu : `db:up` (conteneur *healthy*), présence de `mmorpg_dev` et `mmorpg_test` en version 18.7, port publié sur `127.0.0.1` uniquement, `npm run dev` puis `GET /health` (200), `test:db` (3 tests), arrêt de la base puis `npm start` (erreur fatale propre), conservation des données après `db:down` / `db:up`. À cette date, sans migration, `db:status` renvoyait le code 1 ; depuis DB-03, il répond « Database schema is up to date » (code 0).

## Historique

| Date | Changement |
|---|---|
| 2026-11-20 | Création (SET-04) |
| 2026-11-22 | Mise en place (DB-01) |
| 2026-11-23 | Migration `init`, seed, contrôle de cohérence adapté à Prisma 7 (DB-02, DB-03) |
