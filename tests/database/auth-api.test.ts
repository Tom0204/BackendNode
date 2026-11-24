import argon2 from 'argon2'
import type { Express } from 'express'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Database } from '../../src/database/client'
import { expectErrorResponse, expectSuccessResponse } from '../helpers/http'
import { deleteAllPlayerData } from '../helpers/player-fixtures'
import { requireSafeTestDatabaseUrl } from '../helpers/test-database'

/* Inscription (AUTH-01, AUTH-03, AUTH-04) branchée comme dans server.ts : PostgreSQL (mmorpg_test) et Argon2id réel.
 * La persistance est vérifiée avec deux instances d'application indépendantes : modules rechargés,
 * pool, client Prisma et application neufs ; la première connexion est fermée avant que la seconde ne lise.
 */

const REGISTER = '/api/v1/auth/register'
const PASSWORD = 'correct horse battery staple'

interface AppInstance {
    app: Express
    database: Database
}

// Construit une instance complète, comme server.ts : connexion → repository Prisma + Argon2id → service → application.
async function startAppInstance(): Promise<AppInstance> {
    vi.resetModules()
    const { createDatabase } = await import('../../src/database/client')
    const { createPrismaUserRepository } = await import('../../src/repositories/user.repository')
    const { createAuthService } = await import('../../src/services/auth.service')
    const { createArgon2PasswordHasher } = await import('../../src/services/password-hasher')
    const { createApp } = await import('../../src/app')
    const database = createDatabase(requireSafeTestDatabaseUrl())
    const authService = createAuthService({
        userRepository: createPrismaUserRepository(database.prisma),
        passwordHasher: createArgon2PasswordHasher()
    })
    return { app: createApp({ authService }), database }
}

async function stopAppInstance({ database }: AppInstance): Promise<void> {
    const { closeDatabase } = await import('../../src/database/client')
    await closeDatabase(database)
}

let first: AppInstance

beforeAll(async () => {
    first = await startAppInstance()
    // Aucune donnée de joueur au départ ; les données de référence restent en place.
    await deleteAllPlayerData(first.database.prisma)
})

afterAll(async () => {
    const cleanup = await startAppInstance()
    await deleteAllPlayerData(cleanup.database.prisma)
    await stopAppInstance(cleanup)
})

describe('Inscription sur PostgreSQL avec Argon2id', () => {
    let aliceId: string

    it('première instance : 201, compte enregistré avec un hash Argon2id vérifiable', async () => {
        const response = await request(first.app).post(REGISTER).send({ name: 'Alice', email: 'Alice@Example.com', password: PASSWORD })

        expectSuccessResponse(response, 201, 'User registered successfully', {
            id: expect.any(String),
            name: 'Alice',
            email: 'alice@example.com',
            role: 'PLAYER'
        })
        aliceId = response.body.data.id

        const row = await first.database.prisma.user.findUniqueOrThrow({ where: { id: aliceId } })
        expect(row).toMatchObject({ email: 'alice@example.com', role: 'PLAYER' })
        expect(row.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
        expect(row.passwordHash).not.toContain(PASSWORD)
        expect(await argon2.verify(row.passwordHash, PASSWORD)).toBe(true)
        expect(await argon2.verify(row.passwordHash, 'wrong horse battery staple')).toBe(false)
        expect(response.text).not.toContain(row.passwordHash)
        expect(response.text).not.toContain(PASSWORD)
    })

    it('même mot de passe pour deux comptes : deux hashs différents en base', async () => {
        const bob = await request(first.app).post(REGISTER).send({ name: 'Bob', email: 'bob@example.com', password: PASSWORD })
        expect(bob.status).toBe(201)

        const rows = await first.database.prisma.user.findMany({ select: { passwordHash: true } })
        expect(rows).toHaveLength(2)
        expect(rows[0]?.passwordHash).not.toBe(rows[1]?.passwordHash)
    })

    it('seconde instance indépendante, après fermeture de la première : le compte persiste et son email reste pris', async () => {
        await stopAppInstance(first)
        const second = await startAppInstance()
        try {
            expect(second.app).not.toBe(first.app)
            expect(second.database.pool).not.toBe(first.database.pool)

            expectErrorResponse(
                await request(second.app).post(REGISTER).send({ name: 'Copie', email: 'ALICE@example.com', password: 'another strong password' }),
                409,
                'EMAIL_ALREADY_USED',
                []
            )
            expect(await second.database.prisma.user.count()).toBe(2)
            expect(await second.database.prisma.user.findUnique({ where: { id: aliceId } })).toMatchObject({ name: 'Alice' })

            expectErrorResponse(
                await request(second.app).post(REGISTER).send({ name: 'Court', email: 'court@example.com', password: 'a'.repeat(14) }),
                400,
                'VALIDATION_ERROR',
                [{ field: 'password', message: 'Must be at least 15 characters' }]
            )
            expect(await second.database.prisma.user.count()).toBe(2)
        } finally {
            await stopAppInstance(second)
        }
    })
})
