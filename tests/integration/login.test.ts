import type { Express } from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import {
    bearer,
    createTestAccount,
    loadFreshApp,
    TEST_PASSWORD,
    TEST_SESSION_TTL_MS,
    type FreshApp
} from '../helpers/fresh-modules'
import { expectErrorResponse, expectSuccessResponse } from '../helpers/http'

/* Connexion (AUTH-06), authentification des requêtes (AUTH-07) et déconnexion (AUTH-10).
 * Application réelle, repositories en mémoire, hachage rapide, horloge contrôlée : aucune base de données.
 */

const LOGIN = '/api/v1/auth/login'
const LOGOUT = '/api/v1/auth/logout'
const ME = '/api/v1/users/me'

let fresh: FreshApp
let app: Express

beforeEach(async () => {
    fresh = await loadFreshApp()
    app = fresh.app
    await fresh.authService.register({ name: 'Alice', email: 'alice@example.com', password: TEST_PASSWORD })
})

const login = (body: object) => request(app).post(LOGIN).send(body)

describe('POST /api/v1/auth/login : succès (200)', () => {
    it('renvoie le jeton, son type, sa date d’expiration et le compte public', async () => {
        const response = await login({ email: 'Alice@Example.com', password: TEST_PASSWORD })

        expectSuccessResponse(response, 200, 'Login successful', {
            accessToken: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
            tokenType: 'Bearer',
            expiresAt: new Date(fresh.clock.now().getTime() + TEST_SESSION_TTL_MS).toISOString(),
            user: { id: expect.any(String), name: 'Alice', email: 'alice@example.com', role: 'PLAYER' }
        })
    })

    it('Cache-Control: no-store, et ni mot de passe ni hash dans la réponse', async () => {
        const response = await login({ email: 'alice@example.com', password: TEST_PASSWORD })
        const stored = fresh.userRepository.storedPasswordHash(response.body.data.user.id) ?? ''

        expect(response.headers['cache-control']).toBe('no-store')
        expect(response.text).not.toContain(TEST_PASSWORD)
        expect(response.text).not.toContain(stored)
        expect(response.text).not.toMatch(/password|hash/i)
    })

    it('le jeton renvoyé permet d’accéder à une route protégée', async () => {
        const { accessToken } = (await login({ email: 'alice@example.com', password: TEST_PASSWORD })).body.data
        expectSuccessResponse(await request(app).get(ME).set('Authorization', bearer(accessToken)), 200, 'User retrieved successfully')
    })
})

describe('POST /api/v1/auth/login : refus', () => {
    it.each([
        { label: 'mauvais mot de passe', body: { email: 'alice@example.com', password: 'wrong horse battery staple' } },
        { label: 'email inconnu', body: { email: 'bob@example.com', password: TEST_PASSWORD } },
        { label: 'mot de passe court (pas de règle de longueur minimale à la connexion)', body: { email: 'alice@example.com', password: 'court' } }
    ])('$label : 401 INVALID_CREDENTIALS générique, sans jeton', async ({ body }) => {
        const response = await login(body)
        expectErrorResponse(response, 401, 'INVALID_CREDENTIALS', [])
        expect(response.body.message).toBe('Invalid email or password')
        expect(response.text).not.toMatch(/token/i)
    })

    it('compte désactivé, bon mot de passe : 403 ACCOUNT_DISABLED', async () => {
        const alice = await fresh.userRepository.findByEmail('alice@example.com')
        await fresh.userRepository.setStatus(alice?.id ?? '', 'DISABLED')
        expectErrorResponse(await login({ email: 'alice@example.com', password: TEST_PASSWORD }), 403, 'ACCOUNT_DISABLED', [])
    })

    it.each([
        { label: 'corps vide', body: {}, fields: ['email', 'password'] },
        { label: 'email invalide', body: { email: 'pas-un-email', password: TEST_PASSWORD }, fields: ['email'] },
        { label: 'mot de passe vide', body: { email: 'alice@example.com', password: '' }, fields: ['password'] },
        { label: 'mot de passe de 129 caractères', body: { email: 'alice@example.com', password: 'a'.repeat(129) }, fields: ['password'] },
        { label: 'champ inconnu', body: { email: 'alice@example.com', password: TEST_PASSWORD, remember: true }, fields: ['remember'] }
    ])('$label : 400 VALIDATION_ERROR', async ({ body, fields }) => {
        const response = await login(body)
        expectErrorResponse(response, 400, 'VALIDATION_ERROR')
        expect(response.body.error.details.map((detail: { field: string }) => detail.field)).toEqual(fields)
    })

    it('limite de tentatives : la 11e requête en 15 minutes reçoit 429 RATE_LIMITED, même avec le bon mot de passe', async () => {
        for (let attempt = 0; attempt < 10; attempt++) {
            expect((await login({ email: 'alice@example.com', password: 'wrong horse battery staple' })).status).toBe(401)
        }
        expectErrorResponse(await login({ email: 'alice@example.com', password: TEST_PASSWORD }), 429, 'RATE_LIMITED', [])
    })
})

describe('routes protégées : authentification (AUTH-07)', () => {
    it.each([
        { label: 'sans en-tête Authorization', header: undefined },
        { label: 'en-tête vide', header: '' },
        { label: 'schéma Basic', header: 'Basic YWxpY2U6c2VjcmV0' },
        { label: 'Bearer sans jeton', header: 'Bearer ' },
        { label: 'jeton mal formé', header: 'Bearer pas-un-jeton' },
        { label: 'jeton inconnu au bon format', header: `Bearer ${'a'.repeat(43)}` },
        { label: 'deux jetons', header: `Bearer ${'a'.repeat(43)} ${'b'.repeat(43)}` }
    ])('$label : 401 UNAUTHENTICATED avec WWW-Authenticate', async ({ header }) => {
        const pending = request(app).get(ME)
        const response = header === undefined ? await pending : await pending.set('Authorization', header)

        expectErrorResponse(response, 401, 'UNAUTHENTICATED', [])
        expect(response.body.message).toBe('Authentication required')
        expect(response.headers['www-authenticate']).toBe('Bearer realm="api"')
    })

    it('le nom du schéma est insensible à la casse (« bearer »)', async () => {
        const { token } = await createTestAccount(fresh, { name: 'Bob', email: 'bob@example.com' })
        expect((await request(app).get(ME).set('Authorization', `bearer ${token}`)).status).toBe(200)
    })

    it('le jeton n’est jamais lu dans l’URL', async () => {
        const { token } = await createTestAccount(fresh, { name: 'Bob', email: 'bob@example.com' })
        expect((await request(app).get(`${ME}?access_token=${token}`)).status).toBe(401)
    })

    it('session expirée (24 h) : 401', async () => {
        const { token } = await createTestAccount(fresh, { name: 'Bob', email: 'bob@example.com' })
        fresh.clock.advance(TEST_SESSION_TTL_MS)
        expectErrorResponse(await request(app).get(ME).set('Authorization', bearer(token)), 401, 'UNAUTHENTICATED', [])
    })

    it('compte désactivé après la connexion : 401 immédiat', async () => {
        const { user, token } = await createTestAccount(fresh, { name: 'Bob', email: 'bob@example.com' })
        await fresh.userRepository.setStatus(user.id, 'DISABLED')
        expectErrorResponse(await request(app).get(ME).set('Authorization', bearer(token)), 401, 'UNAUTHENTICATED', [])
    })

    it('l’authentification passe avant la validation : 401 même avec un corps invalide', async () => {
        expectErrorResponse(await request(app).patch(ME).send({ role: 'ADMIN' }), 401, 'UNAUTHENTICATED', [])
    })
})

describe('POST /api/v1/auth/logout (AUTH-10)', () => {
    it('204 sans corps ; le jeton est ensuite refusé (401)', async () => {
        const { token } = await createTestAccount(fresh, { name: 'Bob', email: 'bob@example.com' })

        const response = await request(app).post(LOGOUT).set('Authorization', bearer(token))

        expect(response.status).toBe(204)
        expect(response.text).toBe('')
        expectErrorResponse(await request(app).get(ME).set('Authorization', bearer(token)), 401, 'UNAUTHENTICATED', [])
        expectErrorResponse(await request(app).post(LOGOUT).set('Authorization', bearer(token)), 401, 'UNAUTHENTICATED', [])
    })

    it('révoque uniquement la session utilisée : une autre session du même compte reste valide', async () => {
        const first = (await login({ email: 'alice@example.com', password: TEST_PASSWORD })).body.data.accessToken
        const second = (await login({ email: 'alice@example.com', password: TEST_PASSWORD })).body.data.accessToken

        expect((await request(app).post(LOGOUT).set('Authorization', bearer(first))).status).toBe(204)

        expect((await request(app).get(ME).set('Authorization', bearer(first))).status).toBe(401)
        expectSuccessResponse(await request(app).get(ME).set('Authorization', bearer(second)), 200, 'User retrieved successfully')
    })

    it('sans jeton : 401 ; un corps est refusé (400) une fois authentifié', async () => {
        expectErrorResponse(await request(app).post(LOGOUT), 401, 'UNAUTHENTICATED', [])
        const { token } = await createTestAccount(fresh, { name: 'Bob', email: 'bob@example.com' })
        expectErrorResponse(await request(app).post(LOGOUT).set('Authorization', bearer(token)).send({ all: true }), 400, 'VALIDATION_ERROR')
    })
})
