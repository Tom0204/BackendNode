import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MAX_CHARACTERS_PER_ACCOUNT, MAX_LEVEL } from '../../src/config/gameplay'
import { closeDatabase, createDatabase, type Database } from '../../src/database/client'
import { createPrismaCharacterRepository, type CharacterRepository } from '../../src/repositories/character.repository'
import { createPrismaUserRepository } from '../../src/repositories/user.repository'
import { applyExperienceGain } from '../../src/services/experience'
import { createProgressionService, type ProgressionService } from '../../src/services/progression.service'
import type { Character } from '../../src/types/character'
import { startAppInstance, stopAppInstance, type AppInstance } from '../helpers/database-app'
import { expectSuccessResponse } from '../helpers/http'
import { deleteAllPlayerData } from '../helpers/player-fixtures'
import { requireSafeTestDatabaseUrl } from '../helpers/test-database'
import { newUser } from '../helpers/user-repository-contract'

/* Attribution d'XP (STAT-04) et statistiques (STAT-02) sur PostgreSQL (mmorpg_test) : persistance, attributions
 * simultanées sans gain perdu, verrou réellement pris, annulation et libération du verrou en cas d'échec.
 */

let database: Database
let characters: CharacterRepository
let progression: ProgressionService
let arthas: Character

const WAIT_MS = 300
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Résultat attendu de gains appliqués l'un après l'autre depuis le niveau 1 (calcul pur de STAT-03). */
function sequentially(gains: number[]) {
    let progression = { level: 1, experience: 0 }
    for (const gain of gains) {
        const { level, experience } = applyExperienceGain(progression, gain)
        progression = { level, experience }
    }
    return progression
}

const stored = async (id: string) =>
    database.prisma.character.findUniqueOrThrow({ where: { id }, select: { level: true, experience: true } })

beforeAll(() => {
    database = createDatabase(requireSafeTestDatabaseUrl())
})

beforeEach(async () => {
    await deleteAllPlayerData(database.prisma)
    characters = createPrismaCharacterRepository(database.prisma)
    progression = createProgressionService({ characterRepository: characters })
    const owner = await createPrismaUserRepository(database.prisma).create(newUser('Owner', 'owner@test.local'))
    const classId = (await database.prisma.characterClass.findUniqueOrThrow({ where: { code: 'warrior' } })).id
    arthas = await characters.createWithinLimit({ userId: owner.id, classId, name: 'Arthas' }, MAX_CHARACTERS_PER_ACCOUNT)
})

afterAll(async () => {
    await deleteAllPlayerData(database.prisma)
    await closeDatabase(database)
})

describe('grantExperience sur PostgreSQL (STAT-04)', () => {
    it('persistance : exemple de rules.md (90 puis 300 XP → niveau 3 avec 7 XP), date de modification mise à jour', async () => {
        await progression.grantExperience(arthas.id, 90)
        const grant = await progression.grantExperience(arthas.id, 300)
        expect(grant).toMatchObject({ levelsGained: 2, character: { level: 3, experience: 7 } })
        expect(await stored(arthas.id)).toEqual({ level: 3, experience: 7 })
        expect(grant.character.updatedAt.getTime()).toBeGreaterThanOrEqual(arthas.updatedAt.getTime())
    })

    it('seuil exact, puis niveau maximal avec reste perdu, puis gain ignoré', async () => {
        await progression.grantExperience(arthas.id, 100)
        expect(await stored(arthas.id)).toEqual({ level: 2, experience: 0 })
        await progression.grantExperience(arthas.id, 20000)
        expect(await stored(arthas.id)).toEqual({ level: MAX_LEVEL, experience: 0 })
        await progression.grantExperience(arthas.id, 60)
        expect(await stored(arthas.id)).toEqual({ level: MAX_LEVEL, experience: 0 })
    })

    it('20 attributions simultanées de 60 XP : aucun gain perdu, même résultat qu’en séquence', async () => {
        const gains = Array.from({ length: 20 }, () => 60)
        const results = await Promise.all(gains.map((gain) => progression.grantExperience(arthas.id, gain)))

        const expected = sequentially(gains)
        expect(expected).toEqual({ level: 4, experience: 297 })
        expect(await stored(arthas.id)).toEqual(expected)
        // Chaque attribution a vu l'état laissé par la précédente : les niveaux gagnés s'additionnent exactement.
        expect(results.reduce((total, result) => total + result.levelsGained, 0)).toBe(expected.level - 1)
    })

    it('attributions simultanées de montants différents : total conservé, quel que soit l’ordre', async () => {
        const gains = [25, 40, 60, 25, 40, 60, 300, 1, 99, 500]
        await Promise.all(gains.map((gain) => progression.grantExperience(arthas.id, gain)))
        // Sous le niveau maximal, le résultat ne dépend que du total.
        expect(await stored(arthas.id)).toEqual(sequentially([gains.reduce((total, gain) => total + gain, 0)]))
    })

    it('attributions simultanées qui dépassent le niveau maximal : niveau 10, XP 0', async () => {
        await Promise.all(Array.from({ length: 12 }, () => progression.grantExperience(arthas.id, 1000)))
        expect(await stored(arthas.id)).toEqual({ level: MAX_LEVEL, experience: 0 })
    })

    it('le verrou est réellement pris : une attribution attend la fin d’une transaction qui tient la ligne', async () => {
        let release: () => void = () => undefined
        const released = new Promise<void>((resolve) => {
            release = resolve
        })
        let locked: () => void = () => undefined
        const lockTaken = new Promise<void>((resolve) => {
            locked = resolve
        })
        const holder = database.prisma.$transaction(
            async (tx) => {
                await tx.$queryRaw`SELECT id FROM characters WHERE id = ${arthas.id}::uuid FOR UPDATE`
                locked()
                await released
            },
            { timeout: 10_000 }
        )
        await lockTaken

        let finished = false
        const grant = progression.grantExperience(arthas.id, 25).then((result) => {
            finished = true
            return result
        })
        await sleep(WAIT_MS)
        expect(finished).toBe(false)
        expect(await stored(arthas.id)).toEqual({ level: 1, experience: 0 })

        release()
        await holder
        await expect(grant).resolves.toMatchObject({ character: { level: 1, experience: 25 } })
    })

    it('échec pendant la transaction (après le verrou et le calcul) : tout est annulé, le verrou est libéré', async () => {
        // Panne simulée au moment de l'écriture, dans une vraie transaction : le verrou est déjà pris et le calcul fait.
        const failure = new Error('panne simulée pendant la transaction')
        const steps: string[] = []
        const failingPrisma = new Proxy(database.prisma, {
            get(target, property) {
                if (property !== '$transaction') {
                    return Reflect.get(target, property)
                }
                return (callback: (tx: unknown) => Promise<unknown>) =>
                    target.$transaction(async (tx) => {
                        const failingCharacter = new Proxy(tx.character, {
                            get(delegate, method) {
                                if (method === 'update') {
                                    steps.push('update')
                                    return () => Promise.reject(failure)
                                }
                                return Reflect.get(delegate, method)
                            }
                        })
                        const failingTx = new Proxy(tx, {
                            get(client, name) {
                                if (name === '$queryRaw') {
                                    steps.push('lock')
                                }
                                return name === 'character' ? failingCharacter : Reflect.get(client, name)
                            }
                        })
                        return callback(failingTx)
                    })
            }
        })
        const failing = createProgressionService({ characterRepository: createPrismaCharacterRepository(failingPrisma) })

        await expect(failing.grantExperience(arthas.id, 300)).rejects.toBe(failure)
        expect(steps).toEqual(['lock', 'update'])
        expect(await stored(arthas.id)).toEqual({ level: 1, experience: 0 })

        // Le verrou est libéré : une nouvelle attribution aboutit aussitôt.
        await expect(progression.grantExperience(arthas.id, 300)).resolves.toMatchObject({ character: { level: 2, experience: 200 } })
    })

    it('erreur du calcul (progression enregistrée incohérente) : annulation, rien n’est écrit, verrou libéré', async () => {
        // État impossible par l'API, posé directement en base pour vérifier qu'il n'est jamais corrigé en silence.
        await database.prisma.character.update({ where: { id: arthas.id }, data: { level: MAX_LEVEL, experience: 5 } })
        await expect(progression.grantExperience(arthas.id, 10)).rejects.toBeInstanceOf(RangeError)
        expect(await stored(arthas.id)).toEqual({ level: MAX_LEVEL, experience: 5 })

        await database.prisma.character.update({ where: { id: arthas.id }, data: { level: 1, experience: 0 } })
        await expect(progression.grantExperience(arthas.id, 10)).resolves.toMatchObject({ character: { level: 1, experience: 10 } })
    })

    it('personnage inexistant : 404 CHARACTER_NOT_FOUND, aucune écriture', async () => {
        await expect(progression.grantExperience('00000000-0000-7000-8000-0000000000ff', 10)).rejects.toMatchObject({
            status: 404,
            code: 'CHARACTER_NOT_FOUND'
        })
        expect(await stored(arthas.id)).toEqual({ level: 1, experience: 0 })
    })
})

describe('GET /characters/:characterId/stats sur PostgreSQL (STAT-02)', () => {
    let instance: AppInstance

    beforeAll(async () => {
        instance = await startAppInstance()
    })

    afterAll(async () => {
        await stopAppInstance(instance)
    })

    it('parcours : inscription, connexion, création, XP attribuée par le serveur, statistiques aux niveaux 1, 5 et 10', async () => {
        const password = 'correct horse battery staple'
        await request(instance.app).post('/api/v1/auth/register').send({ name: 'Alice', email: 'alice@example.com', password })
        const token = (await request(instance.app).post('/api/v1/auth/login').send({ email: 'alice@example.com', password })).body.data
            .accessToken
        const rogueId = (await database.prisma.characterClass.findUniqueOrThrow({ where: { code: 'rogue' } })).id
        const created = await request(instance.app)
            .post('/api/v1/characters')
            .set('Authorization', `Bearer ${token}`)
            .send({ name: 'Valeera', classId: rogueId })
        const id: string = created.body.data.id
        const getStats = () => request(instance.app).get(`/api/v1/characters/${id}/stats`).set('Authorization', `Bearer ${token}`)
        const baseStats = { hp: 95, mana: 40, attack: 11, defense: 6, speed: 14 }

        expectSuccessResponse(await getStats(), 200, 'Character stats retrieved successfully', {
            characterId: id,
            level: 1,
            baseStats,
            stats: baseStats,
            resources: { hp: 95, mana: 40 }
        })

        await progression.grantExperience(id, 1703)
        expectSuccessResponse(await getStats(), 200, 'Character stats retrieved successfully', {
            characterId: id,
            level: 5,
            baseStats,
            stats: { hp: 135, mana: 56, attack: 19, defense: 10, speed: 22 },
            resources: { hp: 135, mana: 56 }
        })

        await progression.grantExperience(id, 1_000_000)
        expectSuccessResponse(await getStats(), 200, 'Character stats retrieved successfully', {
            characterId: id,
            level: 10,
            baseStats,
            stats: { hp: 185, mana: 76, attack: 29, defense: 15, speed: 32 },
            resources: { hp: 185, mana: 76 }
        })
        expect(await stored(id)).toEqual({ level: 10, experience: 0 })
    })
})
