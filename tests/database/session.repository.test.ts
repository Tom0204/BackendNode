import { afterAll, beforeAll, beforeEach } from 'vitest'
import { closeDatabase, createDatabase, type Database } from '../../src/database/client'
import { createPrismaSessionRepository } from '../../src/repositories/session.repository'
import { createPrismaUserRepository } from '../../src/repositories/user.repository'
import { deleteAllPlayerData } from '../helpers/player-fixtures'
import { describeSessionRepositoryContract } from '../helpers/session-repository-contract'
import { requireSafeTestDatabaseUrl } from '../helpers/test-database'

/* Repository de sessions Prisma (AUTH-05), sur mmorpg_test : même contrat que le repository en mémoire.
 * Le cas « compte supprimé » y vérifie la suppression en cascade réelle de PostgreSQL.
 */

let database: Database

beforeAll(() => {
    database = createDatabase(requireSafeTestDatabaseUrl())
})

// Déclaré avant la suite de contrat : chaque test part de tables users et sessions vides.
beforeEach(async () => {
    await deleteAllPlayerData(database.prisma)
})

afterAll(async () => {
    await deleteAllPlayerData(database.prisma)
    await closeDatabase(database)
})

describeSessionRepositoryContract('Prisma (PostgreSQL)', () => ({
    users: createPrismaUserRepository(database.prisma),
    sessions: createPrismaSessionRepository(database.prisma)
}))
