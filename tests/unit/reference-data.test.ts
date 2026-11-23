import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CLASSES, ITEMS, LOOT, MONSTERS, STARTING_ZONE_CODE, ZONES } from '../../prisma/seed/reference-data'

/* Concordance des données de référence du seed avec docs/gameplay/rules.md (DB-03).
 * Les valeurs attendues sont lues dans les tableaux de rules.md : si le document ou le seed
 * change sans l'autre, ces tests échouent. Aucune base de données n'est utilisée.
 */

const RULES = readFileSync(resolve(process.cwd(), 'docs/gameplay/rules.md'), 'utf8')

// Cellules d'une ligne de tableau Markdown commençant par « | <label> | ».
function tableRow(label: string): string[] {
    const line = RULES.split(/\r?\n/).find((row) => row.startsWith(`| ${label} |`))
    if (line === undefined) {
        throw new Error(`Ligne « ${label} » introuvable dans rules.md`)
    }
    return line.split('|').slice(1, -1).map((cell) => cell.trim())
}

// « +12 » ou « 120 » → 12 ou 120.
const toInt = (cell: string): number => Number(cell.replace('+', ''))

// « Peau de loup (0,5) » → { name: 'Peau de loup', bp: 5000 }.
function parseLoot(cell: string): { name: string; bp: number } {
    const match = /^(.+) \((\d+(?:,\d+)?)\)$/.exec(cell)
    if (match === null) {
        throw new Error(`Butin illisible : ${cell}`)
    }
    return { name: match[1] ?? '', bp: Math.round(Number((match[2] ?? '').replace(',', '.')) * 10000) }
}

describe('Données de référence : concordance avec rules.md', () => {
    it.each(CLASSES.map((c) => [c.name, c] as const))('classe %s : statistiques de niveau 1 et gains (§2)', (name, c) => {
        // Colonnes du tableau : PV, mana, attaque, défense, vitesse (pas de critique au MVP).
        const baseRow = tableRow(`${name}, niveau 1`)
        const growthRow = tableRow(`${name}, gain par niveau`)
        // Le libellé plus 5 statistiques : une colonne ajoutée à rules.md sans le seed fait échouer le test.
        expect(baseRow).toHaveLength(6)
        expect(growthRow).toHaveLength(6)
        const base = baseRow.slice(1).map(toInt)
        const growth = growthRow.slice(1).map(toInt)
        expect([c.baseHp, c.baseMana, c.baseAttack, c.baseDefense, c.baseSpeed]).toEqual(base)
        expect([c.hpPerLevel, c.manaPerLevel, c.attackPerLevel, c.defensePerLevel, c.speedPerLevel]).toEqual(growth)
    })

    it('exactement les 3 classes du MVP : Guerrier, Mage, Voleur', () => {
        expect(CLASSES.map((c) => c.name)).toEqual(['Guerrier', 'Mage', 'Voleur'])
    })

    it.each(MONSTERS.map((m) => [m.name, m] as const))('monstre %s : statistiques, XP et butin (§8)', (name, m) => {
        const [, level, hp, attack, defense, speed, xp, lootCell] = tableRow(name)
        expect([m.level, m.hp, m.attack, m.defense, m.speed, m.xpReward]).toEqual(
            [level, hp, attack, defense, speed, xp].map((cell) => toInt(cell ?? ''))
        )
        const expectedLoot = parseLoot(lootCell ?? '')
        const loot = LOOT.find((entry) => entry.monsterCode === m.code)
        const item = ITEMS.find((i) => i.code === loot?.itemCode)
        expect(item?.name).toBe(expectedLoot.name)
        expect(loot?.dropChanceBp).toBe(expectedLoot.bp)
    })

    it('exactement les 3 monstres du MVP', () => {
        expect(MONSTERS.map((m) => m.name)).toEqual(['Loup', 'Sanglier', 'Bandit'])
    })

    it('zone de départ : Clairière, niveaux 1 à 3, avec les 3 monstres (§8)', () => {
        const match = /Zone de départ : \*\*(.+)\*\*, niveaux (\d+) à (\d+)\./.exec(RULES)
        expect(ZONES).toHaveLength(1)
        expect(ZONES[0]).toEqual({
            code: STARTING_ZONE_CODE,
            name: match?.[1],
            minLevel: Number(match?.[2]),
            maxLevel: Number(match?.[3]),
            monsterCodes: MONSTERS.map((m) => m.code)
        })
    })

    it('objets : 3 matériaux empilables, sans effet (§8)', () => {
        expect(RULES).toContain('Les trois objets sont des matériaux empilables')
        expect(ITEMS).toHaveLength(3)
        expect(ITEMS.every((i) => i.type === 'MATERIAL' && i.stackable)).toBe(true)
    })
})

describe('Données de référence : cohérence interne', () => {
    it.each([
        ['classes', CLASSES.map((c) => c.code)],
        ['zones', ZONES.map((z) => z.code)],
        ['monstres', MONSTERS.map((m) => m.code)],
        ['objets', ITEMS.map((i) => i.code)]
    ])('codes de %s uniques et en minuscules', (_label, codes) => {
        expect(new Set(codes).size).toBe(codes.length)
        codes.forEach((code) => expect(code).toMatch(/^[a-z][a-z_]*$/))
    })

    it('le butin et les zones ne référencent que des codes existants', () => {
        const monsterCodes = new Set(MONSTERS.map((m) => m.code))
        const itemCodes = new Set(ITEMS.map((i) => i.code))
        LOOT.forEach((entry) => {
            expect(monsterCodes.has(entry.monsterCode)).toBe(true)
            expect(itemCodes.has(entry.itemCode)).toBe(true)
        })
        ZONES.forEach((zone) => zone.monsterCodes.forEach((code) => expect(monsterCodes.has(code)).toBe(true)))
    })

    it('au plus un objet de butin par monstre, probabilité entre 0 et 10 000 points de base (§7)', () => {
        expect(new Set(LOOT.map((entry) => entry.monsterCode)).size).toBe(LOOT.length)
        LOOT.forEach((entry) => {
            expect(Number.isInteger(entry.dropChanceBp)).toBe(true)
            expect(entry.dropChanceBp).toBeGreaterThanOrEqual(0)
            expect(entry.dropChanceBp).toBeLessThanOrEqual(10000)
        })
    })

    it('respecte les bornes des contraintes CHECK de la migration', () => {
        CLASSES.forEach((c) => {
            expect(c.baseHp).toBeGreaterThanOrEqual(1)
            ;[c.baseMana, c.baseAttack, c.baseDefense, c.baseSpeed, c.hpPerLevel, c.manaPerLevel,
                c.attackPerLevel, c.defensePerLevel, c.speedPerLevel].forEach((value) => {
                expect(Number.isInteger(value) && value >= 0).toBe(true)
            })
        })
        MONSTERS.forEach((m) => {
            expect(m.level).toBeGreaterThanOrEqual(1)
            expect(m.hp).toBeGreaterThanOrEqual(1)
        })
        ZONES.forEach((z) => expect(z.minLevel >= 1 && z.maxLevel >= z.minLevel).toBe(true))
    })
})
