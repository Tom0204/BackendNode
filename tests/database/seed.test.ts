import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDatabase, createDatabase, type Database } from '../../src/database/client'
import { CLASSES, ITEMS, LOOT, MONSTERS, ZONES } from '../../prisma/seed/reference-data'
import { seedReferenceData } from '../../prisma/seed/seed'
import { createTestCharacter, createTestUser, deleteAllPlayerData } from '../helpers/player-fixtures'
import { requireSafeTestDatabaseUrl } from '../helpers/test-database'

/* Seed idempotent des données de référence (DB-03), vérifié sur mmorpg_test.
 * global-setup.ts a déjà exécuté le seed une fois : ces tests le relancent.
 */

let database: Database

async function countReferenceRows() {
    const { prisma } = database
    return {
        classes: await prisma.characterClass.count(),
        zones: await prisma.zone.count(),
        monsters: await prisma.monster.count(),
        zoneMonsters: await prisma.zoneMonster.count(),
        items: await prisma.item.count(),
        lootEntries: await prisma.lootEntry.count()
    }
}

const EXPECTED_COUNTS = {
    classes: CLASSES.length,
    zones: ZONES.length,
    monsters: MONSTERS.length,
    zoneMonsters: ZONES.reduce((total, zone) => total + zone.monsterCodes.length, 0),
    items: ITEMS.length,
    lootEntries: LOOT.length
}

beforeAll(() => {
    database = createDatabase(requireSafeTestDatabaseUrl())
})

afterAll(async () => {
    await deleteAllPlayerData(database.prisma)
    await closeDatabase(database)
})

describe('seedReferenceData', () => {
    it('relancé deux fois, ne crée aucun doublon', async () => {
        const first = await seedReferenceData(database.prisma)
        const second = await seedReferenceData(database.prisma)
        expect(first).toEqual(EXPECTED_COUNTS)
        expect(second).toEqual(EXPECTED_COUNTS)
        expect(await countReferenceRows()).toEqual(EXPECTED_COUNTS)
    })

    it('conserve les identifiants existants (mise à jour selon le code)', async () => {
        const before = await database.prisma.characterClass.findMany({ select: { code: true, id: true }, orderBy: { code: 'asc' } })
        await seedReferenceData(database.prisma)
        const after = await database.prisma.characterClass.findMany({ select: { code: true, id: true }, orderBy: { code: 'asc' } })
        expect(after).toEqual(before)
    })

    it('remet les valeurs de référence modifiées', async () => {
        await database.prisma.monster.update({ where: { code: 'wolf' }, data: { hp: 999, xpReward: 1 } })
        await seedReferenceData(database.prisma)
        const wolf = await database.prisma.monster.findUniqueOrThrow({ where: { code: 'wolf' } })
        expect(wolf).toMatchObject({ hp: 40, xpReward: 25 })
    })

    it('enregistre exactement les valeurs de reference-data.ts', async () => {
        const classes = await database.prisma.characterClass.findMany({ orderBy: { code: 'asc' } })
        expect(classes.map(({ id: _id, createdAt: _c, updatedAt: _u, ...data }) => data)).toEqual(
            [...CLASSES].sort((a, b) => a.code.localeCompare(b.code))
        )
        const loot = await database.prisma.lootEntry.findMany({ include: { monster: true, item: true } })
        expect(
            loot.map((entry) => ({ monsterCode: entry.monster.code, itemCode: entry.item.code, dropChanceBp: entry.dropChanceBp }))
                .sort((a, b) => a.monsterCode.localeCompare(b.monsterCode))
        ).toEqual([...LOOT].sort((a, b) => a.monsterCode.localeCompare(b.monsterCode)))
        const zone = await database.prisma.zone.findUniqueOrThrow({ where: { code: 'clearing' }, include: { monsters: { include: { monster: true } } } })
        expect(zone.monsters.map((link) => link.monster.code).sort()).toEqual([...(ZONES[0]?.monsterCodes ?? [])].sort())
    })

    it("ne touche pas aux données des joueurs", async () => {
        const user = await createTestUser(database.prisma)
        const character = await createTestCharacter(database.prisma, user.id, 'Thrall', { level: 3, experience: 50 })
        await seedReferenceData(database.prisma)
        const reloaded = await database.prisma.character.findUniqueOrThrow({ where: { id: character.id } })
        expect(reloaded).toMatchObject({ level: 3, experience: 50, classId: character.classId })
    })
})
