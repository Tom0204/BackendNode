import { MAX_LEVEL } from '../config/gameplay'
import type { CharacterClass, ClassStats } from '../types/character-class'

/* Calcul des statistiques d'un personnage (STAT-01, rules.md §2). Fonctions pures et déterministes :
 * aucune lecture de base, aucune dépendance à Express, réutilisables par les combats (EPIC 07).
 *
 * Les statistiques ne sont jamais stockées : elles se recalculent à partir de la classe et du niveau actuel.
 * Au MVP, il n'existe pas d'autre couche : les bonus d'équipement relèvent d'ITEM-05 (décision D1 du lot L4).
 */

/** Vrai pour un niveau entier compris entre 1 et MAX_LEVEL. */
export function isValidLevel(level: number): boolean {
    return Number.isInteger(level) && level >= 1 && level <= MAX_LEVEL
}

/** Erreur de programmation : un niveau hors de 1 à MAX_LEVEL ne doit jamais atteindre ce calcul. */
export function assertValidLevel(level: number): void {
    if (!isValidLevel(level)) {
        throw new RangeError(`Niveau invalide : ${level} (entier de 1 à ${MAX_LEVEL} attendu)`)
    }
}

/**
 * Statistiques d'une classe à un niveau donné : stat(niveau) = base + gain × (niveau − 1) (rules.md §2).
 * Valeurs entières, sans arrondi ni plafond : les contraintes SQL des classes garantissent des bases et des gains
 * positifs ou nuls (PV de base ≥ 1), donc des statistiques positives à tout niveau.
 * Niveau invalide : RangeError (erreur interne, jamais une erreur client).
 */
export function statsAtLevel(characterClass: Pick<CharacterClass, 'baseStats' | 'statsPerLevel'>, level: number): ClassStats {
    assertValidLevel(level)
    const levelsAboveFirst = level - 1
    const { baseStats, statsPerLevel } = characterClass
    return {
        hp: baseStats.hp + statsPerLevel.hp * levelsAboveFirst,
        mana: baseStats.mana + statsPerLevel.mana * levelsAboveFirst,
        attack: baseStats.attack + statsPerLevel.attack * levelsAboveFirst,
        defense: baseStats.defense + statsPerLevel.defense * levelsAboveFirst,
        speed: baseStats.speed + statsPerLevel.speed * levelsAboveFirst
    }
}
