import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { closeDatabase, createDatabase, type Database } from '../../src/database/client'
import type { Prisma } from '../../src/generated/prisma/client'
import { STARTING_ZONE_CODE } from '../../prisma/seed/reference-data'
import { createTestCharacter, createTestUser, databaseViolation, deleteAllPlayerData } from '../helpers/player-fixtures'
import { requireSafeTestDatabaseUrl } from '../helpers/test-database'

/* Contraintes du modèle relationnel (DB-02), vérifiées sur mmorpg_test.
 * Les données de référence sont posées par le seed (global-setup) ; les données de joueurs
 * sont créées par chaque test puis supprimées.
 */

// Codes SQLSTATE de PostgreSQL.
const CHECK_VIOLATION = '23514'
const UNIQUE_VIOLATION = '23505'
// Suppression bloquée par ON DELETE RESTRICT (et non 23503, réservé aux références invalides).
const RESTRICT_VIOLATION = '23001'
const NOT_NULL_VIOLATION = '23502'

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

let database: Database
const ROLLBACK = new Error('rollback volontaire')

/**
 * Exécute une écriture dans une transaction toujours annulée, et renvoie la violation obtenue.
 * Si l'écriture réussit (contrainte absente), la transaction est annulée quand même : aucune donnée
 * de référence ne peut être supprimée par erreur, et le test échoue avec un message clair.
 */
async function violationOf(write: (tx: Prisma.TransactionClient) => Promise<unknown>) {
    try {
        await database.prisma.$transaction(async (tx) => {
            await write(tx)
            throw ROLLBACK
        })
    } catch (error) {
        if (error === ROLLBACK) {
            throw new Error("L'écriture a réussi alors qu'une contrainte devait la refuser")
        }
        return databaseViolation(error)
    }
    throw new Error('Transaction terminée sans erreur')
}

beforeAll(() => {
    database = createDatabase(requireSafeTestDatabaseUrl())
})

afterEach(async () => {
    await deleteAllPlayerData(database.prisma)
})

afterAll(async () => {
    await closeDatabase(database)
})

describe('users', () => {
    it("génère un identifiant UUID v7 et les dates", async () => {
        const user = await createTestUser(database.prisma)
        expect(user.id).toMatch(UUID_V7)
        expect(user.createdAt).toBeInstanceOf(Date)
        expect(user.updatedAt).toBeInstanceOf(Date)
    })

    it('refuse un email contenant des majuscules (stockage en minuscules)', async () => {
        const violation = await violationOf((tx) => createTestUser(tx, 'Player@Test.local'))
        expect(violation).toMatchObject({ sqlState: CHECK_VIOLATION })
        expect(violation.message).toContain('users_email_lowercase_check')
    })

    it('refuse un email déjà utilisé', async () => {
        await createTestUser(database.prisma, 'same@test.local')
        const violation = await violationOf((tx) => createTestUser(tx, 'same@test.local'))
        expect(violation).toMatchObject({ sqlState: UNIQUE_VIOLATION })
        expect(violation.message).toContain('users_email_key')
    })
})

describe('characters', () => {
    it('crée un personnage niveau 1, XP 0, dans la Clairière', async () => {
        const user = await createTestUser(database.prisma)
        const character = await createTestCharacter(database.prisma, user.id, 'Arthas')
        const zone = await database.prisma.zone.findUniqueOrThrow({ where: { code: STARTING_ZONE_CODE } })
        expect(character).toMatchObject({ level: 1, experience: 0, currentZoneId: zone.id, normalizedName: 'arthas' })
        expect(character.id).toMatch(UUID_V7)
    })

    it('un utilisateur peut posséder plusieurs personnages', async () => {
        const user = await createTestUser(database.prisma)
        await createTestCharacter(database.prisma, user.id, 'Arthas')
        await createTestCharacter(database.prisma, user.id, 'Jaina', { classCode: 'mage' })
        expect(await database.prisma.character.count({ where: { userId: user.id } })).toBe(2)
    })

    it('refuse un nom déjà pris avec une autre casse', async () => {
        const user = await createTestUser(database.prisma)
        await createTestCharacter(database.prisma, user.id, 'Arthas')
        const violation = await violationOf((tx) => createTestCharacter(tx, user.id, 'ARTHAS'))
        expect(violation).toMatchObject({ sqlState: UNIQUE_VIOLATION })
        expect(violation.message).toContain('characters_normalized_name_key')
    })

    it('refuse un nom normalisé différent de lower(name)', async () => {
        const user = await createTestUser(database.prisma)
        const character = await createTestCharacter(database.prisma, user.id, 'Arthas')
        const violation = await violationOf((tx) =>
            tx.character.update({ where: { id: character.id }, data: { normalizedName: 'autre' } })
        )
        expect(violation).toMatchObject({ sqlState: CHECK_VIOLATION })
        expect(violation.message).toContain('characters_normalized_name_check')
    })

    it.each([
        { label: 'trop court', name: 'Ab' },
        { label: 'trop long', name: 'Abcdefghijklmnopq' },
        { label: 'avec un chiffre', name: 'Arthas2' },
        { label: 'avec un accent', name: 'Élise' },
        { label: 'avec un espace', name: 'Ar thas' }
    ])('refuse un nom $label', async ({ name }) => {
        const user = await createTestUser(database.prisma)
        const violation = await violationOf((tx) => createTestCharacter(tx, user.id, name))
        expect(violation).toMatchObject({ sqlState: CHECK_VIOLATION })
        expect(violation.message).toContain('characters_name_format_check')
    })

    it.each([0, 11])('refuse le niveau %i (bornes 1 à 10)', async (level) => {
        const user = await createTestUser(database.prisma)
        const violation = await violationOf((tx) => createTestCharacter(tx, user.id, 'Arthas', { level }))
        expect(violation.message).toContain('characters_level_check')
    })

    it('accepte les niveaux 1 et 10', async () => {
        const user = await createTestUser(database.prisma)
        await createTestCharacter(database.prisma, user.id, 'Arthas', { level: 1 })
        await expect(createTestCharacter(database.prisma, user.id, 'Jaina', { level: 10 })).resolves.toMatchObject({ level: 10 })
    })

    it("refuse une XP négative", async () => {
        const user = await createTestUser(database.prisma)
        const violation = await violationOf((tx) => createTestCharacter(tx, user.id, 'Arthas', { experience: -1 }))
        expect(violation.message).toContain('characters_experience_check')
    })

    it('exige une zone courante', async () => {
        const user = await createTestUser(database.prisma)
        const warrior = await database.prisma.characterClass.findUniqueOrThrow({ where: { code: 'warrior' } })
        const violation = await violationOf(
            (tx) => tx.$executeRaw`INSERT INTO characters (user_id, class_id, current_zone_id, name, normalized_name, updated_at)
                                   VALUES (${user.id}::uuid, ${warrior.id}::uuid, NULL, 'Arthas', 'arthas', now())`
        )
        expect(violation).toMatchObject({ sqlState: NOT_NULL_VIOLATION })
    })
})

describe('politique de suppression', () => {
    it("supprimer un utilisateur supprime ses personnages (cascade)", async () => {
        const user = await createTestUser(database.prisma)
        await createTestCharacter(database.prisma, user.id, 'Arthas')
        await createTestCharacter(database.prisma, user.id, 'Jaina')
        await database.prisma.user.delete({ where: { id: user.id } })
        expect(await database.prisma.character.count({ where: { userId: user.id } })).toBe(0)
    })

    it('refuse de supprimer une classe utilisée par un personnage', async () => {
        const user = await createTestUser(database.prisma)
        await createTestCharacter(database.prisma, user.id, 'Arthas', { classCode: 'warrior' })
        const violation = await violationOf((tx) => tx.characterClass.delete({ where: { code: 'warrior' } }))
        expect(violation).toMatchObject({ sqlState: RESTRICT_VIOLATION })
        expect(violation.message).toContain('characters_class_id_fkey')
    })

    it('refuse de supprimer la zone courante d’un personnage', async () => {
        const user = await createTestUser(database.prisma)
        await createTestCharacter(database.prisma, user.id, 'Arthas')
        // Les monstres de la zone sont détachés dans la même transaction (annulée) :
        // seule la restriction venant du personnage peut alors bloquer la suppression.
        const violation = await violationOf(async (tx) => {
            const zone = await tx.zone.findUniqueOrThrow({ where: { code: STARTING_ZONE_CODE } })
            await tx.zoneMonster.deleteMany({ where: { zoneId: zone.id } })
            await tx.zone.delete({ where: { id: zone.id } })
        })
        expect(violation).toMatchObject({ sqlState: RESTRICT_VIOLATION })
        expect(violation.message).toContain('characters_current_zone_id_fkey')
    })

    it('refuse de supprimer une zone qui contient des monstres', async () => {
        const violation = await violationOf((tx) => tx.zone.delete({ where: { code: STARTING_ZONE_CODE } }))
        expect(violation).toMatchObject({ sqlState: RESTRICT_VIOLATION })
        expect(violation.message).toContain('zone_monsters_zone_id_fkey')
    })

    it('refuse de supprimer un monstre présent dans une zone', async () => {
        const violation = await violationOf((tx) => tx.monster.delete({ where: { code: 'wolf' } }))
        expect(violation).toMatchObject({ sqlState: RESTRICT_VIOLATION })
        expect(violation.message).toMatch(/zone_monsters_monster_id_fkey|loot_entries_monster_id_fkey/)
    })

    it('refuse de supprimer un monstre qui a une entrée de butin', async () => {
        const violation = await violationOf(async (tx) => {
            const wolf = await tx.monster.findUniqueOrThrow({ where: { code: 'wolf' } })
            await tx.zoneMonster.deleteMany({ where: { monsterId: wolf.id } })
            await tx.monster.delete({ where: { id: wolf.id } })
        })
        expect(violation).toMatchObject({ sqlState: RESTRICT_VIOLATION })
        expect(violation.message).toContain('loot_entries_monster_id_fkey')
    })

    it('refuse de supprimer un objet utilisé par une entrée de butin', async () => {
        const violation = await violationOf((tx) => tx.item.delete({ where: { code: 'wolf_pelt' } }))
        expect(violation).toMatchObject({ sqlState: RESTRICT_VIOLATION })
        expect(violation.message).toContain('loot_entries_item_id_fkey')
    })
})

describe('données de référence', () => {
    it.each([
        { label: 'PV de classe nuls', write: (tx: Prisma.TransactionClient) => tx.characterClass.update({ where: { code: 'mage' }, data: { baseHp: 0 } }), constraint: 'character_classes_base_stats_check' },
        { label: 'gain par niveau négatif', write: (tx: Prisma.TransactionClient) => tx.characterClass.update({ where: { code: 'mage' }, data: { attackPerLevel: -1 } }), constraint: 'character_classes_growth_check' },
        { label: 'plage de niveaux de zone inversée', write: (tx: Prisma.TransactionClient) => tx.zone.update({ where: { code: STARTING_ZONE_CODE }, data: { minLevel: 4 } }), constraint: 'zones_level_range_check' },
        { label: 'statistique de monstre négative', write: (tx: Prisma.TransactionClient) => tx.monster.update({ where: { code: 'boar' }, data: { defense: -1 } }), constraint: 'monsters_stats_check' },
        { label: 'probabilité de butin supérieure à 10 000', write: async (tx: Prisma.TransactionClient) => {
            const wolf = await tx.monster.findUniqueOrThrow({ where: { code: 'wolf' } })
            return tx.lootEntry.update({ where: { monsterId: wolf.id }, data: { dropChanceBp: 10001 } })
        }, constraint: 'loot_entries_drop_chance_check' }
    ])('refuse : $label', async ({ write, constraint }) => {
        const violation = await violationOf(write)
        expect(violation).toMatchObject({ sqlState: CHECK_VIOLATION })
        expect(violation.message).toContain(constraint)
    })

    it('refuse une deuxième entrée de butin pour un même monstre', async () => {
        const violation = await violationOf(async (tx) => {
            const wolf = await tx.monster.findUniqueOrThrow({ where: { code: 'wolf' } })
            const tusk = await tx.item.findUniqueOrThrow({ where: { code: 'boar_tusk' } })
            await tx.lootEntry.create({ data: { monsterId: wolf.id, itemId: tusk.id, dropChanceBp: 100 } })
        })
        expect(violation).toMatchObject({ sqlState: UNIQUE_VIOLATION })
        expect(violation.message).toContain('loot_entries_pkey')
    })
})
