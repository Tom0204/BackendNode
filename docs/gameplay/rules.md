# Règles de gameplay du MVP (SET-03)

> **Statut :** règles initiales validées par le propriétaire du projet (SET-03, 2026-11-22).
> Toute valeur de ce document est un **paramètre** : le code la lit depuis un emplacement unique
> (constantes centralisées ou données de référence), jamais répétée dans plusieurs services.
> Une valeur marquée `À VALIDER` ne doit pas être figée dans le code.

## 1. Principes

- Le serveur calcule tout : statistiques, dégâts, XP, niveaux, butin.
- Le combat est **déterministe** au MVP. Seul le butin utilise l'aléatoire, avec un générateur injectable pour les tests.
- Tous les nombres sont entiers. Les dégâts sont arrondis à l'entier inférieur, l'XP à l'entier le plus proche.

## 2. Classes et statistiques

| Statistique | Signification |
|---|---|
| PV | Points de vie maximum ; à 0, le participant est vaincu |
| Mana | Ressource des compétences ; inutilisée au MVP |
| Attaque | Puissance de l'attaque de base |
| Défense | Réduit les dégâts reçus |
| Vitesse | Détermine qui joue en premier |

Les coups critiques ne font pas partie du MVP : il n'existe pas de statistique de critique. Elle sera définie, avec son multiplicateur, par COMBAT-05.

| Classe | PV | Mana | Attaque | Défense | Vitesse |
|---|---|---|---|---|---|
| Guerrier, niveau 1 | 120 | 20 | 12 | 8 | 8 |
| Guerrier, gain par niveau | +12 | +2 | +2 | +2 | +1 |
| Mage, niveau 1 | 80 | 100 | 10 | 4 | 10 |
| Mage, gain par niveau | +8 | +10 | +2 | +1 | +1 |
| Voleur, niveau 1 | 95 | 40 | 11 | 6 | 14 |
| Voleur, gain par niveau | +10 | +4 | +2 | +1 | +2 |

Formule : `stat(niveau) = base + gain × (niveau − 1)`.
Exemple : un guerrier de niveau 5 a 120 + 12 × 4 = **168 PV** et 12 + 2 × 4 = **20 d'attaque**.

## 3. Personnages

- 5 personnages au maximum par compte.
- Nom : 3 à 16 lettres (A–Z, a–z, sans accent ni espace), unique sur le serveur sans tenir compte de la casse (`Arthas` et `arthas` sont en conflit).
- À la création : niveau 1, XP 0, zone de départ, statistiques de la classe. Le client ne fournit que `name` et `classId`.

## 4. Expérience et niveaux

- Niveau maximal : **10**.
- XP nécessaire pour passer du niveau n au niveau n + 1 : `xpRequise(n) = arrondi(100 × n^1,5)`.
- Le personnage stocke son niveau et l'XP acquise **dans son niveau courant**.

| Niveau n | XP pour passer au niveau suivant | XP cumulée depuis le niveau 1 |
|---|---|---|
| 1 | 100 | 100 |
| 2 | 283 | 383 |
| 3 | 520 | 903 |
| 4 | 800 | 1 703 |
| 5 | 1 118 | 2 821 |
| 6 | 1 470 | 4 291 |
| 7 | 1 852 | 6 143 |
| 8 | 2 263 | 8 406 |
| 9 | 2 700 | 11 106 |

- Un gain peut faire passer plusieurs niveaux. Exemple : niveau 1 avec 90 XP, gain de 300 XP (390 au total) ; le passage au niveau 2 consomme 100 XP (reste 290), le passage au niveau 3 en consomme 283 : **niveau 3 avec 7 XP**.
- Au niveau 10, l'XP gagnée est ignorée et l'XP reste à 0.
- Un passage de niveau recalcule les statistiques.

## 5. Combat

- 1 personnage contre 1 monstre, tour par tour. Un personnage n'a qu'un seul combat `IN_PROGRESS` à la fois.
- À la création, le combat fige les statistiques des deux participants ; chacun commence avec ses PV au maximum.
- Chaque combat crée **sa propre instance** du monstre à partir du modèle : aucun monstre n'est partagé entre joueurs au MVP.
- **Initiative :** le participant le plus rapide commence ; en cas d'égalité, c'est le personnage. Les participants jouent ensuite en alternance stricte.
- **Tour du monstre :** résolu automatiquement par le serveur dans la même requête, à la création si le monstre commence, puis après chaque action du joueur.
- **Action du joueur au MVP :** uniquement `ATTACK`, avec le monstre pour cible.
- **Action du monstre :** attaque de base sur le personnage.
- **Dégâts :** `dégâts = max(1, arrondi_inférieur(attaque × 100 / (100 + défense)))`. Les PV sont bornés à 0.

| Attaquant | Défenseur | Calcul | Dégâts |
|---|---|---|---|
| Guerrier niv. 1 (attaque 12) | Loup (défense 2) | 1200 / 102 = 11,76 | 11 |
| Loup (attaque 8) | Guerrier niv. 1 (défense 8) | 800 / 108 = 7,41 | 7 |
| Mage niv. 1 (attaque 10) | Sanglier (défense 5) | 1000 / 105 = 9,52 | 9 |
| Guerrier niv. 5 (attaque 20) | Bandit (défense 6) | 2000 / 106 = 18,87 | 18 |
| Attaque 1 | Défense 200 | 100 / 300 = 0,33 | 1 (minimum) |

## 6. Fin de combat

- États : `IN_PROGRESS` → `VICTORY` ou `DEFEAT`. Ces états sont terminaux : aucune action n'est plus acceptée (422 `COMBAT_FINISHED`). L'état `FLED` est réservé à COMBAT-13.
- **Victoire :** les PV du monstre atteignent 0. Les récompenses sont attribuées une seule fois, dans une transaction.
- **Défaite :** les PV du personnage atteignent 0. Pas d'XP, pas de butin, aucune pénalité.
- Après chaque combat, victoire ou défaite, les PV et le mana du personnage sont remis au maximum (pas de régénération au MVP).
- **Fuite :** hors MVP.

Exemple complet : guerrier niveau 1 (120 PV, vitesse 8) contre loup (40 PV, vitesse 9 : le loup commence).

| Requête | Événements | PV guerrier | PV loup |
|---|---|---|---|
| `POST /combats` | Le loup attaque (7) | 113 | 40 |
| Action 1 | Le guerrier attaque (11), le loup riposte (7) | 106 | 29 |
| Action 2 | 11, puis 7 | 99 | 18 |
| Action 3 | 11, puis 7 | 92 | 7 |
| Action 4 | 11 : le loup est vaincu, `VICTORY` | 92, puis 120 après le combat | 0 |

## 7. Récompenses

- XP fixe par monstre (§8).
- Butin : au plus un objet par monstre, en quantité 1, avec une probabilité p fixe. Le serveur tire r uniformément dans [0, 1[ ; l'objet est obtenu si r < p.
- Pas de monnaie au MVP.
- Exemple : la victoire contre le loup rapporte 25 XP ; avec r = 0,31 < 0,5, le joueur obtient 1 « Peau de loup ».

## 8. Monde initial (données de référence du seed, DB-03)

Zone de départ : **Clairière**, niveaux 1 à 3.

| Monstre | Niveau | PV | Attaque | Défense | Vitesse | XP | Butin (probabilité) |
|---|---|---|---|---|---|---|---|
| Loup | 1 | 40 | 8 | 2 | 9 | 25 | Peau de loup (0,5) |
| Sanglier | 2 | 60 | 10 | 5 | 6 | 40 | Défense de sanglier (0,4) |
| Bandit | 3 | 75 | 12 | 6 | 11 | 60 | Insigne de bandit (0,25) |

Les trois objets sont des matériaux empilables, sans effet au MVP.

## 9. Paramètres modifiables

| Paramètre | Valeur |
|---|---|
| Niveau maximal | 10 |
| Personnages par compte | 5 |
| Longueur du nom | 3 à 16 |
| Courbe d'XP | base 100, exposant 1,5 |
| Constante de défense | 100 |
| Dégâts minimum | 1 |
| Statistiques des classes, monstres, butin | §2 et §8 (données de référence) |

## 10. À VALIDER

| Point | Ticket |
|---|---|
| Capacité de l'inventaire et taille maximale d'une pile | ITEM-02 |
| Stratégie JWT ou sessions | AUTH-05 |
| Statistique et multiplicateur de critique, conditions de fuite | COMBAT-05, COMBAT-13 (hors MVP) |

## Historique

| Date | Changement |
|---|---|
| 2026-11-22 | Création (SET-03) |
| 2026-11-23 | Statistique de critique retirée du MVP, reportée à COMBAT-05 (validation de DB-02) |
