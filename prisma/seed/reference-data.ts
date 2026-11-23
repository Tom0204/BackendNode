/* Données de référence du MVP (DB-03).
 * Source : docs/gameplay/rules.md, §2 (classes) et §8 (monde initial). Toute modification
 * doit être faite dans les deux fichiers ; tests/unit/reference-data.test.ts vérifie leur concordance.
 * Les codes sont des identifiants stables : le seed met à jour ou crée chaque élément selon son code.
 */

export interface ClassReference {
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

export interface ZoneReference {
    code: string
    name: string
    minLevel: number
    maxLevel: number
    /** Codes des monstres présents dans la zone. */
    monsterCodes: string[]
}

export interface MonsterReference {
    code: string
    name: string
    level: number
    hp: number
    attack: number
    defense: number
    speed: number
    xpReward: number
}

export interface ItemReference {
    code: string
    name: string
    type: 'MATERIAL'
    stackable: boolean
}

export interface LootReference {
    monsterCode: string
    itemCode: string
    /** Probabilité en points de base (0 à 10 000) : 5 000 = 0,5. */
    dropChanceBp: number
}

import { STARTING_ZONE_CODE } from '../../src/config/gameplay'

/** Code de la zone de départ, défini une seule fois dans src/config/gameplay.ts (utilisé par le repository des personnages). */
export { STARTING_ZONE_CODE }

export const CLASSES: readonly ClassReference[] = [
    {
        code: 'warrior', name: 'Guerrier',
        baseHp: 120, baseMana: 20, baseAttack: 12, baseDefense: 8, baseSpeed: 8,
        hpPerLevel: 12, manaPerLevel: 2, attackPerLevel: 2, defensePerLevel: 2, speedPerLevel: 1
    },
    {
        code: 'mage', name: 'Mage',
        baseHp: 80, baseMana: 100, baseAttack: 10, baseDefense: 4, baseSpeed: 10,
        hpPerLevel: 8, manaPerLevel: 10, attackPerLevel: 2, defensePerLevel: 1, speedPerLevel: 1
    },
    {
        code: 'rogue', name: 'Voleur',
        baseHp: 95, baseMana: 40, baseAttack: 11, baseDefense: 6, baseSpeed: 14,
        hpPerLevel: 10, manaPerLevel: 4, attackPerLevel: 2, defensePerLevel: 1, speedPerLevel: 2
    }
]

export const MONSTERS: readonly MonsterReference[] = [
    { code: 'wolf', name: 'Loup', level: 1, hp: 40, attack: 8, defense: 2, speed: 9, xpReward: 25 },
    { code: 'boar', name: 'Sanglier', level: 2, hp: 60, attack: 10, defense: 5, speed: 6, xpReward: 40 },
    { code: 'bandit', name: 'Bandit', level: 3, hp: 75, attack: 12, defense: 6, speed: 11, xpReward: 60 }
]

export const ZONES: readonly ZoneReference[] = [
    { code: STARTING_ZONE_CODE, name: 'Clairière', minLevel: 1, maxLevel: 3, monsterCodes: ['wolf', 'boar', 'bandit'] }
]

export const ITEMS: readonly ItemReference[] = [
    { code: 'wolf_pelt', name: 'Peau de loup', type: 'MATERIAL', stackable: true },
    { code: 'boar_tusk', name: 'Défense de sanglier', type: 'MATERIAL', stackable: true },
    { code: 'bandit_insignia', name: 'Insigne de bandit', type: 'MATERIAL', stackable: true }
]

export const LOOT: readonly LootReference[] = [
    { monsterCode: 'wolf', itemCode: 'wolf_pelt', dropChanceBp: 5000 },
    { monsterCode: 'boar', itemCode: 'boar_tusk', dropChanceBp: 4000 },
    { monsterCode: 'bandit', itemCode: 'bandit_insignia', dropChanceBp: 2500 }
]
