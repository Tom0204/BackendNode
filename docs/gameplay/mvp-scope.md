# Périmètre du MVP jouable (SET-02)

> **Statut :** validé par le propriétaire du projet (SET-02, 2026-11-22).
> Règles chiffrées : `docs/gameplay/rules.md`. Contrat HTTP : `docs/api/conventions.md`.

## 1. Objectif

Prouver que le backend fonctionne avec un parcours complet, exécutable **uniquement avec Postman** :
inscription → connexion → création de personnage → statistiques → zone → monstre → combat → victoire → XP et butin → état mis à jour.

Toutes les routes sont sous `/api/v1`. Les étapes 1 à 3 sont publiques : le catalogue des classes est une donnée de référence, consultable sans compte.
À partir de l'étape 4, chaque requête est authentifiée (jeton ou session : décidé en AUTH-05).
Les erreurs suivent le format centralisé des conventions. Erreurs communes à toutes les étapes :
`400 VALIDATION_ERROR` (données invalides ou champ inconnu), `401 UNAUTHENTICATED` (étapes 4 et suivantes), `429` (trop de requêtes).

## 2. Parcours

| # | Étape | Requête | Résultat attendu (vérifiable) | Erreurs spécifiques | Tickets |
|---|---|---|---|---|---|
| 1 | Inscription | `POST /auth/register` (email, mot de passe) | 201 ; compte créé, sans mot de passe ni hash dans la réponse | 409 `EMAIL_ALREADY_USED` | AUTH-01 à 04 |
| 2 | Connexion | `POST /auth/login` | 200 ; preuve d'authentification (AUTH-05) | 401 identifiants invalides (code fixé en AUTH-06) | AUTH-05, 06 |
| 3 | Choix de la classe | `GET /classes` (public) | 200 ; les 3 classes et leurs statistiques de niveau 1 | — | CHAR-01 |
| 4 | Création du personnage | `POST /characters` (`name`, `classId`) | 201 ; niveau 1, XP 0, zone de départ, valeurs calculées par le serveur | 409 nom indisponible, 409 `CHARACTER_LIMIT_REACHED`, 422 `CLASS_NOT_FOUND` | CHAR-02, 03 |
| 5 | Statistiques | `GET /characters/:characterId/stats` | 200 ; statistiques conformes à `rules.md` §2 | 404 `CHARACTER_NOT_FOUND` (inexistant ou d'un autre joueur) | STAT-01, 02 |
| 6 | Zone | `GET /characters/:characterId` | 200 ; `currentZoneId` = zone de départ | 404 `CHARACTER_NOT_FOUND` | CHAR-05, WORLD-01 |
| 7 | Monstres de la zone | `GET /zones/:zoneId/monsters` | 200 ; les 3 monstres de la zone de départ | 404 zone inconnue | WORLD-02, 03, 05 |
| 8 | Engagement | `POST /combats` (`characterId`, `monsterId`) | 201 ; combat `IN_PROGRESS`, PV des deux participants ; si le monstre est plus rapide, son premier tour est déjà joué | 422 personnage introuvable ou d'un autre joueur, 422 monstre absent de la zone, 409 personnage déjà en combat | COMBAT-01, 02, 03 |
| 9 | Combat | `POST /combats/:combatId/actions` (`{ "type": "ATTACK", "targetId": … }`) | Dégâts calculés par le serveur ; riposte du monstre dans la même réponse ; tour suivant | 404 combat inconnu ou d'un autre joueur, 422 `COMBAT_FINISHED`, 422 cible invalide | COMBAT-04, 06, 07, 08 |
| 10 | Victoire | Dernière action de l'étape 9 | État `VICTORY` ; récompenses (XP, niveaux gagnés, objet éventuel) attribuées une seule fois | Une nouvelle action renvoie 422 `COMBAT_FINISHED` | COMBAT-10, REWARD-01, 02, STAT-03, 04 |
| 11 | État mis à jour | `GET /characters/:characterId`, `GET /characters/:characterId/inventory`, `GET /combats/:combatId` | Niveau et XP à jour, objet dans l'inventaire, combat terminé | 404 si ressource inconnue ou d'un autre joueur | CHAR-05, ITEM-01 à 04, COMBAT-09 |

Variante obligatoire : **défaite** (combat `DEFEAT`, aucune récompense, personnage restauré : voir `rules.md` §6).

Le serveur ne fait jamais confiance au client : dégâts, XP, butin, statistiques et zone ne sont jamais acceptés dans une requête.

## 3. Tickets du MVP

- Phases B à E du backlog : DB-01 à 04, AUTH-01 à 07, CHAR-01 à 05, STAT-01 à 04, WORLD-01 à 03 et 05, COMBAT-01 à 04 et 06 à 10, ITEM-01 à 04, REWARD-01 et 02, QUAL-05.
- Adaptations : WORLD-07 réduit (une instance de monstre par combat, voir `rules.md` §5) ; WORLD-01, ITEM-01 à 04 et REWARD-01, classés P1, sont nécessaires au MVP.

## 4. Hors MVP

| Fonctionnalité | Tickets |
|---|---|
| Compétences et sorts, utilisation du mana | SKILL-01 à 05, COMBAT-12 |
| Coups critiques et aléatoire en combat | COMBAT-05 |
| Fuite ou abandon | COMBAT-13 |
| Déplacement entre zones, zones multiples | WORLD-04, WORLD-06 |
| Instances de monstres partagées, réapparition | WORLD-07 (partie restante) |
| Historique paginé des actions de combat | COMBAT-11 |
| Régénération et ressources persistantes | STAT-05 |
| Équipement et consommables | ITEM-05, ITEM-06 |
| Monnaie et économie | ECO-01 à 03 |
| Quêtes | QUEST-01 à 04 |
| Renommage et suppression de personnage | CHAR-06, CHAR-07 |
| Rôles, gestion du compte, déconnexion | AUTH-08 à 10 |
| Groupes, guildes, PvP, temps réel | Phase F |

## Historique

| Date | Changement |
|---|---|
| 2026-11-22 | Création (SET-02) |
