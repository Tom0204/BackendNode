import argon2 from 'argon2'
import { createHash } from 'node:crypto'
import type { Express } from 'express'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { EXIT_FAILURE, EXIT_OK, runAccountCommand } from '../../src/cli/account-command'
import type { Database } from '../../src/database/client'
import { createPrismaUserRepository } from '../../src/repositories/user.repository'
import { expectErrorResponse, expectSuccessResponse } from '../helpers/http'
import { createTestCharacter, deleteAllPlayerData } from '../helpers/player-fixtures'
import { requireSafeTestDatabaseUrl } from '../helpers/test-database'

/* Comptes et authentification (AUTH-01 à AUTH-10) branchés comme dans server.ts : PostgreSQL (mmorpg_test), Argon2id réel.
 * La persistance est vérifiée avec deux instances d'application indépendantes : modules rechargés,
 * pool, client Prisma et application neufs ; la première connexion est fermée avant que la seconde ne lise.
 */

const REGISTER = '/api/v1/auth/register'
const LOGIN = '/api/v1/auth/login'
const LOGOUT = '/api/v1/auth/logout'
const USERS = '/api/v1/users'
const ME = `${USERS}/me`
const DAY_MS = 24 * 60 * 60 * 1000
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
    const { createPrismaSessionRepository } = await import('../../src/repositories/session.repository')
    const { createAuthService } = await import('../../src/services/auth.service')
    const { createUserService } = await import('../../src/services/user.service')
    const { createArgon2PasswordHasher } = await import('../../src/services/password-hasher')
    const { createApp } = await import('../../src/app')
    const database = createDatabase(requireSafeTestDatabaseUrl())
    const userRepository = createPrismaUserRepository(database.prisma)
    const authService = createAuthService({
        userRepository,
        sessionRepository: createPrismaSessionRepository(database.prisma),
        passwordHasher: createArgon2PasswordHasher(),
        sessionTtlMs: DAY_MS
    })
    return { app: createApp({ authService, userService: createUserService(userRepository) }), database }
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

describe('Connexion, permissions et déconnexion sur PostgreSQL', () => {
    let instance: AppInstance
    let aliceToken: string

    beforeAll(async () => {
        instance = await startAppInstance()
    })

    afterAll(async () => {
        await stopAppInstance(instance)
    })

    const login = (email: string, password = PASSWORD) => request(instance.app).post(LOGIN).send({ email, password })
    const auth = (token: string) => `Bearer ${token}`
    const silent = { info: () => undefined, error: () => undefined }

    it('connexion : 200, session enregistrée avec la seule empreinte SHA-256 du jeton, expiration à 24 h', async () => {
        const before = Date.now()
        const response = await login('alice@example.com')
        expectSuccessResponse(response, 200, 'Login successful')
        aliceToken = response.body.data.accessToken

        const sessions = await instance.database.prisma.session.findMany({ where: { user: { email: 'alice@example.com' } } })
        expect(sessions).toHaveLength(1)
        expect(sessions[0]?.tokenHash).toBe(createHash('sha256').update(aliceToken).digest('hex'))
        expect(sessions[0]?.tokenHash).not.toContain(aliceToken)
        expect(sessions[0]?.revokedAt).toBeNull()
        const expiresAt = sessions[0]?.expiresAt.getTime() ?? 0
        expect(expiresAt).toBeGreaterThanOrEqual(before + DAY_MS)
        expect(expiresAt).toBeLessThanOrEqual(Date.now() + DAY_MS)
        expect(response.body.data.expiresAt).toBe(sessions[0]?.expiresAt.toISOString())
    })

    it('mauvais mot de passe et email inconnu : 401 générique', async () => {
        expectErrorResponse(await login('alice@example.com', 'wrong horse battery staple'), 401, 'INVALID_CREDENTIALS', [])
        expectErrorResponse(await login('personne@example.com'), 401, 'INVALID_CREDENTIALS', [])
    })

    it('la session survit au redémarrage : une nouvelle instance accepte le jeton', async () => {
        await stopAppInstance(instance)
        instance = await startAppInstance()
        expectSuccessResponse(await request(instance.app).get(ME).set('Authorization', auth(aliceToken)), 200, 'User retrieved successfully', {
            id: expect.any(String),
            name: 'Alice',
            email: 'alice@example.com',
            role: 'PLAYER'
        })
    })

    it('déconnexion : seule la session utilisée est révoquée en base ; l’autre reste valide', async () => {
        const otherToken = (await login('alice@example.com')).body.data.accessToken

        expect((await request(instance.app).post(LOGOUT).set('Authorization', auth(aliceToken))).status).toBe(204)

        expect((await request(instance.app).get(ME).set('Authorization', auth(aliceToken))).status).toBe(401)
        expect((await request(instance.app).get(ME).set('Authorization', auth(otherToken))).status).toBe(200)
        const sessions = await instance.database.prisma.session.findMany({ where: { user: { email: 'alice@example.com' } } })
        expect(sessions.map((session) => session.revokedAt !== null).sort()).toEqual([false, true])
        aliceToken = otherToken
    })

    it('script d’administration (Prisma) : promotion de Bob, qui accède alors à la liste ; Alice reçoit 403', async () => {
        const repository = createPrismaUserRepository(instance.database.prisma)
        expect(await runAccountCommand(['promote', 'bob@example.com'], repository, silent)).toBe(EXIT_OK)

        const bobToken = (await login('bob@example.com')).body.data.accessToken
        const list = await request(instance.app).get(USERS).set('Authorization', auth(bobToken))
        expect(list.status).toBe(200)
        expect(list.body.meta).toEqual({ pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 } })
        expectErrorResponse(await request(instance.app).get(USERS).set('Authorization', auth(aliceToken)), 403, 'FORBIDDEN', [])
    })

    it('script : adresse inconnue → code 1, aucun compte créé', async () => {
        const repository = createPrismaUserRepository(instance.database.prisma)
        const count = await instance.database.prisma.user.count()
        expect(await runAccountCommand(['promote', 'personne@example.com'], repository, silent)).toBe(EXIT_FAILURE)
        expect(await instance.database.prisma.user.count()).toBe(count)
    })

    it('compte désactivé par le script : sessions refusées (401), connexion refusée (403) ; réactivation', async () => {
        const repository = createPrismaUserRepository(instance.database.prisma)

        await runAccountCommand(['disable', 'alice@example.com'], repository, silent)
        expect((await request(instance.app).get(ME).set('Authorization', auth(aliceToken))).status).toBe(401)
        expectErrorResponse(await login('alice@example.com'), 403, 'ACCOUNT_DISABLED', [])

        await runAccountCommand(['enable', 'alice@example.com'], repository, silent)
        expect((await request(instance.app).get(ME).set('Authorization', auth(aliceToken))).status).toBe(200)
    })

    it("joueur qui vise le compte d'un autre : 404, aucune ligne supprimée", async () => {
        const bob = await instance.database.prisma.user.findUniqueOrThrow({ where: { email: 'bob@example.com' } })
        const users = await instance.database.prisma.user.count()
        const sessions = await instance.database.prisma.session.count()

        expectErrorResponse(await request(instance.app).delete(`${USERS}/${bob.id}`).set('Authorization', auth(aliceToken)), 404, 'USER_NOT_FOUND', [])

        expect(await instance.database.prisma.user.count()).toBe(users)
        expect(await instance.database.prisma.session.count()).toBe(sessions)
    })

    it('administrateur qui supprime un compte : compte, personnages et sessions supprimés ensemble', async () => {
        const alice = await instance.database.prisma.user.findUniqueOrThrow({ where: { email: 'alice@example.com' } })
        await createTestCharacter(instance.database.prisma, alice.id, 'Arthas')
        expect(await instance.database.prisma.session.count({ where: { userId: alice.id } })).toBe(2)
        const bobToken = (await login('bob@example.com')).body.data.accessToken

        expect((await request(instance.app).delete(`${USERS}/${alice.id}`).set('Authorization', auth(bobToken))).status).toBe(204)

        expect(await instance.database.prisma.user.findUnique({ where: { id: alice.id } })).toBeNull()
        expect(await instance.database.prisma.character.count({ where: { userId: alice.id } })).toBe(0)
        expect(await instance.database.prisma.session.count({ where: { userId: alice.id } })).toBe(0)
        expect((await request(instance.app).get(ME).set('Authorization', auth(aliceToken))).status).toBe(401)
    })

    it('joueur qui supprime son propre compte : 204, cascade, ses jetons ne valent plus rien', async () => {
        await request(instance.app).post(REGISTER).send({ name: 'Carol', email: 'carol@example.com', password: PASSWORD })
        const carolToken = (await login('carol@example.com')).body.data.accessToken
        const carol = await instance.database.prisma.user.findUniqueOrThrow({ where: { email: 'carol@example.com' } })
        await createTestCharacter(instance.database.prisma, carol.id, 'Jaina')

        expect((await request(instance.app).delete(`${USERS}/${carol.id}`).set('Authorization', auth(carolToken))).status).toBe(204)

        expect(await instance.database.prisma.character.count({ where: { userId: carol.id } })).toBe(0)
        expect(await instance.database.prisma.session.count({ where: { userId: carol.id } })).toBe(0)
        expect((await request(instance.app).get(ME).set('Authorization', auth(carolToken))).status).toBe(401)
    })
})
