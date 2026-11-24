import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_LEVEL } from '../../src/config/gameplay'
import type { CharacterRepository } from '../../src/repositories/character.repository'
import { createCharacterService, type CharacterService } from '../../src/services/character.service'
import { createProgressionService, type ProgressionService } from '../../src/services/progression.service'
import type { AuthContext } from '../../src/types/auth'
import type { Character } from '../../src/types/character'
import type { User } from '../../src/types/user'
import { UNKNOWN_ID } from '../helpers/character-repository-contract'
import { rejectionOf } from '../helpers/errors'
import { createInMemoryCharacterClassRepository, type InMemoryCharacterClassRepository } from '../helpers/in-memory-character-class-repository'
import { createInMemoryCharacterRepository } from '../helpers/in-memory-character-repository'
import { createInMemoryUserRepository } from '../helpers/in-memory-user-repository'
import { newUser } from '../helpers/user-repository-contract'

/* Attribution d'XP (STAT-04) et statistiques d'un personnage (STAT-02), avec des repositories contrôlés. */

let classes: InMemoryCharacterClassRepository
let characters: CharacterRepository
let characterService: CharacterService
let progressionService: ProgressionService
let alice: User
let bob: User
let admin: User
let arthas: Character

const actorOf = (user: User): AuthContext => ({ userId: user.id, role: user.role, sessionId: 'session-de-test' })

beforeEach(async () => {
    const users = createInMemoryUserRepository()
    classes = createInMemoryCharacterClassRepository()
    characters = createInMemoryCharacterRepository({ users, classes })
    characterService = createCharacterService({ characterRepository: characters, characterClassRepository: classes })
    progressionService = createProgressionService({ characterRepository: characters })
    alice = await users.create(newUser('Alice', 'alice@example.com'))
    bob = await users.create(newUser('Bob', 'bob@example.com'))
    const created = await users.create(newUser('Admin', 'admin@example.com'))
    admin = (await users.setRole(created.id, 'ADMIN')) ?? created
    arthas = await characterService.create(actorOf(alice), { name: 'Arthas', classId: classes.byCode('warrior').id })
})

describe('progressionService.grantExperience (STAT-04)', () => {
    it('gain simple : XP enregistrée, aucun niveau gagné', async () => {
        const grant = await progressionService.grantExperience(arthas.id, 25)
        expect(grant.levelsGained).toBe(0)
        expect(grant.character).toMatchObject({ id: arthas.id, level: 1, experience: 25 })
        expect(await characters.findById(arthas.id)).toMatchObject({ level: 1, experience: 25 })
    })

    it('exemple de rules.md : 90 XP puis 300 XP → niveau 3 avec 7 XP, 2 niveaux gagnés', async () => {
        await progressionService.grantExperience(arthas.id, 90)
        const grant = await progressionService.grantExperience(arthas.id, 300)
        expect(grant).toMatchObject({ levelsGained: 2, character: { level: 3, experience: 7 } })
        expect(await characters.findById(arthas.id)).toMatchObject({ level: 3, experience: 7 })
    })

    it('seuil exact : niveau 2 avec 0 XP', async () => {
        expect(await progressionService.grantExperience(arthas.id, 100)).toMatchObject({ levelsGained: 1, character: { level: 2, experience: 0 } })
    })

    it('niveau maximal : atteint avec un reste perdu, puis gains ignorés', async () => {
        const reached = await progressionService.grantExperience(arthas.id, 20000)
        expect(reached).toMatchObject({ levelsGained: MAX_LEVEL - 1, character: { level: MAX_LEVEL, experience: 0 } })
        const ignored = await progressionService.grantExperience(arthas.id, 60)
        expect(ignored).toMatchObject({ levelsGained: 0, character: { level: MAX_LEVEL, experience: 0 } })
    })

    it('ne touche à aucun autre champ ni à aucun autre personnage', async () => {
        const jaina = await characterService.create(actorOf(bob), { name: 'Jaina', classId: classes.byCode('mage').id })
        const { character } = await progressionService.grantExperience(arthas.id, 150)
        expect(character).toMatchObject({ id: arthas.id, userId: alice.id, name: 'Arthas', classId: arthas.classId, currentZoneId: arthas.currentZoneId })
        expect(await characters.findById(jaina.id)).toEqual(jaina)
    })

    it.each([0, -5, 2.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])(
        'gain invalide %s : RangeError (erreur interne), aucune écriture tentée',
        async (amount) => {
            const spy = vi.spyOn(characters, 'updateProgression')
            const error = await rejectionOf(progressionService.grantExperience(arthas.id, amount))
            expect(error).toBeInstanceOf(RangeError)
            expect(error).not.toHaveProperty('status')
            expect(spy).not.toHaveBeenCalled()
            expect(await characters.findById(arthas.id)).toMatchObject({ level: 1, experience: 0 })
        }
    )

    it('personnage inexistant : 404 CHARACTER_NOT_FOUND', async () => {
        expect(await rejectionOf(progressionService.grantExperience(UNKNOWN_ID, 10))).toMatchObject({
            status: 404,
            code: 'CHARACTER_NOT_FOUND'
        })
    })

    it('progression enregistrée incohérente : RangeError, rien n’est modifié', async () => {
        // Seule une écriture hors de l'application pourrait produire cet état : il n'est jamais corrigé en silence.
        const spy = vi.spyOn(characters, 'updateProgression').mockImplementationOnce(async (_id, compute) => {
            compute({ level: MAX_LEVEL, experience: 12 })
            throw new Error('compute aurait dû échouer')
        })
        expect(await rejectionOf(progressionService.grantExperience(arthas.id, 10))).toBeInstanceOf(RangeError)
        expect(spy).toHaveBeenCalledOnce()
        expect(await characters.findById(arthas.id)).toMatchObject({ level: 1, experience: 0 })
    })
})

describe('characterService.getStats (STAT-02)', () => {
    it('niveau 1 : stats = baseStats, ressources au maximum', async () => {
        expect(await characterService.getStats(actorOf(alice), arthas.id)).toEqual({
            characterId: arthas.id,
            level: 1,
            baseStats: { hp: 120, mana: 20, attack: 12, defense: 8, speed: 8 },
            stats: { hp: 120, mana: 20, attack: 12, defense: 8, speed: 8 },
            resources: { hp: 120, mana: 20 }
        })
    })

    it('après un gain d’XP : statistiques recalculées au nouveau niveau (niveau 5 : 168 PV, 20 d’attaque)', async () => {
        await progressionService.grantExperience(arthas.id, 1703)
        expect(await characterService.getStats(actorOf(alice), arthas.id)).toEqual({
            characterId: arthas.id,
            level: 5,
            baseStats: { hp: 120, mana: 20, attack: 12, defense: 8, speed: 8 },
            stats: { hp: 168, mana: 28, attack: 20, defense: 16, speed: 12 },
            resources: { hp: 168, mana: 28 }
        })
    })

    it('niveau 10 : statistiques maximales', async () => {
        await progressionService.grantExperience(arthas.id, 11106)
        expect(await characterService.getStats(actorOf(alice), arthas.id)).toMatchObject({
            level: 10,
            stats: { hp: 228, mana: 38, attack: 30, defense: 26, speed: 17 },
            resources: { hp: 228, mana: 38 }
        })
    })

    it('autre joueur, administrateur et identifiant inconnu : même 404 CHARACTER_NOT_FOUND', async () => {
        for (const [actor, id] of [
            [actorOf(bob), arthas.id],
            [actorOf(admin), arthas.id],
            [actorOf(alice), UNKNOWN_ID]
        ] as const) {
            expect(await rejectionOf(characterService.getStats(actor, id))).toMatchObject({
                status: 404,
                code: 'CHARACTER_NOT_FOUND',
                message: 'Character not found'
            })
        }
    })

    it('classe introuvable (donnée incohérente) : erreur interne, pas une erreur client', async () => {
        vi.spyOn(classes, 'findById').mockResolvedValueOnce(undefined)
        const error = await rejectionOf(characterService.getStats(actorOf(alice), arthas.id))
        expect(error).toBeInstanceOf(Error)
        expect(error).not.toHaveProperty('status')
    })
})
