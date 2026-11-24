import type { Express } from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { bearer, createTestAccount, loadFreshApp, type FreshApp, type TestAccount } from '../helpers/fresh-modules'
import { expectErrorResponse, expectSuccessResponse } from '../helpers/http'
import { UNKNOWN_USER_ID } from '../helpers/user-repository-contract'

/* Routes /api/v1/users (AUTH-02, AUTH-08, AUTH-09) : permissions propriétaire / autre joueur / administrateur.
 * Un joueur n'accède qu'à son propre compte ; un autre compte est traité comme inexistant (404, conventions §5.3).
 * La liste est réservée aux administrateurs (403 sinon). Aucune route n'est accessible sans jeton (401).
 */

const USERS = '/api/v1/users'
const ME = `${USERS}/me`

let fresh: FreshApp
let app: Express
let alice: TestAccount
let bob: TestAccount
let admin: TestAccount

beforeEach(async () => {
    fresh = await loadFreshApp()
    app = fresh.app
    alice = await createTestAccount(fresh, { name: 'Alice', email: 'alice@example.com' })
    bob = await createTestAccount(fresh, { name: 'Bob', email: 'bob@example.com' })
    admin = await createTestAccount(fresh, { name: 'Admin', email: 'admin@example.com', role: 'ADMIN' })
})

const as = (account: TestAccount) => ({
    get: (path: string) => request(app).get(path).set('Authorization', bearer(account.token)),
    patch: (path: string, body: object) => request(app).patch(path).set('Authorization', bearer(account.token)).send(body),
    delete: (path: string) => request(app).delete(path).set('Authorization', bearer(account.token))
})

// Comptes publics dans l'ordre du repository (date de création, puis identifiant) : trois comptes créés
// dans la même milliseconde sont départagés par leur identifiant, qui n'est pas prévisible.
const publicUsersInOrder = async () =>
    (await fresh.userRepository.findAll()).map(({ id, name, email, role }) => ({ id, name, email, role }))

const publicUser = (account: TestAccount, changes: object = {}) => ({
    id: account.user.id,
    name: account.user.name,
    email: account.user.email,
    role: account.user.role,
    ...changes
})

describe('sans jeton : 401 sur toutes les routes /users', () => {
    it.each([
        { method: 'get', path: USERS },
        { method: 'get', path: ME },
        { method: 'patch', path: ME },
        { method: 'get', path: `${USERS}/${UNKNOWN_USER_ID}` },
        { method: 'patch', path: `${USERS}/${UNKNOWN_USER_ID}` },
        { method: 'delete', path: `${USERS}/${UNKNOWN_USER_ID}` },
        { method: 'post', path: USERS },
        { method: 'put', path: `${USERS}/${UNKNOWN_USER_ID}` }
    ] as const)('$method $path', async ({ method, path }) => {
        expectErrorResponse(await request(app)[method](path), 401, 'UNAUTHENTICATED', [])
    })
})

describe('GET /api/v1/users (liste, administrateurs)', () => {
    it('administrateur : liste paginée (20 par défaut) des comptes publics', async () => {
        const response = await as(admin).get(USERS)

        expect(response.status).toBe(200)
        expect(response.body.data).toEqual(expect.arrayContaining([publicUser(alice), publicUser(bob), publicUser(admin)]))
        expect(response.body).toEqual({
            success: true,
            message: 'Users retrieved successfully',
            data: await publicUsersInOrder(),
            meta: { pagination: { page: 1, pageSize: 20, totalItems: 3, totalPages: 1 } }
        })
    })

    it('administrateur : page et pageSize', async () => {
        const response = await as(admin).get(`${USERS}?page=2&pageSize=2`)
        expect(response.body.data).toEqual((await publicUsersInOrder()).slice(2))
        expect(response.body.meta).toEqual({ pagination: { page: 2, pageSize: 2, totalItems: 3, totalPages: 2 } })
    })

    it.each([
        { query: 'page=0', field: 'page' },
        { query: 'page=abc', field: 'page' },
        { query: 'pageSize=0', field: 'pageSize' },
        { query: 'pageSize=101', field: 'pageSize' },
        { query: 'pageSize=1.5', field: 'pageSize' },
        { query: 'page=1&page=2', field: 'page' },
        { query: 'sort=name', field: 'sort' }
    ])('administrateur, ?$query : 400 sans correction automatique', async ({ query, field }) => {
        const response = await as(admin).get(`${USERS}?${query}`)
        expectErrorResponse(response, 400, 'VALIDATION_ERROR')
        expect(response.body.error.details[0].field).toBe(field)
    })

    it('joueur : 403 FORBIDDEN', async () => {
        const response = await as(alice).get(USERS)
        expectErrorResponse(response, 403, 'FORBIDDEN', [])
        expect(response.body.message).toBe('Administrator role required')
    })
})

describe('GET /api/v1/users/:id', () => {
    it('propriétaire : 200 avec son compte public', async () => {
        expectSuccessResponse(await as(alice).get(`${USERS}/${alice.user.id}`), 200, 'User retrieved successfully', publicUser(alice))
    })

    it('autre joueur : 404 USER_NOT_FOUND, identique à un compte inexistant', async () => {
        const other = await as(alice).get(`${USERS}/${bob.user.id}`)
        const unknown = await as(alice).get(`${USERS}/${UNKNOWN_USER_ID}`)
        expectErrorResponse(other, 404, 'USER_NOT_FOUND', [])
        expect(other.body).toEqual(unknown.body)
    })

    it('administrateur : 200 pour un autre compte, 404 pour un compte inexistant', async () => {
        expectSuccessResponse(await as(admin).get(`${USERS}/${bob.user.id}`), 200, 'User retrieved successfully', publicUser(bob))
        expectErrorResponse(await as(admin).get(`${USERS}/${UNKNOWN_USER_ID}`), 404, 'USER_NOT_FOUND', [])
    })

    it('identifiant qui n’est pas un UUID : 400', async () => {
        expectErrorResponse(await as(alice).get(`${USERS}/1`), 400, 'VALIDATION_ERROR', [{ field: 'id', message: 'Must be a valid UUID' }])
    })
})

describe('PATCH /api/v1/users/:id', () => {
    it('propriétaire : modifie son nom et son email (minuscules)', async () => {
        const response = await as(alice).patch(`${USERS}/${alice.user.id}`, { name: 'Alicia', email: 'Alicia@Example.com' })
        expectSuccessResponse(response, 200, 'User updated successfully', publicUser(alice, { name: 'Alicia', email: 'alicia@example.com' }))
        expect(await fresh.userRepository.findById(alice.user.id)).toMatchObject({ name: 'Alicia', email: 'alicia@example.com' })
    })

    it('autre joueur : 404, aucune modification', async () => {
        expectErrorResponse(await as(alice).patch(`${USERS}/${bob.user.id}`, { name: 'Pirate' }), 404, 'USER_NOT_FOUND', [])
        expect(await fresh.userRepository.findById(bob.user.id)).toMatchObject({ name: 'Bob' })
    })

    it('administrateur : modifie un autre compte', async () => {
        expectSuccessResponse(await as(admin).patch(`${USERS}/${bob.user.id}`, { name: 'Robert' }), 200, 'User updated successfully', publicUser(bob, { name: 'Robert' }))
    })

    it("email d'un autre compte, quelle que soit la casse : 409 EMAIL_ALREADY_USED", async () => {
        expectErrorResponse(await as(alice).patch(`${USERS}/${alice.user.id}`, { email: 'BOB@example.com' }), 409, 'EMAIL_ALREADY_USED', [])
    })

    it.each([
        { label: 'role', body: { role: 'ADMIN' } },
        { label: 'status', body: { status: 'DISABLED' } },
        { label: 'id', body: { id: UNKNOWN_USER_ID } },
        { label: 'password', body: { password: 'nouveau mot de passe' } }
    ])('champ $label refusé (400 « Unknown field »), même pour un administrateur', async ({ label, body }) => {
        expectErrorResponse(await as(admin).patch(`${USERS}/${alice.user.id}`, body), 400, 'VALIDATION_ERROR', [
            { field: label, message: 'Unknown field' }
        ])
        expect(await fresh.userRepository.findById(alice.user.id)).toMatchObject({ role: 'PLAYER', status: 'ACTIVE' })
    })

    it.each([
        { label: 'email invalide', body: { email: 'pas-un-email' }, field: 'email' },
        { label: 'nom vide', body: { name: '  ' }, field: 'name' }
    ])('$label : 400', async ({ body, field }) => {
        expectErrorResponse(await as(alice).patch(`${USERS}/${alice.user.id}`, body), 400, 'VALIDATION_ERROR', [
            { field, message: expect.any(String) }
        ])
    })
})

describe('DELETE /api/v1/users/:id', () => {
    it('propriétaire : supprime son propre compte (204) ; ses sessions sont refusées ensuite', async () => {
        const response = await as(alice).delete(`${USERS}/${alice.user.id}`)

        expect(response.status).toBe(204)
        expect(response.text).toBe('')
        expect(await fresh.userRepository.findById(alice.user.id)).toBeUndefined()
        expectErrorResponse(await as(alice).get(ME), 401, 'UNAUTHENTICATED', [])
    })

    it('autre joueur : 404 et aucun effacement', async () => {
        expectErrorResponse(await as(alice).delete(`${USERS}/${bob.user.id}`), 404, 'USER_NOT_FOUND', [])
        expect(await fresh.userRepository.findById(bob.user.id)).toBeDefined()
        expectSuccessResponse(await as(bob).get(ME), 200, 'User retrieved successfully', publicUser(bob))
    })

    it('administrateur : supprime un autre compte (204), puis 404 pour ce compte', async () => {
        expect((await as(admin).delete(`${USERS}/${bob.user.id}`)).status).toBe(204)
        expect(await fresh.userRepository.findById(bob.user.id)).toBeUndefined()
        expectErrorResponse(await as(admin).delete(`${USERS}/${bob.user.id}`), 404, 'USER_NOT_FOUND', [])
    })
})

describe('/api/v1/users/me (AUTH-09)', () => {
    it('GET : le compte du jeton', async () => {
        expectSuccessResponse(await as(bob).get(ME), 200, 'User retrieved successfully', publicUser(bob))
        expectSuccessResponse(await as(admin).get(ME), 200, 'User retrieved successfully', publicUser(admin))
    })

    it('PATCH : modifie son compte, et seulement le sien ; les changements persistent', async () => {
        expectSuccessResponse(await as(bob).patch(ME, { name: 'Bobby' }), 200, 'User updated successfully', publicUser(bob, { name: 'Bobby' }))
        expectSuccessResponse(await as(bob).get(ME), 200, 'User retrieved successfully', publicUser(bob, { name: 'Bobby' }))
        expect(await fresh.userRepository.findById(alice.user.id)).toMatchObject({ name: 'Alice' })
    })

    it('PATCH : le rôle ne peut pas être modifié (400)', async () => {
        expectErrorResponse(await as(bob).patch(ME, { role: 'ADMIN' }), 400, 'VALIDATION_ERROR', [{ field: 'role', message: 'Unknown field' }])
    })

    it("PATCH : email d'un autre compte → 409", async () => {
        expectErrorResponse(await as(bob).patch(ME, { email: 'alice@example.com' }), 409, 'EMAIL_ALREADY_USED', [])
    })

    it('un paramètre de requête est refusé (400)', async () => {
        expectErrorResponse(await as(bob).get(`${ME}?userId=${alice.user.id}`), 400, 'VALIDATION_ERROR', [
            { field: 'userId', message: 'Unknown query parameter' }
        ])
    })
})

describe('routes supprimées', () => {
    it.each([
        { method: 'post', path: USERS },
        { method: 'put', path: `${USERS}/${UNKNOWN_USER_ID}` }
    ] as const)('$method $path (authentifié) : 404 ROUTE_NOT_FOUND', async ({ method, path }) => {
        expectErrorResponse(await request(app)[method](path).set('Authorization', bearer(alice.token)), 404, 'ROUTE_NOT_FOUND', [])
    })

    it('DELETE /api/v1/users/me n’existe pas : « me » est lu comme un identifiant, refusé (400), rien n’est supprimé', async () => {
        expectErrorResponse(await as(alice).delete(ME), 400, 'VALIDATION_ERROR', [{ field: 'id', message: 'Must be a valid UUID' }])
        expect(await fresh.userRepository.findById(alice.user.id)).toBeDefined()
    })
})
