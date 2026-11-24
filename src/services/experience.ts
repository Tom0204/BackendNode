import { MAX_LEVEL, XP_CURVE_BASE, XP_CURVE_EXPONENT } from '../config/gameplay'
import type { CharacterProgression } from '../types/character'
import { isValidLevel } from './stats'

/* Expérience et niveaux (STAT-03, rules.md §4). Fonctions pures et déterministes, sans base ni Express :
 * l'attribution d'XP (STAT-04) et plus tard les récompenses (REWARD-02) les réutilisent dans leurs transactions.
 *
 * Règles :
 * - le personnage stocke son niveau et l'XP acquise dans son niveau courant ;
 * - un gain peut faire passer plusieurs niveaux ;
 * - au niveau MAX_LEVEL, l'XP gagnée est ignorée et l'XP reste à 0 ; un reste au moment d'y arriver est perdu
 *   (décision D4 du lot L4).
 */

/** Résultat d'un gain d'XP : nouvelle progression et nombre de niveaux gagnés. */
export interface ExperienceGainResult extends CharacterProgression {
    levelsGained: number
}

/**
 * XP nécessaire pour passer du niveau n au niveau n + 1 : arrondi(100 × n^1,5) (rules.md §4).
 * Défini pour n de 1 à MAX_LEVEL − 1 : le niveau maximal n'a pas de niveau suivant.
 * Toute autre valeur (MAX_LEVEL, 0, nombre non entier…) : RangeError, erreur de programmation.
 */
export function experienceRequiredForLevel(level: number): number {
    if (!isValidLevel(level) || level === MAX_LEVEL) {
        throw new RangeError(`Niveau sans niveau suivant ou invalide : ${level} (entier de 1 à ${MAX_LEVEL - 1} attendu)`)
    }
    return Math.round(XP_CURVE_BASE * level ** XP_CURVE_EXPONENT)
}

/**
 * Vérifie qu'une progression respecte les invariants : niveau de 1 à MAX_LEVEL, XP entière positive ou nulle,
 * inférieure au seuil du niveau, et égale à 0 au niveau maximal. Sinon : RangeError (donnée incohérente,
 * jamais corrigée en silence).
 */
export function assertValidProgression({ level, experience }: CharacterProgression): void {
    const valid =
        isValidLevel(level) &&
        Number.isSafeInteger(experience) &&
        experience >= 0 &&
        (level === MAX_LEVEL ? experience === 0 : experience < experienceRequiredForLevel(level))
    if (!valid) {
        throw new RangeError(`Progression invalide : niveau ${level}, XP ${experience}`)
    }
}

/** Gain d'XP valide : entier sûr supérieur ou égal à 1 (décision D5 du lot L4). */
export function assertValidExperienceGain(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount < 1) {
        throw new RangeError(`Gain d'XP invalide : ${amount} (entier sûr ≥ 1 attendu)`)
    }
}

/**
 * Applique un gain d'XP à une progression valide et renvoie la nouvelle progression (rules.md §4).
 * Exemple de rules.md : niveau 1 avec 90 XP, gain de 300 → niveau 3 avec 7 XP, 2 niveaux gagnés.
 * Gain ou progression invalides : RangeError.
 */
export function applyExperienceGain(current: CharacterProgression, amount: number): ExperienceGainResult {
    assertValidProgression(current)
    assertValidExperienceGain(amount)

    let { level } = current
    // Au plus MAX_LEVEL − 1 passages : la boucle s'arrête au niveau maximal, quel que soit le gain.
    let experience = level === MAX_LEVEL ? 0 : current.experience + amount
    while (level < MAX_LEVEL && experience >= experienceRequiredForLevel(level)) {
        experience -= experienceRequiredForLevel(level)
        level += 1
    }
    if (level === MAX_LEVEL) {
        experience = 0
    }
    return { level, experience, levelsGained: level - current.level }
}
