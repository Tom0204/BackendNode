import { describe, expect, it } from 'vitest'
import { MAX_LEVEL } from '../../src/config/gameplay'
import {
    applyExperienceGain,
    assertValidExperienceGain,
    assertValidProgression,
    experienceRequiredForLevel
} from '../../src/services/experience'

/* Expérience et niveaux (STAT-03, rules.md §4) : courbe, seuils, passages multiples, niveau maximal. */

// Tableau de rules.md §4 : XP pour passer du niveau n au niveau n + 1, et XP cumulée depuis le niveau 1.
const RULES_TABLE = [
    [1, 100, 100],
    [2, 283, 383],
    [3, 520, 903],
    [4, 800, 1703],
    [5, 1118, 2821],
    [6, 1470, 4291],
    [7, 1852, 6143],
    [8, 2263, 8406],
    [9, 2700, 11106]
] as const

const TOTAL_TO_MAX_LEVEL = 11106

describe('experienceRequiredForLevel (STAT-03)', () => {
    it.each(RULES_TABLE)('niveau %i : %i XP (tableau de rules.md)', (level, required) => {
        expect(experienceRequiredForLevel(level)).toBe(required)
    })

    it('XP cumulée identique au tableau de rules.md', () => {
        let total = 0
        for (const [level, , cumulative] of RULES_TABLE) {
            total += experienceRequiredForLevel(level)
            expect(total).toBe(cumulative)
        }
        expect(total).toBe(TOTAL_TO_MAX_LEVEL)
    })

    it(`niveau maximal (${MAX_LEVEL}) : pas de niveau suivant, RangeError`, () => {
        expect(() => experienceRequiredForLevel(MAX_LEVEL)).toThrow(RangeError)
    })

    it.each([0, -1, MAX_LEVEL + 1, 2.5, Number.NaN])('niveau invalide %s : RangeError', (level) => {
        expect(() => experienceRequiredForLevel(level)).toThrow(RangeError)
    })
})

describe('applyExperienceGain (STAT-03)', () => {
    it('niveau 1 : gain sous le seuil, XP cumulée dans le niveau', () => {
        expect(applyExperienceGain({ level: 1, experience: 0 }, 25)).toEqual({ level: 1, experience: 25, levelsGained: 0 })
    })

    it('un point sous le seuil : pas de passage de niveau', () => {
        expect(applyExperienceGain({ level: 1, experience: 90 }, 9)).toEqual({ level: 1, experience: 99, levelsGained: 0 })
    })

    it('seuil exact : passage au niveau suivant avec 0 XP', () => {
        expect(applyExperienceGain({ level: 1, experience: 90 }, 10)).toEqual({ level: 2, experience: 0, levelsGained: 1 })
        expect(applyExperienceGain({ level: 5, experience: 0 }, 1118)).toEqual({ level: 6, experience: 0, levelsGained: 1 })
    })

    it('dépassement : le reste est conservé dans le nouveau niveau', () => {
        expect(applyExperienceGain({ level: 2, experience: 280 }, 10)).toEqual({ level: 3, experience: 7, levelsGained: 1 })
    })

    it('exemple de rules.md : niveau 1 avec 90 XP, gain de 300 → niveau 3 avec 7 XP', () => {
        expect(applyExperienceGain({ level: 1, experience: 90 }, 300)).toEqual({ level: 3, experience: 7, levelsGained: 2 })
    })

    it('plusieurs niveaux d’un coup : 903 XP depuis le niveau 1 → niveau 4 avec 0 XP', () => {
        expect(applyExperienceGain({ level: 1, experience: 0 }, 903)).toEqual({ level: 4, experience: 0, levelsGained: 3 })
    })

    it('même résultat en un gain ou en plusieurs gains successifs', () => {
        let progression = { level: 1, experience: 0 }
        for (const gain of [25, 40, 60, 300, 1, 1000, 77]) {
            const { level, experience } = applyExperienceGain(progression, gain)
            progression = { level, experience }
        }
        const total = 25 + 40 + 60 + 300 + 1 + 1000 + 77
        const { level, experience } = applyExperienceGain({ level: 1, experience: 0 }, total)
        expect(progression).toEqual({ level, experience })
    })

    it('arrivée exacte au niveau maximal : niveau 10, XP 0', () => {
        expect(applyExperienceGain({ level: 9, experience: 2699 }, 1)).toEqual({ level: MAX_LEVEL, experience: 0, levelsGained: 1 })
        expect(applyExperienceGain({ level: 1, experience: 0 }, TOTAL_TO_MAX_LEVEL)).toEqual({
            level: MAX_LEVEL,
            experience: 0,
            levelsGained: MAX_LEVEL - 1
        })
    })

    it('arrivée au niveau maximal avec un reste : le reste est perdu (D4)', () => {
        expect(applyExperienceGain({ level: 9, experience: 2600 }, 500)).toEqual({ level: MAX_LEVEL, experience: 0, levelsGained: 1 })
    })

    it('juste avant le niveau maximal : niveau 9 avec 2 699 XP', () => {
        expect(applyExperienceGain({ level: 1, experience: 0 }, TOTAL_TO_MAX_LEVEL - 1)).toEqual({
            level: 9,
            experience: 2699,
            levelsGained: 8
        })
    })

    it('au niveau maximal : tout gain est ignoré, XP 0', () => {
        expect(applyExperienceGain({ level: MAX_LEVEL, experience: 0 }, 1)).toEqual({ level: MAX_LEVEL, experience: 0, levelsGained: 0 })
        expect(applyExperienceGain({ level: MAX_LEVEL, experience: 0 }, 5000)).toEqual({ level: MAX_LEVEL, experience: 0, levelsGained: 0 })
    })

    it('gain énorme (plus grand entier sûr) : niveau maximal, XP 0, sans boucle infinie', () => {
        expect(applyExperienceGain({ level: 1, experience: 99 }, Number.MAX_SAFE_INTEGER)).toEqual({
            level: MAX_LEVEL,
            experience: 0,
            levelsGained: MAX_LEVEL - 1
        })
    })

    it('ne modifie pas la progression fournie', () => {
        const current = { level: 1, experience: 90 }
        applyExperienceGain(current, 300)
        expect(current).toEqual({ level: 1, experience: 90 })
    })

    it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])('gain invalide %s : RangeError (D5)', (amount) => {
        expect(() => applyExperienceGain({ level: 1, experience: 0 }, amount)).toThrow(RangeError)
        expect(() => assertValidExperienceGain(amount)).toThrow(RangeError)
    })

    it.each([
        { level: 0, experience: 0 },
        { level: MAX_LEVEL + 1, experience: 0 },
        { level: 1.5, experience: 0 },
        { level: 1, experience: -1 },
        { level: 1, experience: 0.5 },
        { level: 1, experience: 100 },
        { level: 9, experience: 2700 },
        { level: MAX_LEVEL, experience: 1 }
    ])('progression incohérente $level / $experience : RangeError, jamais corrigée en silence', (progression) => {
        expect(() => assertValidProgression(progression)).toThrow(RangeError)
        expect(() => applyExperienceGain(progression, 10)).toThrow(RangeError)
    })

    it('progressions valides aux bornes : acceptées', () => {
        for (const progression of [
            { level: 1, experience: 0 },
            { level: 1, experience: 99 },
            { level: 9, experience: 2699 },
            { level: MAX_LEVEL, experience: 0 }
        ]) {
            expect(() => assertValidProgression(progression)).not.toThrow()
        }
    })
})
