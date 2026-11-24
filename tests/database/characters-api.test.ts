import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { MAX_CHARACTERS_PER_ACCOUNT, STARTING_ZONE_CODE } from '../../src/config/gameplay'
import { startAppInstance, stopAppInstance, type AppInstance } from '../helpers/database-app'
import { expectErrorResponse, expectSuccessResponse } from '../helpers/http'
import { deleteAllPlayerData } from '../helpers/player-fixtures'

/* Parcours des étapes 1 à 4 et 6 du MVP (mvp-scope.md §2) sur PostgreSQL (mmorpg_test), application assemblée
 * comme dans server.ts : inscription → connexion → classes → création de personnages → liste → détail.
 */

const PASSWORD = 'correct horse battery staple'
const CHARACTERS = '/api/v1/characters'

let instance: AppInstance
let aliceToken: string
let bobToken: string
let warriorId: string
let startingZoneId: string

async function registerAndLogin(name: string, email: string): Promise<string> {
    await request(instance.app).post('/api/v1/auth/register').send({ name, email, password: PASSWORD })
    return (await request(instance.app).post('/api/v1/auth/login').send({ email, password: PASSWORD })).body.data.accessToken
}

const createAs = (token: string, body: object) => request(instance.app).post(CHARACTERS).set('Authorization', `Bearer ${token}`).send(body)
const getAs = (token: string, path: string) => request(instance.app).get(path).set('Authorization', `Bearer ${token}`)

beforeAll(async () => {
    instance = await startAppInstance()
    await deleteAllPlayerData(instance.database.prisma)
    aliceToken = await registerAndLogin('Alice', 'alice@example.com')
    bobToken = await registerAndLogin('Bob', 'bob@example.com')
    startingZoneId = (await instance.database.prisma.zone.findUniqueOrThrow({ where: { code: STARTING_ZONE_CODE } })).id
})

afterAll(async () => {
    await deleteAllPlayerData(instance.database.prisma)
    await stopAppInstance(instance)
})

describe('Personnages sur PostgreSQL', () => {
    it('GET /classes sans jeton : les trois classes du seed', async () => {
        const response = await request(instance.app).get('/api/v1/classes')
        expectSuccessResponse(response, 200, 'Classes retrieved successfully')
        expect(response.body.data.map((characterClass: { code: string }) => characterClass.code)).toEqual(['warrior', 'mage', 'rogue'])
        warriorId = response.body.data[0].id
    })

    it('POST /characters : 201, enregistré pour le compte du jeton, dans la zone de départ réelle', async () => {
        const response = await createAs(aliceToken, { name: 'Arthas', classId: warriorId })
        expectSuccessResponse(response, 201, 'Character created successfully', {
            id: expect.any(String),
            name: 'Arthas',
            classId: warriorId,
            level: 1,
            experience: 0,
            currentZoneId: startingZoneId,
            createdAt: expect.any(String)
        })
        const row = await instance.database.prisma.character.findUniqueOrThrow({
            where: { id: response.body.data.id },
            include: { user: { select: { email: true } } }
        })
        expect(row).toMatchObject({ normalizedName: 'arthas', user: { email: 'alice@example.com' } })
        expect(row.createdAt.toISOString()).toBe(response.body.data.createdAt)
    })

    it('nom pris par un autre joueur (casse différente) : 409 CHARACTER_NAME_TAKEN', async () => {
        expectErrorResponse(await createAs(bobToken, { name: 'arthas', classId: warriorId }), 409, 'CHARACTER_NAME_TAKEN', [])
    })

    it('requêtes de création simultanées pour Bob : exactement 5 personnages, les autres reçoivent 409', async () => {
        const names = ['Thrall', 'Jaina', 'Sylvanas', 'Uther', 'Varian', 'Anduin', 'Garrosh']
        const responses = await Promise.all(names.map((name) => createAs(bobToken, { name, classId: warriorId })))

        expect(responses.filter((response) => response.status === 201)).toHaveLength(MAX_CHARACTERS_PER_ACCOUNT)
        const refused = responses.filter((response) => response.status !== 201)
        expect(refused).toHaveLength(names.length - MAX_CHARACTERS_PER_ACCOUNT)
        for (const response of refused) {
            expectErrorResponse(response, 409, 'CHARACTER_LIMIT_REACHED', [])
        }
        const bob = await instance.database.prisma.user.findUniqueOrThrow({ where: { email: 'bob@example.com' } })
        expect(await instance.database.prisma.character.count({ where: { userId: bob.id } })).toBe(MAX_CHARACTERS_PER_ACCOUNT)
    })

    it('GET /characters : chacun ne voit que ses personnages', async () => {
        const alice = await getAs(aliceToken, CHARACTERS)
        const bob = await getAs(bobToken, CHARACTERS)
        expect(alice.body.data.map((character: { name: string }) => character.name)).toEqual(['Arthas'])
        expect(bob.body.data).toHaveLength(MAX_CHARACTERS_PER_ACCOUNT)
        expect(bob.body.data.some((character: { name: string }) => character.name === 'Arthas')).toBe(false)
    })

    it('GET /characters/:characterId : propriétaire 200, autre joueur 404 identique à un identifiant inconnu', async () => {
        const [arthas] = (await getAs(aliceToken, CHARACTERS)).body.data
        expectSuccessResponse(await getAs(aliceToken, `${CHARACTERS}/${arthas.id}`), 200, 'Character retrieved successfully', arthas)

        const other = await getAs(bobToken, `${CHARACTERS}/${arthas.id}`)
        const unknown = await getAs(bobToken, `${CHARACTERS}/00000000-0000-7000-8000-0000000000ff`)
        expectErrorResponse(other, 404, 'CHARACTER_NOT_FOUND', [])
        expect(other.body).toEqual(unknown.body)
    })

    it('suppression du compte de Bob par lui-même : ses personnages sont supprimés, ceux d’Alice restent', async () => {
        const bob = await instance.database.prisma.user.findUniqueOrThrow({ where: { email: 'bob@example.com' } })
        const response = await request(instance.app).delete(`/api/v1/users/${bob.id}`).set('Authorization', `Bearer ${bobToken}`)
        expect(response.status).toBe(204)
        expect(await instance.database.prisma.character.count({ where: { userId: bob.id } })).toBe(0)
        expect((await getAs(aliceToken, CHARACTERS)).body.data).toHaveLength(1)
    })
})
