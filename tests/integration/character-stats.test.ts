import type { Express } from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { createProgressionService, type ProgressionService } from '../../src/services/progression.service'
import { UNKNOWN_ID } from '../helpers/character-repository-contract'
import { bearer, createTestAccount, loadFreshApp, type FreshApp, type TestAccount } from '../helpers/fresh-modules'
import { expectErrorResponse, expectSuccessResponse } from '../helpers/http'

/* Statistiques d'un personnage par HTTP (STAT-02) et absence de toute route d'écriture du niveau ou de l'XP
 * (STAT-04) : application réelle, repositories en mémoire. L'XP est attribuée par le service interne.
 */

const CHARACTERS = '/api/v1/characters'

let fresh: FreshApp
let app: Express
let progression: ProgressionService
let alice: TestAccount
let bob: TestAccount
let admin: TestAccount
let arthasId: string
let jainaId: string

beforeEach(async () => {
    fresh = await loadFreshApp()
    app = fresh.app
    progression = createProgressionService({ characterRepository: fresh.characterRepository })
    alice = await createTestAccount(fresh, { name: 'Alice', email: 'alice@example.com' })
    bob = await createTestAccount(fresh, { name: 'Bob', email: 'bob@example.com' })
    admin = await createTestAccount(fresh, { name: 'Admin', email: 'admin@example.com', role: 'ADMIN' })
    const create = (account: TestAccount, name: string, code: string) =>
        request(app)
            .post(CHARACTERS)
            .set('Authorization', bearer(account.token))
            .send({ name, classId: fresh.characterClassRepository.byCode(code).id })
    arthasId = (await create(alice, 'Arthas', 'warrior')).body.data.id
    jainaId = (await create(alice, 'Jaina', 'mage')).body.data.id
})

const statsPath = (id: string) => `${CHARACTERS}/${id}/stats`
const getStats = (account: TestAccount, id: string) => request(app).get(statsPath(id)).set('Authorization', bearer(account.token))

describe('GET /api/v1/characters/:characterId/stats (STAT-02)', () => {
    it('propriétaire, niveau 1 : forme exacte, stats = baseStats, ressources au maximum', async () => {
        expectSuccessResponse(await getStats(alice, arthasId), 200, 'Character stats retrieved successfully', {
            characterId: arthasId,
            level: 1,
            baseStats: { hp: 120, mana: 20, attack: 12, defense: 8, speed: 8 },
            stats: { hp: 120, mana: 20, attack: 12, defense: 8, speed: 8 },
            resources: { hp: 120, mana: 20 }
        })
    })

    it('niveau 5 (1 703 XP attribuées par le serveur) : guerrier à 168 PV et 20 d’attaque', async () => {
        await progression.grantExperience(arthasId, 1703)
        expectSuccessResponse(await getStats(alice, arthasId), 200, 'Character stats retrieved successfully', {
            characterId: arthasId,
            level: 5,
            baseStats: { hp: 120, mana: 20, attack: 12, defense: 8, speed: 8 },
            stats: { hp: 168, mana: 28, attack: 20, defense: 16, speed: 12 },
            resources: { hp: 168, mana: 28 }
        })
    })

    it('niveau 10 : mage aux statistiques maximales ; le détail du personnage montre niveau 10 et XP 0', async () => {
        await progression.grantExperience(jainaId, 50000)
        expectSuccessResponse(await getStats(alice, jainaId), 200, 'Character stats retrieved successfully', {
            characterId: jainaId,
            level: 10,
            baseStats: { hp: 80, mana: 100, attack: 10, defense: 4, speed: 10 },
            stats: { hp: 152, mana: 190, attack: 28, defense: 13, speed: 19 },
            resources: { hp: 152, mana: 190 }
        })
        const detail = await request(app).get(`${CHARACTERS}/${jainaId}`).set('Authorization', bearer(alice.token))
        expect(detail.body.data).toMatchObject({ level: 10, experience: 0 })
    })

    it('passage de plusieurs niveaux (90 puis 300 XP) : niveau 3, statistiques du niveau 3', async () => {
        await progression.grantExperience(arthasId, 90)
        await progression.grantExperience(arthasId, 300)
        const response = await getStats(alice, arthasId)
        expect(response.body.data).toMatchObject({ level: 3, stats: { hp: 144, mana: 24, attack: 16, defense: 12, speed: 10 } })
        const detail = await request(app).get(`${CHARACTERS}/${arthasId}`).set('Authorization', bearer(alice.token))
        expect(detail.body.data).toMatchObject({ level: 3, experience: 7 })
    })

    it('autre joueur, administrateur et identifiant inconnu : réponses 404 CHARACTER_NOT_FOUND identiques', async () => {
        const other = await getStats(bob, arthasId)
        expectErrorResponse(other, 404, 'CHARACTER_NOT_FOUND', [])
        expect(other.body).toEqual({ success: false, message: 'Character not found', error: { code: 'CHARACTER_NOT_FOUND', details: [] } })
        expect((await getStats(admin, arthasId)).body).toEqual(other.body)
        expect((await getStats(alice, UNKNOWN_ID)).body).toEqual(other.body)
    })

    it('sans jeton : 401 ; identifiant non UUID : 400 ; paramètre de requête inconnu : 400', async () => {
        expectErrorResponse(await request(app).get(statsPath(arthasId)), 401, 'UNAUTHENTICATED', [])
        expectErrorResponse(await getStats(alice, 'abc'), 400, 'VALIDATION_ERROR', [{ field: 'characterId', message: 'Must be a valid UUID' }])
        expectErrorResponse(
            await request(app).get(`${statsPath(arthasId)}?level=10`).set('Authorization', bearer(alice.token)),
            400,
            'VALIDATION_ERROR'
        )
    })
})

describe('aucune route ne modifie le niveau ni l’expérience (STAT-04)', () => {
    const attempts: Array<[string, (path: string) => request.Test, (id: string) => string]> = [
        ['POST /:characterId/stats', (path) => request(app).post(path), statsPath],
        ['PUT /:characterId/stats', (path) => request(app).put(path), statsPath],
        ['PATCH /:characterId/stats', (path) => request(app).patch(path), statsPath],
        ['DELETE /:characterId/stats', (path) => request(app).delete(path), statsPath],
        ['POST /:characterId/experience', (path) => request(app).post(path), (id) => `${CHARACTERS}/${id}/experience`],
        ['PATCH /:characterId/experience', (path) => request(app).patch(path), (id) => `${CHARACTERS}/${id}/experience`],
        ['POST /:characterId/level', (path) => request(app).post(path), (id) => `${CHARACTERS}/${id}/level`],
        ['PUT /:characterId', (path) => request(app).put(path), (id) => `${CHARACTERS}/${id}`],
        ['PATCH /:characterId', (path) => request(app).patch(path), (id) => `${CHARACTERS}/${id}`],
        ['POST /:characterId', (path) => request(app).post(path), (id) => `${CHARACTERS}/${id}`]
    ]

    it.each(attempts)('%s par le propriétaire : 404 ROUTE_NOT_FOUND, personnage inchangé', async (_label, send, path) => {
        const response = await send(path(arthasId))
            .set('Authorization', bearer(alice.token))
            .send({ level: 10, experience: 2699, amount: 100000 })
        expectErrorResponse(response, 404, 'ROUTE_NOT_FOUND', [])
        expect(await fresh.characterRepository.findById(arthasId)).toMatchObject({ level: 1, experience: 0 })
    })

    it('création avec level ou experience : 400, aucun personnage créé', async () => {
        const response = await request(app)
            .post(CHARACTERS)
            .set('Authorization', bearer(bob.token))
            .send({ name: 'Thrall', classId: fresh.characterClassRepository.byCode('rogue').id, level: 10, experience: 500 })
        expectErrorResponse(response, 400, 'VALIDATION_ERROR')
        expect(await fresh.characterRepository.countByUserId(bob.user.id)).toBe(0)
    })
})
