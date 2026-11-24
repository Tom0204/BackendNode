import type { Express } from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { MAX_CHARACTERS_PER_ACCOUNT } from '../../src/config/gameplay'
import { UNKNOWN_ID } from '../helpers/character-repository-contract'
import { bearer, createTestAccount, loadFreshApp, type FreshApp, type TestAccount } from '../helpers/fresh-modules'
import { expectErrorResponse, expectSuccessResponse } from '../helpers/http'
import { IN_MEMORY_STARTING_ZONE_ID } from '../helpers/in-memory-character-repository'

/* Classes (CHAR-01) et personnages (CHAR-02 à CHAR-05) par HTTP : application réelle, repositories en mémoire. */

const CLASSES = '/api/v1/classes'
const CHARACTERS = '/api/v1/characters'
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

let fresh: FreshApp
let app: Express
let alice: TestAccount
let bob: TestAccount
let admin: TestAccount
let warriorId: string
let mageId: string

beforeEach(async () => {
    fresh = await loadFreshApp()
    app = fresh.app
    alice = await createTestAccount(fresh, { name: 'Alice', email: 'alice@example.com' })
    bob = await createTestAccount(fresh, { name: 'Bob', email: 'bob@example.com' })
    admin = await createTestAccount(fresh, { name: 'Admin', email: 'admin@example.com', role: 'ADMIN' })
    warriorId = fresh.characterClassRepository.byCode('warrior').id
    mageId = fresh.characterClassRepository.byCode('mage').id
})

const createAs = (account: TestAccount, body: object) =>
    request(app).post(CHARACTERS).set('Authorization', bearer(account.token)).send(body)
const getAs = (account: TestAccount, path: string) => request(app).get(path).set('Authorization', bearer(account.token))

describe('GET /api/v1/classes (CHAR-01, public)', () => {
    it('sans jeton : 200, les trois classes dans leur forme publique exacte', async () => {
        const response = await request(app).get(CLASSES)

        expectSuccessResponse(response, 200, 'Classes retrieved successfully')
        expect(response.body.data).toHaveLength(3)
        expect(response.body.data[0]).toEqual({
            id: warriorId,
            code: 'warrior',
            name: 'Guerrier',
            baseStats: { hp: 120, mana: 20, attack: 12, defense: 8, speed: 8 },
            statsPerLevel: { hp: 12, mana: 2, attack: 2, defense: 2, speed: 1 }
        })
        expect(response.body.data.map((characterClass: { code: string }) => characterClass.code)).toEqual(['warrior', 'mage', 'rogue'])
    })

    it('détail : 200 ; classe inconnue : 404 CLASS_NOT_FOUND ; identifiant non UUID : 400', async () => {
        expectSuccessResponse(await request(app).get(`${CLASSES}/${mageId}`), 200, 'Class retrieved successfully', {
            id: mageId,
            code: 'mage',
            name: 'Mage',
            baseStats: { hp: 80, mana: 100, attack: 10, defense: 4, speed: 10 },
            statsPerLevel: { hp: 8, mana: 10, attack: 2, defense: 1, speed: 1 }
        })
        expectErrorResponse(await request(app).get(`${CLASSES}/${UNKNOWN_ID}`), 404, 'CLASS_NOT_FOUND', [])
        expectErrorResponse(await request(app).get(`${CLASSES}/warrior`), 400, 'VALIDATION_ERROR', [
            { field: 'classId', message: 'Must be a valid UUID' }
        ])
    })

    it.each([
        { method: 'post', path: CLASSES },
        { method: 'put', path: `${CLASSES}/${UNKNOWN_ID}` },
        { method: 'patch', path: `${CLASSES}/${UNKNOWN_ID}` },
        { method: 'delete', path: `${CLASSES}/${UNKNOWN_ID}` }
    ] as const)('aucune écriture, même pour un administrateur : $method $path → 404 ROUTE_NOT_FOUND', async ({ method, path }) => {
        expectErrorResponse(await request(app)[method](path).set('Authorization', bearer(admin.token)).send({}), 404, 'ROUTE_NOT_FOUND', [])
    })

    it('paramètre de requête inconnu : 400', async () => {
        expectErrorResponse(await request(app).get(`${CLASSES}?sort=name`), 400, 'VALIDATION_ERROR', [
            { field: 'sort', message: 'Unknown query parameter' }
        ])
    })
})

describe('POST /api/v1/characters (CHAR-03)', () => {
    it('201 : forme publique exacte, valeurs initiales fixées par le serveur', async () => {
        const response = await createAs(alice, { name: 'Arthas', classId: warriorId })

        expectSuccessResponse(response, 201, 'Character created successfully', {
            id: expect.any(String),
            name: 'Arthas',
            classId: warriorId,
            level: 1,
            experience: 0,
            currentZoneId: IN_MEMORY_STARTING_ZONE_ID,
            createdAt: expect.stringMatching(ISO_DATE)
        })
        expect(response.text).not.toContain(alice.user.id)
        expect((await fresh.characterRepository.findById(response.body.data.id))?.userId).toBe(alice.user.id)
    })

    it('sans jeton : 401, rien de créé', async () => {
        expectErrorResponse(await request(app).post(CHARACTERS).send({ name: 'Arthas', classId: warriorId }), 401, 'UNAUTHENTICATED', [])
        expect(await fresh.characterRepository.countByUserId(alice.user.id)).toBe(0)
    })

    it.each([
        { label: 'level', extra: { level: 10 } },
        { label: 'experience', extra: { experience: 5000 } },
        { label: 'currentZoneId', extra: { currentZoneId: UNKNOWN_ID } },
        { label: 'userId', extra: { userId: UNKNOWN_ID } },
        { label: 'hp', extra: { hp: 9999 } }
    ])('champ $label refusé (400 « Unknown field ») : le client ne fixe que name et classId', async ({ label, extra }) => {
        expectErrorResponse(await createAs(alice, { name: 'Arthas', classId: warriorId, ...extra }), 400, 'VALIDATION_ERROR', [
            { field: label, message: 'Unknown field' }
        ])
        expect(await fresh.characterRepository.countByUserId(alice.user.id)).toBe(0)
    })

    it('le propriétaire vient du jeton : userId d’un autre compte refusé, aucun personnage pour Bob', async () => {
        await createAs(alice, { name: 'Arthas', classId: warriorId, userId: bob.user.id })
        expect(await fresh.characterRepository.countByUserId(bob.user.id)).toBe(0)
    })

    it.each(['Ab', 'Abcdefghijklmnopq', 'Élise', 'Arthas2', 'Art has', 'Art-has', '', 'Ａrthas'])(
        'nom invalide %j : 400 avec le message de la règle',
        async (name) => {
            expectErrorResponse(await createAs(alice, { name, classId: warriorId }), 400, 'VALIDATION_ERROR', [
                { field: 'name', message: 'Must be 3 to 16 letters (A-Z, a-z)' }
            ])
        }
    )

    it.each(['Abc', 'ABCDEFGHIJKLMNOP', 'arthas'])('nom valide %j : 201, nom conservé tel que saisi', async (name) => {
        const response = await createAs(alice, { name, classId: warriorId })
        expect(response.status).toBe(201)
        expect(response.body.data.name).toBe(name)
    })

    it('corps vide : name et classId signalés ; classId non UUID : 400', async () => {
        expectErrorResponse(await createAs(alice, {}), 400, 'VALIDATION_ERROR', [
            { field: 'name', message: expect.any(String) },
            { field: 'classId', message: expect.any(String) }
        ])
        expectErrorResponse(await createAs(alice, { name: 'Arthas', classId: 'warrior' }), 400, 'VALIDATION_ERROR', [
            { field: 'classId', message: 'Must be a valid UUID' }
        ])
    })

    it('classe inexistante : 422 CLASS_NOT_FOUND', async () => {
        expectErrorResponse(await createAs(alice, { name: 'Arthas', classId: UNKNOWN_ID }), 422, 'CLASS_NOT_FOUND', [])
    })

    it(`limite : le ${MAX_CHARACTERS_PER_ACCOUNT + 1}e personnage reçoit 409 CHARACTER_LIMIT_REACHED`, async () => {
        for (const name of ['Arthas', 'Jaina', 'Thrall', 'Sylvanas', 'Uther']) {
            expect((await createAs(alice, { name, classId: warriorId })).status).toBe(201)
        }
        expectErrorResponse(await createAs(alice, { name: 'Varian', classId: mageId }), 409, 'CHARACTER_LIMIT_REACHED', [])
        // La limite est par compte.
        expect((await createAs(bob, { name: 'Varian', classId: mageId })).status).toBe(201)
    })

    it('nom déjà pris par un autre joueur, quelle que soit la casse : 409 CHARACTER_NAME_TAKEN', async () => {
        expect((await createAs(bob, { name: 'Arthas', classId: warriorId })).status).toBe(201)
        expectErrorResponse(await createAs(alice, { name: 'ARTHAS', classId: mageId }), 409, 'CHARACTER_NAME_TAKEN', [])
    })
})

describe('GET /api/v1/characters (CHAR-04)', () => {
    it('compte sans personnage : 200 avec []', async () => {
        expectSuccessResponse(await getAs(alice, CHARACTERS), 200, 'Characters retrieved successfully', [])
    })

    it('seulement les personnages du compte authentifié, administrateur compris', async () => {
        const arthas = (await createAs(alice, { name: 'Arthas', classId: warriorId })).body.data
        const jaina = (await createAs(alice, { name: 'Jaina', classId: mageId })).body.data
        await createAs(bob, { name: 'Thrall', classId: warriorId })

        const response = await getAs(alice, CHARACTERS)
        expect(response.status).toBe(200)
        expect(response.body.data).toHaveLength(2)
        expect(response.body.data).toEqual(expect.arrayContaining([arthas, jaina]))
        expect(response.body).not.toHaveProperty('meta')
        expectSuccessResponse(await getAs(admin, CHARACTERS), 200, 'Characters retrieved successfully', [])
    })

    it('sans jeton : 401 ; paramètre de requête (userId) refusé : 400', async () => {
        expectErrorResponse(await request(app).get(CHARACTERS), 401, 'UNAUTHENTICATED', [])
        expectErrorResponse(await getAs(alice, `${CHARACTERS}?userId=${bob.user.id}`), 400, 'VALIDATION_ERROR', [
            { field: 'userId', message: 'Unknown query parameter' }
        ])
    })
})

describe('GET /api/v1/characters/:characterId (CHAR-05)', () => {
    let arthas: { id: string }

    beforeEach(async () => {
        arthas = (await createAs(alice, { name: 'Arthas', classId: warriorId })).body.data
    })

    it('propriétaire : 200 avec la même forme que la liste', async () => {
        const response = await getAs(alice, `${CHARACTERS}/${arthas.id}`)
        expectSuccessResponse(response, 200, 'Character retrieved successfully', arthas)
    })

    it('autre joueur, administrateur et identifiant inconnu : réponses 404 CHARACTER_NOT_FOUND identiques', async () => {
        const other = await getAs(bob, `${CHARACTERS}/${arthas.id}`)
        const asAdmin = await getAs(admin, `${CHARACTERS}/${arthas.id}`)
        const unknown = await getAs(alice, `${CHARACTERS}/${UNKNOWN_ID}`)

        expectErrorResponse(other, 404, 'CHARACTER_NOT_FOUND', [])
        expect(other.body).toEqual({ success: false, message: 'Character not found', error: { code: 'CHARACTER_NOT_FOUND', details: [] } })
        expect(asAdmin.body).toEqual(other.body)
        expect(unknown.body).toEqual(other.body)
    })

    it('identifiant non UUID : 400 ; sans jeton : 401', async () => {
        expectErrorResponse(await getAs(alice, `${CHARACTERS}/1`), 400, 'VALIDATION_ERROR', [
            { field: 'characterId', message: 'Must be a valid UUID' }
        ])
        expectErrorResponse(await request(app).get(`${CHARACTERS}/${arthas.id}`), 401, 'UNAUTHENTICATED', [])
    })

    it('renommage et suppression non disponibles (CHAR-06, CHAR-07) : 404 ROUTE_NOT_FOUND', async () => {
        expectErrorResponse(
            await request(app).patch(`${CHARACTERS}/${arthas.id}`).set('Authorization', bearer(alice.token)).send({ name: 'Uther' }),
            404,
            'ROUTE_NOT_FOUND',
            []
        )
        expectErrorResponse(await request(app).delete(`${CHARACTERS}/${arthas.id}`).set('Authorization', bearer(alice.token)), 404, 'ROUTE_NOT_FOUND', [])
    })
})
