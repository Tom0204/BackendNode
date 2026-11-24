import { randomUUID } from 'node:crypto'
import { CLASSES } from '../../prisma/seed/reference-data'
import type { CharacterClassRepository } from '../../src/repositories/character-class.repository'
import type { CharacterClass } from '../../src/types/character-class'

/* Classes jouables en mémoire, pour les tests sans base (CHAR-01).
 * Remplies avec les mêmes données de référence que le seed (prisma/seed/reference-data.ts), dans le même ordre.
 * Même contrat que le repository Prisma (tests/helpers/character-class-repository-contract.ts).
 */

export interface InMemoryCharacterClassRepository extends CharacterClassRepository {
    /** Classe de référence par son code (warrior, mage, rogue) : lecture réservée aux tests. */
    byCode(code: string): CharacterClass
}

const copy = (characterClass: CharacterClass): CharacterClass => ({
    ...characterClass,
    baseStats: { ...characterClass.baseStats },
    statsPerLevel: { ...characterClass.statsPerLevel }
})

export function createInMemoryCharacterClassRepository(): InMemoryCharacterClassRepository {
    const classes: CharacterClass[] = CLASSES.map((reference) => ({
        id: randomUUID(),
        code: reference.code,
        name: reference.name,
        baseStats: {
            hp: reference.baseHp,
            mana: reference.baseMana,
            attack: reference.baseAttack,
            defense: reference.baseDefense,
            speed: reference.baseSpeed
        },
        statsPerLevel: {
            hp: reference.hpPerLevel,
            mana: reference.manaPerLevel,
            attack: reference.attackPerLevel,
            defense: reference.defensePerLevel,
            speed: reference.speedPerLevel
        }
    }))

    return {
        async findAll() {
            return classes.map(copy)
        },

        async findById(id) {
            const found = classes.find((characterClass) => characterClass.id === id)
            return found ? copy(found) : undefined
        },

        byCode(code) {
            const found = classes.find((characterClass) => characterClass.code === code)
            if (!found) {
                throw new Error(`Classe de référence inconnue : ${code}`)
            }
            return copy(found)
        }
    }
}
