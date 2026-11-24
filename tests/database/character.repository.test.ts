import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { CHARACTER_NAME_PATTERN, MAX_CHARACTERS_PER_ACCOUNT, STARTING_ZONE_CODE } from '../../src/config/gameplay'
import { closeDatabase, createDatabase, type Database } from '../../src/database/client'
import { createPrismaCharacterClassRepository } from '../../src/repositories/character-class.repository'
import { createPrismaCharacterRepository, type CharacterRepository } from '../../src/repositories/character.repository'
import { isLimitReachedError, isUniqueConstraintError } from '../../src/repositories/errors'
import { createPrismaUserRepository, type UserRepository } from '../../src/repositories/user.repository'
import { characterNameSchema } from '../../src/schemas/character.schema'
import type { User } from '../../src/types/user'
import {
    describeCharacterClassRepositoryContract,
    describeCharacterRepositoryContract
} from '../helpers/character-repository-contract'
import { createTestUser, databaseViolation, deleteAllPlayerData } from '../helpers/player-fixtures'
import { requireSafeTestDatabaseUrl } from '../helpers/test-database'
import { newUser } from '../helpers/user-repository-contract'

/* Repositories des personnages et des classes (DB-04, CHAR-01 à CHAR-05), sur mmorpg_test.
 * Mêmes contrats que les repositories en mémoire, plus ce que seul PostgreSQL permet de vérifier :
 * créations simultanées, annulation de la transaction, correspondance entre Zod et la contrainte SQL du nom.
 */

let database: Database

beforeAll(() => {
    database = createDatabase(requireSafeTestDatabaseUrl())
})

// Déclaré avant les suites de contrat : chaque test part de tables de joueurs vides.
beforeEach(async () => {
    await deleteAllPlayerData(database.prisma)
})

afterAll(async () => {
    await deleteAllPlayerData(database.prisma)
    await closeDatabase(database)
})

describeCharacterRepositoryContract('Prisma (PostgreSQL)', () => ({
    users: createPrismaUserRepository(database.prisma),
    classes: createPrismaCharacterClassRepository(database.prisma),
    characters: createPrismaCharacterRepository(database.prisma),
    startingZoneId: async () => (await database.prisma.zone.findUniqueOrThrow({ where: { code: STARTING_ZONE_CODE } })).id
}))

describeCharacterClassRepositoryContract('Prisma (PostgreSQL)', () => createPrismaCharacterClassRepository(database.prisma))

describe('CharacterRepository Prisma : spécificités PostgreSQL', () => {
    let characters: CharacterRepository
    let users: UserRepository
    let owner: User
    let classId: string

    beforeEach(async () => {
        characters = createPrismaCharacterRepository(database.prisma)
        users = createPrismaUserRepository(database.prisma)
        owner = await users.create(newUser('Owner', 'owner@test.local'))
        classId = (await database.prisma.characterClass.findUniqueOrThrow({ where: { code: 'warrior' } })).id
    })

    it('enregistre normalized_name = lower(name), sans l’exposer', async () => {
        const character = await characters.createWithinLimit({ userId: owner.id, classId, name: 'ArThAs' }, MAX_CHARACTERS_PER_ACCOUNT)
        const row = await database.prisma.character.findUniqueOrThrow({ where: { id: character.id } })
        expect(row.normalizedName).toBe('arthas')
        expect(character).not.toHaveProperty('normalizedName')
    })

    it(`créations simultanées sur un même compte : exactement ${MAX_CHARACTERS_PER_ACCOUNT} réussissent`, async () => {
        const names = ['Arthas', 'Jaina', 'Thrall', 'Sylvanas', 'Uther', 'Varian', 'Anduin', 'Garrosh']
        const results = await Promise.allSettled(
            names.map((name) => characters.createWithinLimit({ userId: owner.id, classId, name }, MAX_CHARACTERS_PER_ACCOUNT))
        )

        const fulfilled = results.filter((result) => result.status === 'fulfilled')
        const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        expect(fulfilled).toHaveLength(MAX_CHARACTERS_PER_ACCOUNT)
        expect(rejected).toHaveLength(names.length - MAX_CHARACTERS_PER_ACCOUNT)
        expect(rejected.every((result) => isLimitReachedError(result.reason))).toBe(true)
        expect(await database.prisma.character.count({ where: { userId: owner.id } })).toBe(MAX_CHARACTERS_PER_ACCOUNT)
    })

    it('créations simultanées du même nom par deux comptes : une seule réussit', async () => {
        const other = await users.create(newUser('Other', 'other@test.local'))
        const results = await Promise.allSettled([
            characters.createWithinLimit({ userId: owner.id, classId, name: 'Arthas' }, MAX_CHARACTERS_PER_ACCOUNT),
            characters.createWithinLimit({ userId: other.id, classId, name: 'ARTHAS' }, MAX_CHARACTERS_PER_ACCOUNT)
        ])
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
        const failure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
        expect(isUniqueConstraintError(failure?.reason)).toBe(true)
        expect(await database.prisma.character.count()).toBe(1)
    })

    it('échec pendant la transaction (après le verrou et le comptage) : tout est annulé, le verrou est libéré', async () => {
        // Panne simulée au moment de l'insertion, dans une vraie transaction : le verrou sur le compte est déjà pris
        // et le comptage effectué. Le client est enveloppé (Proxy) : seule l'insertion de cette transaction échoue.
        const failure = new Error('panne simulée pendant la transaction')
        const steps: string[] = []
        const failingPrisma = new Proxy(database.prisma, {
            get(target, property) {
                if (property !== '$transaction') {
                    return Reflect.get(target, property)
                }
                return (callback: (tx: unknown) => Promise<unknown>) =>
                    target.$transaction(async (tx) => {
                        const failingCharacter = new Proxy(tx.character, {
                            get(delegate, method) {
                                if (method === 'count') {
                                    steps.push('count')
                                }
                                return method === 'create' ? () => Promise.reject(failure) : Reflect.get(delegate, method)
                            }
                        })
                        const failingTx = new Proxy(tx, {
                            get(client, name) {
                                if (name === '$queryRaw') {
                                    steps.push('lock')
                                }
                                return name === 'character' ? failingCharacter : Reflect.get(client, name)
                            }
                        })
                        return callback(failingTx)
                    })
            }
        })

        const failing = createPrismaCharacterRepository(failingPrisma)
        await expect(failing.createWithinLimit({ userId: owner.id, classId, name: 'Arthas' }, MAX_CHARACTERS_PER_ACCOUNT)).rejects.toBe(failure)
        expect(steps).toEqual(['lock', 'count'])
        expect(await database.prisma.character.count({ where: { userId: owner.id } })).toBe(0)

        // Le verrou est libéré : une nouvelle création aboutit immédiatement, avec le même nom.
        await expect(characters.createWithinLimit({ userId: owner.id, classId, name: 'Arthas' }, MAX_CHARACTERS_PER_ACCOUNT)).resolves.toMatchObject({
            name: 'Arthas'
        })
    })
})

describe('nom de personnage : la validation Zod et la contrainte SQL acceptent exactement les mêmes noms', () => {
    const ROLLBACK = new Error('rollback volontaire')

    // Vrai si PostgreSQL accepte le nom ; l'insertion est toujours annulée.
    async function databaseAccepts(name: string): Promise<boolean> {
        const user = await createTestUser(database.prisma)
        const classId = (await database.prisma.characterClass.findUniqueOrThrow({ where: { code: 'warrior' } })).id
        const zoneId = (await database.prisma.zone.findUniqueOrThrow({ where: { code: STARTING_ZONE_CODE } })).id
        try {
            await database.prisma.$transaction(async (tx) => {
                await tx.character.create({
                    data: { userId: user.id, classId, currentZoneId: zoneId, name, normalizedName: name.toLowerCase() }
                })
                throw ROLLBACK
            })
        } catch (error) {
            if (error === ROLLBACK) {
                return true
            }
            expect(databaseViolation(error).message).toContain('characters_name_format_check')
            return false
        }
        throw new Error('transaction terminée sans erreur')
    }

    it.each([
        'Abc',
        'abc',
        'ABCDEFGHIJKLMNOP',
        'Ab',
        'ABCDEFGHIJKLMNOPQ',
        'Élise',
        'Zoé',
        'Ñandu',
        'ßeta',
        'Arthas2',
        'Art has',
        ' Arthas',
        'Arthas\n',
        'Art-has',
        "Art'has",
        'Arthas_',
        'Ａrthas',
        'Αrthas',
        'Arthаs'
    ])('%j', async (name) => {
        const apiAccepts = characterNameSchema.safeParse(name).success
        expect(apiAccepts).toBe(CHARACTER_NAME_PATTERN.test(name))
        expect(await databaseAccepts(name)).toBe(apiAccepts)
    })
})

describe('compte supprimé', () => {
    it('ses personnages sont supprimés par la base (cascade)', async () => {
        const users = createPrismaUserRepository(database.prisma)
        const characters = createPrismaCharacterRepository(database.prisma)
        const owner = await users.create(newUser('Owner', 'owner@test.local'))
        const classId = (await database.prisma.characterClass.findUniqueOrThrow({ where: { code: 'mage' } })).id
        await characters.createWithinLimit({ userId: owner.id, classId, name: 'Jaina' }, MAX_CHARACTERS_PER_ACCOUNT)

        expect(await users.delete(owner.id)).toBe(true)
        expect(await database.prisma.character.count({ where: { userId: owner.id } })).toBe(0)
    })
})
