import type { Express } from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadFreshApp, type UserService } from '../helpers/fresh-modules'
import { expectErrorResponse, expectSuccessResponse } from '../helpers/http'

// Chemin écrit en clair : les tests décrivent le contrat public de l'API.
const USERS = '/api/v1/users'

let app: Express
let userService: UserService

beforeEach(async () => {
    // Application, service et repository neufs : chaque test part des deux utilisateurs initiaux.
    // userService est l'instance réellement utilisée par les routes de cette application.
    const fresh = await loadFreshApp()
    app = fresh.app
    userService = fresh.userService
})

describe('CRUD /api/v1/users', () => {
    it('GET /api/v1/users : 200 et la liste des utilisateurs initiaux', async () => {
        const response = await request(app).get(USERS)

        expectSuccessResponse(response, 200, 'Users retrieved successfully')
        expect(response.body.data).toHaveLength(2)
    })

    it("GET /api/v1/users/:id : 200 et l'utilisateur demandé", async () => {
        const response = await request(app).get(`${USERS}/1`)

        expectSuccessResponse(response, 200, 'User retrieved successfully')
        expect(response.body.data).toMatchObject({ id: 1 })
    })

    it("POST /api/v1/users : 201 et l'utilisateur créé", async () => {
        const response = await request(app).post(USERS).send({ name: 'Al', email: 'al@example.com' })

        expectSuccessResponse(response, 201, 'User created successfully', {
            id: 3,
            name: 'Al',
            email: 'al@example.com'
        })

        const list = await request(app).get(USERS)
        expect(list.body.data).toHaveLength(3)
    })

    it("PUT /api/v1/users/:id : 200 et l'utilisateur remplacé", async () => {
        const response = await request(app)
            .put(`${USERS}/2`)
            .send({ name: 'Robert', email: 'robert@example.com' })

        expectSuccessResponse(response, 200, 'User replaced successfully', {
            id: 2,
            name: 'Robert',
            email: 'robert@example.com'
        })
    })

    it('PATCH /api/v1/users/:id avec le nom seul : 200 (non-régression du bug corrigé en FND-04)', async () => {
        const before = await request(app).get(`${USERS}/2`)
        const response = await request(app).patch(`${USERS}/2`).send({ name: 'Bobby' })

        expectSuccessResponse(response, 200, 'User updated successfully', {
            id: 2,
            name: 'Bobby',
            email: before.body.data.email
        })
    })

    it("DELETE /api/v1/users/:id : 204 sans corps, puis l'utilisateur n'existe plus", async () => {
        const response = await request(app).delete(`${USERS}/2`)

        expect(response.status).toBe(204)
        expect(response.text).toBe('')
        expectErrorResponse(await request(app).get(`${USERS}/2`), 404, 'USER_NOT_FOUND', [])
    })
})

describe('404 USER_NOT_FOUND', () => {
    it('GET sur un utilisateur inexistant', async () => {
        const response = await request(app).get(`${USERS}/99`)

        expectErrorResponse(response, 404, 'USER_NOT_FOUND', [])
        expect(response.body.message).toBe('User not found')
    })

    it('DELETE sur un utilisateur inexistant', async () => {
        expectErrorResponse(await request(app).delete(`${USERS}/99`), 404, 'USER_NOT_FOUND', [])
    })
})

describe('409 EMAIL_ALREADY_USED', () => {
    it("POST avec l'email d'un utilisateur existant", async () => {
        const existing = await request(app).get(`${USERS}/1`)
        const response = await request(app).post(USERS).send({ name: 'Copie', email: existing.body.data.email })

        expectErrorResponse(response, 409, 'EMAIL_ALREADY_USED', [])
        expect(response.body.message).toBe('Email already taken')
    })

    it("PATCH avec l'email d'un autre utilisateur", async () => {
        const other = await request(app).get(`${USERS}/1`)
        const response = await request(app).patch(`${USERS}/2`).send({ email: other.body.data.email })

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

    it('identifiant non numérique (non-régression du bug corrigé en FND-04)', async () => {
        const response = await request(app).get(`${USERS}/abc`)
        expectErrorResponse(response, 400, 'VALIDATION_ERROR', [
            { field: 'id', message: 'Must be a positive integer' }
        ])
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

        const response = await request(app).put(`${USERS}/99`).send({})

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

describe('isolation des données entre les tests', () => {
    it("modifie l'état : supprime l'utilisateur 1 par l'API", async () => {
        expect((await request(app).delete(`${USERS}/1`)).status).toBe(204)
        expect((await request(app).get(USERS)).body.data).toHaveLength(1)
    })

    it("retrouve l'utilisateur 1 : chaque test repart des données initiales", async () => {
        expect((await request(app).get(`${USERS}/1`)).status).toBe(200)
        expect((await request(app).get(USERS)).body.data).toHaveLength(2)
    })
})