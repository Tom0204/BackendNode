import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createUserService, type UserService } from '../../src/services/user.service'
import type { AuthContext } from '../../src/types/auth'
import type { User } from '../../src/types/user'
import { rejectionOf } from '../helpers/errors'
import { createInMemoryUserRepository, type InMemoryUserRepository } from '../helpers/in-memory-user-repository'
import { newUser, UNKNOWN_USER_ID } from '../helpers/user-repository-contract'

/* Service utilisateur (AUTH-02, AUTH-08, AUTH-09) : règles métier et permissions, avec un repository contrôlé.
 * Joueur : son propre compte uniquement ; un autre compte est traité comme inexistant (404).
 * Administrateur : tous les comptes, et la liste.
 */

let repository: InMemoryUserRepository
let userService: UserService
let alice: User
let bob: User
let admin: User

const actorOf = (user: User): AuthContext => ({ userId: user.id, role: user.role, sessionId: 'session-de-test' })

beforeEach(async () => {
    repository = createInMemoryUserRepository()
    userService = createUserService(repository)
    alice = await repository.create(newUser('Alice', 'alice@example.com'))
    bob = await repository.create(newUser('Bob', 'bob@example.com'))
    const created = await repository.create(newUser('Admin', 'admin@example.com'))
    admin = (await repository.setRole(created.id, 'ADMIN')) ?? created
})

const notFoundError = { status: 404, code: 'USER_NOT_FOUND', message: 'User not found' }

describe('userService.getPage (liste, administrateurs seulement)', () => {
    it('administrateur : page demandée et métadonnées de pagination', async () => {
        const result = await userService.getPage(actorOf(admin), { page: 1, pageSize: 2 })
        // Ordre du repository (date de création, puis identifiant) : des comptes créés dans la même milliseconde
        // sont départagés par leur identifiant, qui n'est pas prévisible.
        expect(result.users).toEqual((await repository.findAll()).slice(0, 2))
        expect(result.pagination).toEqual({ page: 1, pageSize: 2, totalItems: 3, totalPages: 2 })
    })

    it('administrateur : page au-delà de la fin → liste vide', async () => {
        expect(await userService.getPage(actorOf(admin), { page: 5, pageSize: 20 })).toEqual({
            users: [],
            pagination: { page: 5, pageSize: 20, totalItems: 3, totalPages: 1 }
        })
    })

    it('joueur : 403 FORBIDDEN, sans lecture', async () => {
        const findPageSpy = vi.spyOn(repository, 'findPage')
        expect(await rejectionOf(userService.getPage(actorOf(alice), { page: 1, pageSize: 20 }))).toMatchObject({
            status: 403,
            code: 'FORBIDDEN'
        })
        expect(findPageSpy).not.toHaveBeenCalled()
    })
})

describe('userService.getById', () => {
    it('propriétaire : son compte', async () => {
        expect(await userService.getById(actorOf(alice), alice.id)).toEqual(alice)
    })

    it('autre joueur : 404 USER_NOT_FOUND, comme un compte inexistant, sans lecture', async () => {
        const findSpy = vi.spyOn(repository, 'findById')
        expect(await rejectionOf(userService.getById(actorOf(alice), bob.id))).toMatchObject(notFoundError)
        expect(await rejectionOf(userService.getById(actorOf(alice), UNKNOWN_USER_ID))).toMatchObject(notFoundError)
        expect(findSpy).not.toHaveBeenCalled()
    })

    it('administrateur : tout compte ; 404 pour un compte inexistant', async () => {
        expect(await userService.getById(actorOf(admin), bob.id)).toEqual(bob)
        expect(await rejectionOf(userService.getById(actorOf(admin), UNKNOWN_USER_ID))).toMatchObject(notFoundError)
    })
})

describe('userService.patch', () => {
    it('propriétaire : modifie son nom et son email (enregistré en minuscules)', async () => {
        expect(await userService.patch(actorOf(alice), alice.id, { name: 'Alicia', email: 'Alicia@Example.com' })).toMatchObject({
            id: alice.id,
            name: 'Alicia',
            email: 'alicia@example.com',
            role: 'PLAYER'
        })
    })

    it('propriétaire : un seul champ, ou aucun', async () => {
        expect(await userService.patch(actorOf(alice), alice.id, { name: 'Alicia' })).toMatchObject({ email: alice.email })
        expect(await userService.patch(actorOf(alice), alice.id, {})).toMatchObject({ name: 'Alicia', email: alice.email })
    })

    it('autre joueur : 404, aucune modification', async () => {
        const updateSpy = vi.spyOn(repository, 'update')
        expect(await rejectionOf(userService.patch(actorOf(alice), bob.id, { name: 'Pirate' }))).toMatchObject(notFoundError)
        expect(updateSpy).not.toHaveBeenCalled()
        expect(await repository.findById(bob.id)).toEqual(bob)
    })

    it('administrateur : modifie un autre compte', async () => {
        expect(await userService.patch(actorOf(admin), bob.id, { name: 'Robert' })).toMatchObject({ id: bob.id, name: 'Robert' })
    })

    it("email d'un autre compte (quelle que soit la casse) : 409, aucune modification", async () => {
        expect(await rejectionOf(userService.patch(actorOf(alice), alice.id, { name: 'X', email: 'BOB@example.com' }))).toMatchObject({
            status: 409,
            code: 'EMAIL_ALREADY_USED'
        })
        expect(await repository.findById(alice.id)).toEqual(alice)
    })

    it('compte inexistant (administrateur) : 404', async () => {
        expect(await rejectionOf(userService.patch(actorOf(admin), UNKNOWN_USER_ID, { name: 'X' }))).toMatchObject(notFoundError)
    })

    it('une erreur inattendue du repository est propagée telle quelle (500 au niveau HTTP)', async () => {
        const failure = new Error('base indisponible')
        const service = createUserService({ ...repository, update: () => Promise.reject(failure) })
        expect(await rejectionOf(service.patch(actorOf(alice), alice.id, { name: 'X' }))).toBe(failure)
    })
})

describe('userService.getMe et patchMe (AUTH-09)', () => {
    it('le compte est celui de l’utilisateur authentifié', async () => {
        expect(await userService.getMe(actorOf(bob))).toEqual(bob)
        expect(await userService.patchMe(actorOf(bob), { name: 'Bobby' })).toMatchObject({ id: bob.id, name: 'Bobby' })
        expect(await repository.findById(alice.id)).toEqual(alice)
    })
})

describe('userService.remove', () => {
    it('propriétaire : supprime son propre compte', async () => {
        await userService.remove(actorOf(alice), alice.id)
        expect(await repository.findById(alice.id)).toBeUndefined()
    })

    it("autre joueur : 404, aucune suppression (refus avant tout accès à la base)", async () => {
        const deleteSpy = vi.spyOn(repository, 'delete')
        expect(await rejectionOf(userService.remove(actorOf(alice), bob.id))).toMatchObject(notFoundError)
        expect(deleteSpy).not.toHaveBeenCalled()
        expect(await repository.findById(bob.id)).toEqual(bob)
    })

    it('administrateur : supprime un autre compte ; 404 pour un compte inexistant', async () => {
        await userService.remove(actorOf(admin), bob.id)
        expect(await repository.findById(bob.id)).toBeUndefined()
        expect(await rejectionOf(userService.remove(actorOf(admin), bob.id))).toMatchObject(notFoundError)
    })
})
