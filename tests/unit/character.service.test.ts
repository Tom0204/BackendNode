import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_CHARACTERS_PER_ACCOUNT } from '../../src/config/gameplay'
import { createCharacterClassService } from '../../src/services/character-class.service'
import { createCharacterService, type CharacterService } from '../../src/services/character.service'
import type { CharacterRepository } from '../../src/repositories/character.repository'
import type { AuthContext } from '../../src/types/auth'
import type { User } from '../../src/types/user'
import { UNKNOWN_ID } from '../helpers/character-repository-contract'
import { rejectionOf } from '../helpers/errors'
import { createInMemoryCharacterClassRepository, type InMemoryCharacterClassRepository } from '../helpers/in-memory-character-class-repository'
import { createInMemoryCharacterRepository, IN_MEMORY_STARTING_ZONE_ID } from '../helpers/in-memory-character-repository'
import { createInMemoryUserRepository, type InMemoryUserRepository } from '../helpers/in-memory-user-repository'
import { newUser } from '../helpers/user-repository-contract'

/* Services des classes et des personnages (CHAR-01 à CHAR-05), avec des repositories contrôlés. */

let users: InMemoryUserRepository
let classes: InMemoryCharacterClassRepository
let characters: CharacterRepository
let service: CharacterService
let alice: User
let bob: User
let admin: User
let warriorId: string

const actorOf = (user: User): AuthContext => ({ userId: user.id, role: user.role, sessionId: 'session-de-test' })
const NAMES = ['Arthas', 'Jaina', 'Thrall', 'Sylvanas', 'Uther', 'Varian']

beforeEach(async () => {
    users = createInMemoryUserRepository()
    classes = createInMemoryCharacterClassRepository()
    characters = createInMemoryCharacterRepository({ users, classes })
    service = createCharacterService({ characterRepository: characters, characterClassRepository: classes })
    alice = await users.create(newUser('Alice', 'alice@example.com'))
    bob = await users.create(newUser('Bob', 'bob@example.com'))
    const created = await users.create(newUser('Admin', 'admin@example.com'))
    admin = (await users.setRole(created.id, 'ADMIN')) ?? created
    warriorId = classes.byCode('warrior').id
})

describe('characterService.create (CHAR-03)', () => {
    it('propriétaire = utilisateur authentifié ; niveau 1, XP 0, zone de départ fixés par le serveur', async () => {
        const character = await service.create(actorOf(alice), { name: 'Arthas', classId: warriorId })
        expect(character).toMatchObject({
            userId: alice.id,
            classId: warriorId,
            name: 'Arthas',
            level: 1,
            experience: 0,
            currentZoneId: IN_MEMORY_STARTING_ZONE_ID
        })
    })

    it('passe toujours par createWithinLimit, avec la limite de la configuration', async () => {
        const spy = vi.spyOn(characters, 'createWithinLimit')
        await service.create(actorOf(alice), { name: 'Arthas', classId: warriorId })
        expect(spy).toHaveBeenCalledWith({ userId: alice.id, classId: warriorId, name: 'Arthas' }, MAX_CHARACTERS_PER_ACCOUNT)
    })

    it('classe inexistante : 422 CLASS_NOT_FOUND, sans tentative de création', async () => {
        const spy = vi.spyOn(characters, 'createWithinLimit')
        expect(await rejectionOf(service.create(actorOf(alice), { name: 'Arthas', classId: UNKNOWN_ID }))).toMatchObject({
            status: 422,
            code: 'CLASS_NOT_FOUND',
            message: 'Class not found'
        })
        expect(spy).not.toHaveBeenCalled()
    })

    it(`${MAX_CHARACTERS_PER_ACCOUNT + 1}e personnage : 409 CHARACTER_LIMIT_REACHED`, async () => {
        for (const name of NAMES.slice(0, MAX_CHARACTERS_PER_ACCOUNT)) {
            await service.create(actorOf(alice), { name, classId: warriorId })
        }
        expect(await rejectionOf(service.create(actorOf(alice), { name: 'Varian', classId: warriorId }))).toMatchObject({
            status: 409,
            code: 'CHARACTER_LIMIT_REACHED',
            message: 'Character limit reached'
        })
        expect(await characters.countByUserId(alice.id)).toBe(MAX_CHARACTERS_PER_ACCOUNT)
    })

    it('nom pris par un autre joueur, quelle que soit la casse : 409 CHARACTER_NAME_TAKEN', async () => {
        await service.create(actorOf(bob), { name: 'Arthas', classId: warriorId })
        expect(await rejectionOf(service.create(actorOf(alice), { name: 'aRTHAS', classId: warriorId }))).toMatchObject({
            status: 409,
            code: 'CHARACTER_NAME_TAKEN',
            message: 'Character name already taken'
        })
    })

    it('ordre des contrôles : classe (422) avant limite (409), limite avant nom', async () => {
        await service.create(actorOf(bob), { name: 'Thrall', classId: warriorId })
        for (const name of ['Arthas', 'Jaina', 'Sylvanas', 'Uther', 'Varian'].slice(0, MAX_CHARACTERS_PER_ACCOUNT)) {
            await service.create(actorOf(alice), { name, classId: warriorId })
        }
        expect(await characters.countByUserId(alice.id)).toBe(MAX_CHARACTERS_PER_ACCOUNT)
        expect(await rejectionOf(service.create(actorOf(alice), { name: 'Anduin', classId: UNKNOWN_ID }))).toMatchObject({ status: 422 })
        expect(await rejectionOf(service.create(actorOf(alice), { name: 'Thrall', classId: warriorId }))).toMatchObject({
            code: 'CHARACTER_LIMIT_REACHED'
        })
    })

    it('classe disparue pendant la création : 422 ; compte disparu : 401', async () => {
        const vanishingClass = createCharacterService({
            characterRepository: characters,
            characterClassRepository: { ...classes, findById: async () => classes.byCode('warrior') }
        })
        expect(await rejectionOf(vanishingClass.create(actorOf(alice), { name: 'Arthas', classId: UNKNOWN_ID }))).toMatchObject({
            status: 422,
            code: 'CLASS_NOT_FOUND'
        })
        await users.delete(alice.id)
        expect(await rejectionOf(service.create(actorOf(alice), { name: 'Arthas', classId: warriorId }))).toMatchObject({ status: 401 })
    })

    it('une erreur inattendue du repository est propagée telle quelle (500 au niveau HTTP)', async () => {
        const failure = new Error('base indisponible')
        const failing = createCharacterService({
            characterRepository: { ...characters, createWithinLimit: () => Promise.reject(failure) },
            characterClassRepository: classes
        })
        expect(await rejectionOf(failing.create(actorOf(alice), { name: 'Arthas', classId: warriorId }))).toBe(failure)
    })
})

describe('characterService.listMine (CHAR-04)', () => {
    it('seulement les personnages de l’utilisateur authentifié ; [] s’il n’en a aucun', async () => {
        await service.create(actorOf(alice), { name: 'Arthas', classId: warriorId })
        await service.create(actorOf(bob), { name: 'Thrall', classId: warriorId })

        expect((await service.listMine(actorOf(alice))).map((character) => character.name)).toEqual(['Arthas'])
        expect(await service.listMine(actorOf(admin))).toEqual([])
    })
})

describe('characterService.getById (CHAR-05)', () => {
    it('propriétaire : son personnage', async () => {
        const character = await service.create(actorOf(alice), { name: 'Arthas', classId: warriorId })
        expect(await service.getById(actorOf(alice), character.id)).toEqual(character)
    })

    it('autre joueur, administrateur compris, et identifiant inconnu : même 404 CHARACTER_NOT_FOUND', async () => {
        const character = await service.create(actorOf(alice), { name: 'Arthas', classId: warriorId })
        const expected = { status: 404, code: 'CHARACTER_NOT_FOUND', message: 'Character not found' }

        expect(await rejectionOf(service.getById(actorOf(bob), character.id))).toMatchObject(expected)
        expect(await rejectionOf(service.getById(actorOf(admin), character.id))).toMatchObject(expected)
        expect(await rejectionOf(service.getById(actorOf(alice), UNKNOWN_ID))).toMatchObject(expected)
    })
})

describe('characterClassService (CHAR-01)', () => {
    it('getAll : les trois classes ; getById : la classe, ou 404 CLASS_NOT_FOUND', async () => {
        const classService = createCharacterClassService(classes)
        expect((await classService.getAll()).map((characterClass) => characterClass.code)).toEqual(['warrior', 'mage', 'rogue'])
        expect(await classService.getById(warriorId)).toMatchObject({ code: 'warrior' })
        expect(await rejectionOf(classService.getById(UNKNOWN_ID))).toMatchObject({ status: 404, code: 'CLASS_NOT_FOUND' })
    })
})
