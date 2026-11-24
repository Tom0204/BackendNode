import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { STARTING_ZONE_CODE } from '../../src/config/gameplay'
import { closeDatabase, createDatabase, type Database } from '../../src/database/client'
import { createPrismaCharacterRepository, type CharacterRepository } from '../../src/repositories/character.repository'
import { isReferenceNotFoundError, isUniqueConstraintError } from '../../src/repositories/errors'
import { createPrismaUserRepository, type UserRepository } from '../../src/repositories/user.repository'
import type { User } from '../../src/types/user'
import { deleteAllPlayerData } from '../helpers/player-fixtures'
import { requireSafeTestDatabaseUrl } from '../helpers/test-database'
import { newUser, UNKNOWN_USER_ID } from '../helpers/user-repository-contract'

/* Repository des personnages (DB-04), sur mmorpg_test.
 * Vérifie la correspondance avec le schéma et data-model.md : normalized_name = lower(name), nom unique
 * sans tenir compte de la casse, niveau 1 et XP 0 par défaut, zone de départ attribuée par le serveur.
 */

let database: Database
let characters: CharacterRepository
let users: UserRepository
let owner: User
let warriorId: string
let mageId: string

beforeAll(async () => {
    database = createDatabase(requireSafeTestDatabaseUrl())
    characters = createPrismaCharacterRepository(database.prisma)
    users = createPrismaUserRepository(database.prisma)
    warriorId = (await database.prisma.characterClass.findUniqueOrThrow({ where: { code: 'warrior' } })).id
    mageId = (await database.prisma.characterClass.findUniqueOrThrow({ where: { code: 'mage' } })).id
})

beforeEach(async () => {
    await deleteAllPlayerData(database.prisma)
    owner = await users.create(newUser('Owner', 'owner@test.local'))
})

afterAll(async () => {
    await deleteAllPlayerData(database.prisma)
    await closeDatabase(database)
})

describe('CharacterRepository.create', () => {
    it('crée un personnage niveau 1, XP 0, dans la zone de départ', async () => {
        const character = await characters.create({ userId: owner.id, classId: warriorId, name: 'Arthas' })
        const startingZone = await database.prisma.zone.findUniqueOrThrow({ where: { code: STARTING_ZONE_CODE } })

        expect(character).toMatchObject({
            userId: owner.id,
            classId: warriorId,
            currentZoneId: startingZone.id,
            name: 'Arthas',
            level: 1,
            experience: 0
        })
        expect(character.createdAt).toBeInstanceOf(Date)
    })

    it('enregistre normalized_name = lower(name), sans l’exposer dans le type renvoyé', async () => {
        const character = await characters.create({ userId: owner.id, classId: warriorId, name: 'ArThAs' })
        const row = await database.prisma.character.findUniqueOrThrow({ where: { id: character.id } })

        expect(row.normalizedName).toBe('arthas')
        expect(character).not.toHaveProperty('normalizedName')
        expect(character.name).toBe('ArThAs')
    })

    it('refuse un nom déjà pris avec une autre casse : UniqueConstraintError("name")', async () => {
        await characters.create({ userId: owner.id, classId: warriorId, name: 'Arthas' })
        const other = await users.create(newUser('Other', 'other@test.local'))

        const error = await characters.create({ userId: other.id, classId: mageId, name: 'ARTHAS' }).catch((e: unknown) => e)

        expect(isUniqueConstraintError(error)).toBe(true)
        expect(error).toMatchObject({ field: 'name' })
        expect(await characters.countByUserId(other.id)).toBe(0)
    })

    it('utilisateur inexistant : ReferenceNotFoundError', async () => {
        const error = await characters.create({ userId: UNKNOWN_USER_ID, classId: warriorId, name: 'Arthas' }).catch((e: unknown) => e)
        expect(isReferenceNotFoundError(error)).toBe(true)
    })

    it('classe inexistante : ReferenceNotFoundError', async () => {
        const error = await characters.create({ userId: owner.id, classId: UNKNOWN_USER_ID, name: 'Arthas' }).catch((e: unknown) => e)
        expect(isReferenceNotFoundError(error)).toBe(true)
    })
})

describe('CharacterRepository : lectures', () => {
    it('findById : renvoie le personnage, ou undefined s’il est inconnu', async () => {
        const character = await characters.create({ userId: owner.id, classId: warriorId, name: 'Arthas' })
        expect(await characters.findById(character.id)).toEqual(character)
        expect(await characters.findById(UNKNOWN_USER_ID)).toBeUndefined()
    })

    it('findAllByUserId : uniquement les personnages de cet utilisateur, triés par création puis identifiant', async () => {
        const other = await users.create(newUser('Other', 'other@test.local'))
        await characters.create({ userId: owner.id, classId: warriorId, name: 'Arthas' })
        await characters.create({ userId: other.id, classId: warriorId, name: 'Thrall' })
        await characters.create({ userId: owner.id, classId: mageId, name: 'Jaina' })

        const list = await characters.findAllByUserId(owner.id)
        const expectedOrder = [...list].sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
        )
        expect(list.map((c) => c.name).sort()).toEqual(['Arthas', 'Jaina'])
        expect(list.map((c) => c.id)).toEqual(expectedOrder.map((c) => c.id))
        expect(await characters.findAllByUserId(UNKNOWN_USER_ID)).toEqual([])
    })

    it('countByUserId : compte les personnages de l’utilisateur (limite de 5 appliquée en CHAR-03)', async () => {
        expect(await characters.countByUserId(owner.id)).toBe(0)
        await characters.create({ userId: owner.id, classId: warriorId, name: 'Arthas' })
        await characters.create({ userId: owner.id, classId: mageId, name: 'Jaina' })
        expect(await characters.countByUserId(owner.id)).toBe(2)
    })

    it('supprimer l’utilisateur par son repository supprime ses personnages (cascade)', async () => {
        const character = await characters.create({ userId: owner.id, classId: warriorId, name: 'Arthas' })
        expect(await users.delete(owner.id)).toBe(true)
        expect(await characters.findById(character.id)).toBeUndefined()
    })
})
