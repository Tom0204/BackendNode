import type { Express } from 'express'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Database } from '../../src/database/client'
import { expectErrorResponse, expectSuccessResponse } from '../helpers/http'
import { requireSafeTestDatabaseUrl } from '../helpers/test-database'
import { UNKNOWN_USER_ID } from '../helpers/user-repository-contract'

/* API /api/v1/users branchée sur PostgreSQL (mmorpg_test), comme dans server.ts (DB-04).
 * La persistance est démontrée avec deux instances d'application indépendantes :
 * modules rechargés, pool, client Prisma et application neufs ; la première connexion est fermée
 * avant que la seconde instance relise les données.
 */

const USERS = '/api/v1/users'

interface AppInstance {
    app: Express
    database: Database
}

// Construit une instance complète, comme server.ts : connexion → repository Prisma → service → application.
async function startAppInstance(): Promise<AppInstance> {
    vi.resetModules()
    const { createDatabase } = await import('../../src/database/client')
    const { createPrismaUserRepository } = await import('../../src/repositories/user.repository')
    const { createUserService } = await import('../../src/services/user.service')
    const { createApp } = await import('../../src/app')
    const database = createDatabase(requireSafeTestDatabaseUrl())
    const app = createApp({ userService: createUserService(createPrismaUserRepository(database.prisma)) })
    return { app, database }
}

async function stopAppInstance({ database }: AppInstance): Promise<void> {
    const { closeDatabase } = await import('../../src/database/client')
    await closeDatabase(database)
}

let first: AppInstance

beforeAll(async () => {
    first = await startAppInstance()
    // Table users vide au départ (les personnages suivent par cascade).
    await first.database.prisma.user.deleteMany()
})

afterAll(async () => {
    const cleanup = await startAppInstance()
    await cleanup.database.prisma.user.deleteMany()
    await stopAppInstance(cleanup)
})

describe('API utilisateurs sur PostgreSQL', () => {
    let aliceId: string
    let bobId: string

    it('première instance : crée et modifie des utilisateurs', async () => {
        const alice = await request(first.app).post(USERS).send({ name: 'Alice', email: 'Alice@Example.com' })
        expectSuccessResponse(alice, 201, 'User created successfully')
        expect(alice.body.data.email).toBe('alice@example.com')
        aliceId = alice.body.data.id

        const bob = await request(first.app).post(USERS).send({ name: 'Bob', email: 'bob@example.com' })
        bobId = bob.body.data.id

        expectSuccessResponse(
            await request(first.app).patch(`${USERS}/${bobId}`).send({ name: 'Robert' }),
            200,
            'User updated successfully',
            { id: bobId, name: 'Robert', email: 'bob@example.com' }
        )
        expectErrorResponse(
            await request(first.app).post(USERS).send({ name: 'Copie', email: 'ALICE@example.com' }),
            409,
            'EMAIL_ALREADY_USED',
            []
        )
    })

    it('seconde instance indépendante, après fermeture de la première : les données sont toujours là', async () => {
        await stopAppInstance(first)
        const second = await startAppInstance()
        try {
            expect(second.app).not.toBe(first.app)
            expect(second.database.pool).not.toBe(first.database.pool)

            expectSuccessResponse(await request(second.app).get(`${USERS}/${aliceId}`), 200, 'User retrieved successfully', {
                id: aliceId,
                name: 'Alice',
                email: 'alice@example.com'
            })
            // L'ordre (createdAt puis id) est vérifié par le contrat du repository ; ici, seul le contenu compte.
            const list = await request(second.app).get(USERS)
            expect(list.body.data).toHaveLength(2)
            expect(list.body.data).toEqual(
                expect.arrayContaining([
                    { id: aliceId, name: 'Alice', email: 'alice@example.com' },
                    { id: bobId, name: 'Robert', email: 'bob@example.com' }
                ])
            )

            expect((await request(second.app).delete(`${USERS}/${bobId}`)).status).toBe(204)
            expectErrorResponse(await request(second.app).get(`${USERS}/${bobId}`), 404, 'USER_NOT_FOUND', [])
            expectErrorResponse(await request(second.app).get(`${USERS}/${UNKNOWN_USER_ID}`), 404, 'USER_NOT_FOUND', [])
            expectErrorResponse(await request(second.app).get(`${USERS}/1`), 400, 'VALIDATION_ERROR')
        } finally {
            await stopAppInstance(second)
        }
    })
})
