import type { Express } from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadFreshApp, type FreshApp } from '../helpers/fresh-modules'
import { expectErrorResponse, expectSuccessResponse } from '../helpers/http'

/* POST /api/v1/auth/register (AUTH-04). Connexion et déconnexion : tests/integration/login.test.ts.
 * Application réelle, repository en mémoire et hachage rapide : aucune base de données.
 */

// Chemins écrits en clair : les tests décrivent le contrat public de l'API.
const REGISTER = '/api/v1/auth/register'
const PASSWORD = 'correct horse battery staple'
const SOME_UUID = '0193a5f4-2b3c-7d4e-9f50-617283940a1b'

let fresh: FreshApp
let app: Express

beforeEach(async () => {
    fresh = await loadFreshApp()
    app = fresh.app
})

const register = (body: unknown) => request(app).post(REGISTER).send(body as object)

describe('POST /api/v1/auth/register : succès (201)', () => {
    it('crée le compte et renvoie le DTO public exact : id, name, email en minuscules, role', async () => {
        const response = await register({ name: 'Alice', email: 'Alice@Example.com', password: PASSWORD })

        expectSuccessResponse(response, 201, 'User registered successfully', {
            id: expect.stringMatching(/^[0-9a-f-]{36}$/),
            name: 'Alice',
            email: 'alice@example.com',
            role: 'PLAYER'
        })
    })

    it('ne renvoie ni mot de passe, ni hash, ni jeton', async () => {
        const response = await register({ name: 'Alice', email: 'alice@example.com', password: PASSWORD })
        const stored = fresh.userRepository.storedPasswordHash(response.body.data.id) ?? ''

        expect(stored).not.toBe('')
        expect(response.text).not.toContain(PASSWORD)
        expect(response.text).not.toContain(stored)
        expect(response.text).not.toMatch(/password|hash|token/i)
        expect(response.headers['set-cookie']).toBeUndefined()
    })

    it('enregistre un hash vérifiable du mot de passe, jamais le mot de passe en clair', async () => {
        const response = await register({ name: 'Alice', email: 'alice@example.com', password: PASSWORD })
        const stored = fresh.userRepository.storedPasswordHash(response.body.data.id) ?? ''

        expect(stored).not.toContain(PASSWORD)
        expect(await fresh.passwordHasher.verify(stored, PASSWORD)).toBe(true)
    })

    it.each([
        { label: '15 caractères (minimum)', password: 'a'.repeat(15) },
        { label: '128 caractères (maximum)', password: 'a'.repeat(128) },
        { label: 'espaces et phrase de passe', password: '  une phrase de passe  ' },
        { label: '15 emojis (30 unités UTF-16, 15 caractères)', password: '🐉'.repeat(15) },
        { label: 'sans chiffre ni majuscule (aucune règle de composition)', password: 'aaaaaaaaaaaaaaaaaaaa' }
    ])('mot de passe accepté : $label', async ({ password }) => {
        expect((await register({ name: 'Alice', email: 'alice@example.com', password })).status).toBe(201)
    })
})

describe('POST /api/v1/auth/register : refus (400 VALIDATION_ERROR)', () => {
    it('corps vide : name, email et password signalés, service non appelé', async () => {
        const registerSpy = vi.spyOn(fresh.authService, 'register')

        expectErrorResponse(await register({}), 400, 'VALIDATION_ERROR', [
            { field: 'name', message: expect.any(String) },
            { field: 'email', message: expect.any(String) },
            { field: 'password', message: expect.any(String) }
        ])
        expect(registerSpy).not.toHaveBeenCalled()
    })

    it('requête sans corps (Content-Length: 0) : 400', async () => {
        expectErrorResponse(await request(app).post(REGISTER).set('Content-Length', '0'), 400, 'VALIDATION_ERROR')
    })

    it.each(['pas-un-email', 'alice@', '@example.com', 'alice example@example.com', ''])(
        'email invalide (%j) : 400 « Must be a valid email »',
        async (email) => {
            const response = await register({ name: 'Alice', email, password: PASSWORD })
            expectErrorResponse(response, 400, 'VALIDATION_ERROR', [{ field: 'email', message: 'Must be a valid email' }])
        }
    )

    it('email de plus de 254 caractères : 400', async () => {
        const email = `${'a'.repeat(243)}@example.com`
        expectErrorResponse(await register({ name: 'Alice', email, password: PASSWORD }), 400, 'VALIDATION_ERROR', [
            { field: 'email', message: 'Must be at most 254 characters' }
        ])
    })

    it.each([
        { label: '14 caractères', password: 'a'.repeat(14), message: 'Must be at least 15 characters' },
        { label: '14 emojis (28 unités UTF-16)', password: '🐉'.repeat(14), message: 'Must be at least 15 characters' },
        { label: '129 caractères', password: 'a'.repeat(129), message: 'Must be at most 128 characters' }
    ])('mot de passe refusé : $label', async ({ password, message }) => {
        expectErrorResponse(await register({ name: 'Alice', email: 'alice@example.com', password }), 400, 'VALIDATION_ERROR', [
            { field: 'password', message }
        ])
    })

    it("la réponse d'erreur ne recopie jamais le mot de passe reçu", async () => {
        const password = 'trop-court-123'
        const response = await register({ name: 'Alice', email: 'alice@example.com', password })
        expect(response.status).toBe(400)
        expect(response.text).not.toContain(password)
    })

    it.each([
        { label: 'role', extra: { role: 'ADMIN' } },
        { label: 'passwordHash', extra: { passwordHash: 'x' } },
        { label: 'id', extra: { id: SOME_UUID } },
        { label: 'passwordConfirmation', extra: { passwordConfirmation: PASSWORD } }
    ])('champ $label refusé (« Unknown field ») : le client ne choisit ni rôle ni hash', async ({ label, extra }) => {
        const response = await register({ name: 'Alice', email: 'alice@example.com', password: PASSWORD, ...extra })
        expectErrorResponse(response, 400, 'VALIDATION_ERROR', [{ field: label, message: 'Unknown field' }])
        expect(await fresh.userRepository.findAll()).toEqual([])
    })

    it.each([
        { label: 'nom vide', body: { name: '   ', email: 'alice@example.com', password: PASSWORD }, field: 'name' },
        { label: 'mot de passe non textuel', body: { name: 'Alice', email: 'alice@example.com', password: 123456789012345 }, field: 'password' }
    ])('$label : 400', async ({ body, field }) => {
        expectErrorResponse(await register(body), 400, 'VALIDATION_ERROR', [{ field, message: expect.any(String) }])
    })
})

describe('POST /api/v1/auth/register : email déjà utilisé (409)', () => {
    it.each(['alice@example.com', 'ALICE@example.COM'])('%s : 409 EMAIL_ALREADY_USED, aucun second compte', async (email) => {
        await register({ name: 'Alice', email: 'alice@example.com', password: PASSWORD })

        const response = await register({ name: 'Copie', email, password: 'another strong password' })

        expectErrorResponse(response, 409, 'EMAIL_ALREADY_USED', [])
        expect(response.body.message).toBe('Email already taken')
        expect(await fresh.userRepository.findAll()).toHaveLength(1)
    })
})

describe('autres méthodes', () => {
    it('GET /api/v1/auth/register : 404 (seul POST est prévu)', async () => {
        expectErrorResponse(await request(app).get(REGISTER), 404, 'ROUTE_NOT_FOUND', [])
    })
})
