# Adaptations par rapport au backlog initial

Dernière mise à jour : 2026-11-17

Le backlog de référence (`Backlog_API_Mmorpg.md`) est conservé dans le projet Claude « API jeux vidéo ». Ce fichier recense les écarts décidés par rapport à lui, avec leur raison.

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

## Décisions de fonctionnement

- Le serveur de développement ne surveille pas le `.env` : après une modification, il faut le redémarrer manuellement.

## Tickets additionnels proposés (non démarrés)

- **FND-09 — Gérer les erreurs de démarrage du serveur** (P1, dépendances : FND-01, FND-02). Gestion de l'événement `error` de `listen` (port occupé, accès refusé), message explicite et arrêt avec code 1. Hors périmètre : logger (FND-05), erreurs de base (DB-01), arrêt propre (QUAL-06). Modifie uniquement `server.ts`.
- **Correction des bugs HTTP identifiés à l'audit** (PATCH `/users/:id`, JSON invalide en 500, identifiant non numérique) : non planifié.