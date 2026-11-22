import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { checkDatabaseConnection, closeDatabase, createDatabase, type Database } from '../../src/database/client'
import { requireSafeTestDatabaseUrl, TEST_DATABASE_NAME } from '../helpers/test-database'

// Nécessite PostgreSQL (npm run db:up) : lancé uniquement par npm run test:db.
describe('Base de test PostgreSQL (DB-01)', () => {
    let database: Database

    beforeAll(() => {
        database = createDatabase(requireSafeTestDatabaseUrl())
    })

    afterAll(async () => {
        await closeDatabase(database)
    })

    it('la vérification de connexion du démarrage réussit', async () => {
        await expect(checkDatabaseConnection(database.pool)).resolves.toBeUndefined()
    })

    it('se connecte à la base mmorpg_test', async () => {
        const rows = await database.prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`
        expect(rows[0]?.name).toBe(TEST_DATABASE_NAME)
    })

    it('génère des UUID v7 avec uuidv7() (PostgreSQL 18)', async () => {
        const rows = await database.prisma.$queryRaw<{ id: string }[]>`SELECT uuidv7()::text AS id`
        expect(rows[0]?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    })
})
