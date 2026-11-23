import { beforeEach, describe, expect, it } from 'vitest'
import { createUserService, type UserService } from '../../src/services/user.service'
import type { User } from '../../src/types/user'
import { rejectionOf } from '../helpers/errors'
import { createInMemoryUserRepository } from '../helpers/in-memory-user-repository'
import { UNKNOWN_USER_ID } from '../helpers/user-repository-contract'

/* Service utilisateur (DB-04) : règles métier testées avec un repository contrôlé, sans base de données. */

let userService: UserService
let alice: User
let bob: User

beforeEach(async () => {
    // Service et repository neufs : chaque test part de deux utilisateurs.
    userService = createUserService(createInMemoryUserRepository())
    alice = await userService.create({ name: 'Alice', email: 'alice@example.com' })
    bob = await userService.create({ name: 'Bob', email: 'bob@example.com' })
})

describe('userService.getAll', () => {
    it('renvoie les utilisateurs, du plus ancien au plus récent', async () => {
        const users = await userService.getAll()
        expect(users).toHaveLength(2)
        expect(users.map((user) => user.id).sort()).toEqual([alice.id, bob.id].sort())
    })
})

describe('userService.getById', () => {
    it("renvoie l'utilisateur demandé", async () => {
        expect(await userService.getById(bob.id)).toMatchObject({ id: bob.id, name: 'Bob' })
    })

    it('lève USER_NOT_FOUND (404) pour un identifiant inconnu', async () => {
        expect(await rejectionOf(userService.getById(UNKNOWN_USER_ID))).toMatchObject({ status: 404, code: 'USER_NOT_FOUND' })
    })
})

describe('userService.create', () => {
    it('crée un utilisateur avec un nouvel identifiant', async () => {
        const created = await userService.create({ name: 'Al', email: 'al@example.com' })

        expect(created).toMatchObject({ name: 'Al', email: 'al@example.com' })
        expect([alice.id, bob.id]).not.toContain(created.id)
        expect(await userService.getAll()).toHaveLength(3)
    })

    it("enregistre l'email en minuscules", async () => {
        expect(await userService.create({ name: 'Al', email: 'Al.Martin@Example.COM' })).toMatchObject({
            email: 'al.martin@example.com'
        })
    })

    it('refuse un email déjà utilisé (409 EMAIL_ALREADY_USED) sans rien créer', async () => {
        expect(await rejectionOf(userService.create({ name: 'Copie', email: alice.email }))).toMatchObject({
            status: 409,
            code: 'EMAIL_ALREADY_USED'
        })
        expect(await userService.getAll()).toHaveLength(2)
    })

    it('refuse un email déjà utilisé avec une autre casse (409)', async () => {
        expect(await rejectionOf(userService.create({ name: 'Copie', email: 'ALICE@Example.com' }))).toMatchObject({
            status: 409,
            code: 'EMAIL_ALREADY_USED'
        })
    })
})

describe('userService.replace', () => {
    it("remplace le nom et l'email", async () => {
        expect(await userService.replace(bob.id, { name: 'Robert', email: 'robert@example.com' })).toMatchObject({
            id: bob.id,
            name: 'Robert',
            email: 'robert@example.com'
        })
        expect(await userService.getById(bob.id)).toMatchObject({ name: 'Robert', email: 'robert@example.com' })
    })

    it('accepte de conserver son propre email', async () => {
        expect(await userService.replace(bob.id, { name: 'Robert', email: bob.email })).toMatchObject({
            id: bob.id,
            name: 'Robert',
            email: bob.email
        })
    })

    it("refuse l'email d'un autre utilisateur, sans modifier l'utilisateur", async () => {
        const before = await userService.getById(bob.id)

        expect(await rejectionOf(userService.replace(bob.id, { name: 'Robert', email: alice.email }))).toMatchObject({
            status: 409,
            code: 'EMAIL_ALREADY_USED'
        })
        expect(await userService.getById(bob.id)).toEqual(before)
    })

    it('lève USER_NOT_FOUND pour un identifiant inconnu', async () => {
        expect(await rejectionOf(userService.replace(UNKNOWN_USER_ID, { name: 'X', email: 'x@example.com' }))).toMatchObject({
            status: 404,
            code: 'USER_NOT_FOUND'
        })
    })
})

describe('userService.patch', () => {
    it('modifie uniquement le nom (non-régression du bug corrigé en FND-04)', async () => {
        expect(await userService.patch(bob.id, { name: 'Bobby' })).toMatchObject({ id: bob.id, name: 'Bobby', email: bob.email })
    })

    it("modifie uniquement l'email, enregistré en minuscules", async () => {
        expect(await userService.patch(bob.id, { email: 'Bobby@Example.com' })).toMatchObject({
            id: bob.id,
            name: 'Bob',
            email: 'bobby@example.com'
        })
    })

    it('ne change rien avec un objet vide', async () => {
        const before = await userService.getById(bob.id)
        expect(await userService.patch(bob.id, {})).toMatchObject({ id: before.id, name: before.name, email: before.email })
    })

    it("refuse l'email d'un autre utilisateur, sans modifier l'utilisateur", async () => {
        const before = await userService.getById(bob.id)

        expect(await rejectionOf(userService.patch(bob.id, { name: 'Bobby', email: alice.email }))).toMatchObject({
            status: 409,
            code: 'EMAIL_ALREADY_USED'
        })
        expect(await userService.getById(bob.id)).toEqual(before)
    })

    it('lève USER_NOT_FOUND pour un identifiant inconnu', async () => {
        expect(await rejectionOf(userService.patch(UNKNOWN_USER_ID, { name: 'X' }))).toMatchObject({
            status: 404,
            code: 'USER_NOT_FOUND'
        })
    })
})

describe('userService.remove', () => {
    it("supprime l'utilisateur", async () => {
        await userService.remove(bob.id)

        expect(await rejectionOf(userService.getById(bob.id))).toMatchObject({ status: 404, code: 'USER_NOT_FOUND' })
        expect(await userService.getAll()).toHaveLength(1)
    })

    it('lève USER_NOT_FOUND pour un identifiant inconnu', async () => {
        expect(await rejectionOf(userService.remove(UNKNOWN_USER_ID))).toMatchObject({ status: 404, code: 'USER_NOT_FOUND' })
    })
})

describe('isolation des données entre les tests', () => {
    it("modifie l'état : supprime Alice", async () => {
        await userService.remove(alice.id)
        expect(await userService.getAll()).toHaveLength(1)
    })

    it('retrouve deux utilisateurs : chaque test repart de données neuves', async () => {
        expect(await userService.getAll()).toHaveLength(2)
    })
})

describe('erreurs du repository', () => {
    it('une erreur inattendue du repository est propagée telle quelle (500 au niveau HTTP)', async () => {
        const failure = new Error('base indisponible')
        const service = createUserService({
            ...createInMemoryUserRepository(),
            create: () => Promise.reject(failure)
        })
        expect(await rejectionOf(service.create({ name: 'X', email: 'x@example.com' }))).toBe(failure)
    })
})
