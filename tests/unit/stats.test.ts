import { describe, expect, it } from 'vitest'
import { MAX_LEVEL } from '../../src/config/gameplay'
import { assertValidLevel, isValidLevel, statsAtLevel } from '../../src/services/stats'
import { createInMemoryCharacterClassRepository } from '../helpers/in-memory-character-class-repository'

/* Calcul des statistiques (STAT-01, rules.md §2) : classes du seed, niveaux 1, 5 et 10, niveaux invalides. */

const classes = createInMemoryCharacterClassRepository()

describe('statsAtLevel (STAT-01)', () => {
    // Valeurs calculées à la main avec stat(niveau) = base + gain × (niveau − 1).
    it.each([
        ['warrior', 1, { hp: 120, mana: 20, attack: 12, defense: 8, speed: 8 }],
        ['warrior', 5, { hp: 168, mana: 28, attack: 20, defense: 16, speed: 12 }],
        ['warrior', 10, { hp: 228, mana: 38, attack: 30, defense: 26, speed: 17 }],
        ['mage', 1, { hp: 80, mana: 100, attack: 10, defense: 4, speed: 10 }],
        ['mage', 5, { hp: 112, mana: 140, attack: 18, defense: 8, speed: 14 }],
        ['mage', 10, { hp: 152, mana: 190, attack: 28, defense: 13, speed: 19 }],
        ['rogue', 1, { hp: 95, mana: 40, attack: 11, defense: 6, speed: 14 }],
        ['rogue', 5, { hp: 135, mana: 56, attack: 19, defense: 10, speed: 22 }],
        ['rogue', 10, { hp: 185, mana: 76, attack: 29, defense: 15, speed: 32 }]
    ])('%s niveau %i', (code, level, expected) => {
        expect(statsAtLevel(classes.byCode(code), level)).toEqual(expected)
    })

    it('exemple de rules.md §2 : guerrier niveau 5 → 168 PV et 20 d’attaque', () => {
        expect(statsAtLevel(classes.byCode('warrior'), 5)).toMatchObject({ hp: 168, attack: 20 })
    })

    it('niveau 1 : exactement les statistiques de base', () => {
        const mage = classes.byCode('mage')
        expect(statsAtLevel(mage, 1)).toEqual(mage.baseStats)
    })

    it('chaque niveau ajoute exactement le gain par niveau, jusqu’au niveau maximal', () => {
        const rogue = classes.byCode('rogue')
        for (let level = 2; level <= MAX_LEVEL; level += 1) {
            const before = statsAtLevel(rogue, level - 1)
            const after = statsAtLevel(rogue, level)
            expect({
                hp: after.hp - before.hp,
                mana: after.mana - before.mana,
                attack: after.attack - before.attack,
                defense: after.defense - before.defense,
                speed: after.speed - before.speed
            }).toEqual(rogue.statsPerLevel)
        }
    })

    it('déterministe et sans effet de bord : même résultat, classe inchangée, nouvel objet à chaque appel', () => {
        const warrior = classes.byCode('warrior')
        const snapshot = structuredClone(warrior)
        const first = statsAtLevel(warrior, 7)
        const second = statsAtLevel(warrior, 7)
        expect(second).toEqual(first)
        expect(second).not.toBe(first)
        expect(first).not.toBe(warrior.baseStats)
        expect(warrior).toEqual(snapshot)
    })

    it('valeurs entières à tous les niveaux, pour les trois classes', () => {
        for (const characterClass of [classes.byCode('warrior'), classes.byCode('mage'), classes.byCode('rogue')]) {
            for (let level = 1; level <= MAX_LEVEL; level += 1) {
                expect(Object.values(statsAtLevel(characterClass, level)).every(Number.isInteger)).toBe(true)
            }
        }
    })

    it.each([0, -1, MAX_LEVEL + 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('niveau invalide %s : RangeError', (level) => {
        expect(() => statsAtLevel(classes.byCode('warrior'), level)).toThrow(RangeError)
        expect(isValidLevel(level)).toBe(false)
        expect(() => assertValidLevel(level)).toThrow(RangeError)
    })

    it('niveaux 1 et MAX_LEVEL : valides', () => {
        expect(isValidLevel(1)).toBe(true)
        expect(isValidLevel(MAX_LEVEL)).toBe(true)
    })
})
