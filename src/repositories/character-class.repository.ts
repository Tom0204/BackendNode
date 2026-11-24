import type { PrismaClient } from '../generated/prisma/client'
import type { CharacterClass } from '../types/character-class'

/**
 * Lecture des classes jouables (CHAR-01). Données de référence : remplies et mises à jour uniquement par le seed,
 * aucune méthode d'écriture n'est exposée à l'application.
 */
export interface CharacterClassRepository {
    /** Toutes les classes, dans l'ordre de création par le seed (createdAt, puis id). */
    findAll(): Promise<CharacterClass[]>
    findById(id: string): Promise<CharacterClass | undefined>
}

const CLASS_SELECT = {
    id: true,
    code: true,
    name: true,
    baseHp: true,
    baseMana: true,
    baseAttack: true,
    baseDefense: true,
    baseSpeed: true,
    hpPerLevel: true,
    manaPerLevel: true,
    attackPerLevel: true,
    defensePerLevel: true,
    speedPerLevel: true
} as const

const CLASS_ORDER = [{ createdAt: 'asc' }, { id: 'asc' }] as const

interface ClassRow {
    id: string
    code: string
    name: string
    baseHp: number
    baseMana: number
    baseAttack: number
    baseDefense: number
    baseSpeed: number
    hpPerLevel: number
    manaPerLevel: number
    attackPerLevel: number
    defensePerLevel: number
    speedPerLevel: number
}

// Colonnes à plat de la base → statistiques regroupées du type métier.
function toCharacterClass(row: ClassRow): CharacterClass {
    return {
        id: row.id,
        code: row.code,
        name: row.name,
        baseStats: { hp: row.baseHp, mana: row.baseMana, attack: row.baseAttack, defense: row.baseDefense, speed: row.baseSpeed },
        statsPerLevel: {
            hp: row.hpPerLevel,
            mana: row.manaPerLevel,
            attack: row.attackPerLevel,
            defense: row.defensePerLevel,
            speed: row.speedPerLevel
        }
    }
}

export function createPrismaCharacterClassRepository(prisma: PrismaClient): CharacterClassRepository {
    return {
        async findAll() {
            const rows = await prisma.characterClass.findMany({ select: CLASS_SELECT, orderBy: [...CLASS_ORDER] })
            return rows.map(toCharacterClass)
        },

        async findById(id) {
            const row = await prisma.characterClass.findUnique({ where: { id }, select: CLASS_SELECT })
            return row ? toCharacterClass(row) : undefined
        }
    }
}
