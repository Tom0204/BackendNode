import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { closeDatabase, createDatabase, type Database } from '../../src/database/client'
import { createPrismaUserRepository } from '../../src/repositories/user.repository'
import { deleteAllPlayerData } from '../helpers/player-fixtures'
import { requireSafeTestDatabaseUrl } from '../helpers/test-database'
import { CONTRACT_PASSWORD_HASH, describeUserRepositoryContract, newUser } from '../helpers/user-repository-contract'

/* Repository utilisateur Prisma (DB-04), sur mmorpg_test : même contrat que le repository en mémoire. */

let database: Database

beforeAll(() => {
    database = createDatabase(requireSafeTestDatabaseUrl())
})

// Déclaré avant la suite de contrat : chaque test part d'une table users vide.
beforeEach(async () => {
    await deleteAllPlayerData(database.prisma)
})

afterAll(async () => {
    await deleteAllPlayerData(database.prisma)
    await closeDatabase(database)
})

describeUserRepositoryContract('Prisma (PostgreSQL)', () => createPrismaUserRepository(database.prisma))

describe('Repository utilisateur Prisma : spécificités PostgreSQL', () => {
    it('génère des identifiants UUID v7', async () => {
        const user = await createPrismaUserRepository(database.prisma).create(newUser('Alice', 'alice@test.local'))
        expect(user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    })

    it('la base refuse un email non normalisé : le service doit le mettre en minuscules', async () => {
        const repository = createPrismaUserRepository(database.prisma)
        await expect(repository.create(newUser('Alice', 'Alice@test.local'))).rejects.toThrow()
        expect(await repository.findAll()).toEqual([])
    })

    it('enregistre le hash reçu dans password_hash et le rôle PLAYER par défaut, sans les exposer autrement que par le type User', async () => {
        const user = await createPrismaUserRepository(database.prisma).create(newUser('Alice', 'alice@test.local'))
        const row = await database.prisma.user.findUniqueOrThrow({ where: { id: user.id } })
        expect(row).toMatchObject({ passwordHash: CONTRACT_PASSWORD_HASH, role: 'PLAYER' })
        expect(user).not.toHaveProperty('passwordHash')
    })

    it('update modifie updatedAt et conserve createdAt', async () => {
        const repository = createPrismaUserRepository(database.prisma)
        const created = await repository.create(newUser('Alice', 'alice@test.local'))
        await new Promise((resolve) => setTimeout(resolve, 5))
        const updated = await repository.update(created.id, { name: 'Alicia' })
        expect(updated?.createdAt).toEqual(created.createdAt)
        expect(updated?.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime())
    })
})
