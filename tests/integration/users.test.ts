import type { Express } from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '../../src/types/user'
import { loadFreshApp, type UserService } from '../helpers/fresh-modules'
import { expectErrorResponse, expectSuccessResponse } from '../helpers/http'
import { UNKNOWN_USER_ID } from '../helpers/user-repository-contract'

// Chemin écrit en clair : les tests décrivent le contrat public de l'API.
const USERS = '/api/v1/users'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

let app: Express
let userService: UserService
let alice: User
let bob: User

beforeEach(async () => {
    // Application, service et repository en mémoire neufs : chaque test part de deux utilisateurs.
    // userService est l'instance réellement utilisée par les routes de cette application.
    const fresh = await loadFreshApp({
        users: [
            { name: 'Alice', email: 'alice@example.com' },
            { name: 'Bob', email: 'bob@example.com' }
        ]
    })
    app = fresh.app
    userService = fresh.userService
    ;[alice, bob] = fresh.users as [User, User]
})

describe('CRUD /api/v1/users', () => {
    it('GET /api/v1/users : 200 et la liste des utilisateurs', async () => {
        const response = await request(app).get(USERS)

        expectSuccessResponse(response, 200, 'Users retrieved successfully')
        expect(response.body.data).toHaveLength(2)
    })

    it('GET /api/v1/users : chaque utilisateur expose exactement id, name et email', async () => {
        const response = await request(app).get(USERS)

        for (const user of response.body.data) {
            expect(Object.keys(user).sort()).toEqual(['email', 'id', 'name'])
        }
    })

    it("GET /api/v1/users/:id : 200 et l'utilisateur demandé", async () => {
        const response = await request(app).get(`${USERS}/${alice.id}`)

        expectSuccessResponse(response, 200, 'User retrieved successfully', {
            id: alice.id,
            name: 'Alice',
            email: 'alice@example.com'
        })
    })

    it("POST /api/v1/users : 201 et l'utilisateur créé, avec un identifiant UUID", async () => {
        const response = await request(app).post(USERS).send({ name: 'Al', email: 'al@example.com' })

        expectSuccessResponse(response, 201, 'User created successfully', {
            id: expect.stringMatching(UUID_PATTERN),
            name: 'Al',
            email: 'al@example.com'
        })

        const list = await request(app).get(USERS)
        expect(list.body.data).toHaveLength(3)
    })

    it("POST /api/v1/users : l'email est enregistré et renvoyé en minuscules", async () => {
        const response = await request(app).post(USERS).send({ name: 'Al', email: 'Al@Example.COM' })

        expect(response.status).toBe(201)
        expect(response.body.data.email).toBe('al@example.com')
    })

    it("PUT /api/v1/users/:id : 200 et l'utilisateur remplacé", async () => {
        const response = await request(app)
            .put(`${USERS}/${bob.id}`)
            .send({ name: 'Robert', email: 'robert@example.com' })

        expectSuccessResponse(response, 200, 'User replaced successfully', {
            id: bob.id,
            name: 'Robert',
            email: 'robert@example.com'
        })
    })

    it('PATCH /api/v1/users/:id avec le nom seul : 200 (non-régression du bug corrigé en FND-04)', async () => {
        const response = await request(app).patch(`${USERS}/${bob.id}`).send({ name: 'Bobby' })

        expectSuccessResponse(response, 200, 'User updated successfully', {
            id: bob.id,
            name: 'Bobby',
            email: bob.email
        })
    })

    it("DELETE /api/v1/users/:id : 204 sans corps, puis l'utilisateur n'existe plus", async () => {
        const response = await request(app).delete(`${USERS}/${bob.id}`)

        expect(response.status).toBe(204)
        expect(response.text).toBe('')
        expectErrorResponse(await request(app).get(`${USERS}/${bob.id}`), 404, 'USER_NOT_FOUND', [])
    })
})

describe('404 USER_NOT_FOUND', () => {
    it('GET sur un utilisateur inexistant', async () => {
        const response = await request(app).get(`${USERS}/${UNKNOWN_USER_ID}`)

        expectErrorResponse(response, 404, 'USER_NOT_FOUND', [])
        expect(response.body.message).toBe('User not found')
    })

    it.each(['put', 'patch'] as const)('%s sur un utilisateur inexistant', async (method) => {
        const response = await request(app)[method](`${USERS}/${UNKNOWN_USER_ID}`).send({ name: 'X', email: 'x@example.com' })
        expectErrorResponse(response, 404, 'USER_NOT_FOUND', [])
    })

    it('DELETE sur un utilisateur inexistant', async () => {
        expectErrorResponse(await request(app).delete(`${USERS}/${UNKNOWN_USER_ID}`), 404, 'USER_NOT_FOUND', [])
    })
})

describe('409 EMAIL_ALREADY_USED', () => {
    it("POST avec l'email d'un utilisateur existant", async () => {
        const response = await request(app).post(USERS).send({ name: 'Copie', email: alice.email })

        expectErrorResponse(response, 409, 'EMAIL_ALREADY_USED', [])
        expect(response.body.message).toBe('Email already taken')
    })

    it("POST avec l'email d'un utilisateur existant écrit avec une autre casse", async () => {
        const response = await request(app).post(USERS).send({ name: 'Copie', email: 'ALICE@example.com' })

        expectErrorResponse(response, 409, 'EMAIL_ALREADY_USED', [])
    })

    it("PATCH avec l'email d'un autre utilisateur", async () => {
        const response = await request(app).patch(`${USERS}/${bob.id}`).send({ email: alice.email })

        expectErrorResponse(response, 409, 'EMAIL_ALREADY_USED', [])
    })
})

describe('400 VALIDATION_ERROR', () => {
    it('champs obligatoires manquants', async () => {
        const response = await request(app).post(USERS).send({})

        expectErrorResponse(response, 400, 'VALIDATION_ERROR', [
            { field: 'name', message: expect.any(String) },
            { field: 'email', message: expect.any(String) }
        ])
        expect(response.body.message).toBe('Validation failed')
    })

    it("chaîne composée uniquement d'espaces", async () => {
        const response = await request(app).post(USERS).send({ name: '   ', email: 'x@example.com' })
        expectErrorResponse(response, 400, 'VALIDATION_ERROR', [{ field: 'name', message: 'Must not be empty' }])
    })

    it("email composé uniquement d'espaces (contrôle existant conservé)", async () => {
        const response = await request(app).post(USERS).send({ name: 'Al', email: '   ' })
        expectErrorResponse(response, 400, 'VALIDATION_ERROR', [{ field: 'email', message: 'Must not be empty' }])
    })

    it('champ inconnu dans le corps', async () => {
        const response = await request(app)
            .post(USERS)
            .send({ name: 'Lvl', email: 'lvl@example.com', level: 50 })
        expectErrorResponse(response, 400, 'VALIDATION_ERROR', [{ field: 'level', message: 'Unknown field' }])
    })

    it('paramètre de requête inconnu', async () => {
        const response = await request(app).get(USERS).query({ foo: '1' })
        expectErrorResponse(response, 400, 'VALIDATION_ERROR', [
            { field: 'foo', message: 'Unknown query parameter' }
        ])
    })

    it.each([
        { label: 'texte', id: 'abc' },
        { label: 'ancien identifiant numérique', id: '1' },
        { label: 'UUID tronqué', id: '0193a5f4-2b3c-7d4e-9f50' }
    ])('identifiant qui n’est pas un UUID ($label) : 400', async ({ id }) => {
        const response = await request(app).get(`${USERS}/${id}`)
        expectErrorResponse(response, 400, 'VALIDATION_ERROR', [{ field: 'id', message: 'Must be a valid UUID' }])
    })
})

describe('une requête invalide ne déclenche jamais le service', () => {
    it('témoin : une requête valide appelle bien le service espionné', async () => {
        const createSpy = vi.spyOn(userService, 'create')

        await request(app).post(USERS).send({ name: 'Al', email: 'al@example.com' })

        expect(createSpy).toHaveBeenCalledTimes(1)
    })

    it('corps invalide : POST refusé avant le service, aucun utilisateur créé', async () => {
        const createSpy = vi.spyOn(userService, 'create')

        const response = await request(app)
            .post(USERS)
            .send({ name: 'Lvl', email: 'lvl@example.com', level: 50 })

        expect(response.status).toBe(400)
        expect(createSpy).not.toHaveBeenCalled()
        expect((await request(app).get(USERS)).body.data).toHaveLength(2)
    })

    it('JSON illisible : refusé avant le service', async () => {
        const createSpy = vi.spyOn(userService, 'create')

        const response = await request(app)
            .post(USERS)
            .set('Content-Type', 'application/json')
            .send('{bad')

        expect(response.status).toBe(400)
        expect(createSpy).not.toHaveBeenCalled()
    })

    it('corps invalide sur un utilisateur inexistant : 400 et non 404, le service n’est pas appelé', async () => {
        const replaceSpy = vi.spyOn(userService, 'replace')

        const response = await request(app).put(`${USERS}/${UNKNOWN_USER_ID}`).send({})

        expectErrorResponse(response, 400, 'VALIDATION_ERROR')
        expect(replaceSpy).not.toHaveBeenCalled()
    })

    it('identifiant invalide : DELETE refusé avant le service', async () => {
        const removeSpy = vi.spyOn(userService, 'remove')

        const response = await request(app).delete(`${USERS}/abc`)

        expect(response.status).toBe(400)
        expect(removeSpy).not.toHaveBeenCalled()
    })
})

describe('erreur asynchrone du service', () => {
    it('une erreur inattendue atteint le gestionnaire centralisé : 500 sans détail interne', async () => {
        vi.spyOn(userService, 'getAll').mockRejectedValue(new Error('panne de la base'))

        const response = await request(app).get(USERS)

        expectErrorResponse(response, 500, 'INTERNAL_ERROR', [])
        expect(JSON.stringify(response.body)).not.toContain('panne')
    })
})

describe('isolation des données entre les tests', () => {
    it("modifie l'état : supprime Alice par l'API", async () => {
        expect((await request(app).delete(`${USERS}/${alice.id}`)).status).toBe(204)
        expect((await request(app).get(USERS)).body.data).toHaveLength(1)
    })

    it('retrouve deux utilisateurs : chaque test repart de données neuves', async () => {
        expect((await request(app).get(USERS)).body.data).toHaveLength(2)
    })
})
