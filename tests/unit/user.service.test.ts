import { beforeEach, describe, expect, it } from 'vitest'
import { captureError } from '../helpers/errors'
import { loadFreshUserService, type UserService } from '../helpers/fresh-modules'

let userService: UserService

beforeEach(async () => {
    // Service ET repository en mémoire rechargés : chaque test part des deux utilisateurs initiaux.
    userService = await loadFreshUserService()
})

describe('userService.getAll', () => {
    it('renvoie les deux utilisateurs initiaux', () => {
        const users = userService.getAll()
        expect(users).toHaveLength(2)
        expect(users.map((user) => user.id)).toEqual([1, 2])
    })
})

describe('userService.getById', () => {
    it("renvoie l'utilisateur demandé", () => {
        expect(userService.getById(2)).toMatchObject({ id: 2, name: 'Bob' })
    })

    it('lève USER_NOT_FOUND (404) pour un identifiant inconnu', () => {
        expect(captureError(() => userService.getById(99))).toMatchObject({ status: 404, code: 'USER_NOT_FOUND' })
    })
})

describe('userService.create', () => {
    it('crée un utilisateur avec un nouvel identifiant', () => {
        const created = userService.create({ name: 'Al', email: 'al@example.com' })

        expect(created).toEqual({ id: 3, name: 'Al', email: 'al@example.com' })
        expect(userService.getAll()).toHaveLength(3)
    })

    it('refuse un email déjà utilisé (409 EMAIL_ALREADY_USED) sans rien créer', () => {
        const existingEmail = userService.getById(1).email

        expect(captureError(() => userService.create({ name: 'Copie', email: existingEmail }))).toMatchObject({
            status: 409,
            code: 'EMAIL_ALREADY_USED'
        })
        expect(userService.getAll()).toHaveLength(2)
    })
})

describe('userService.replace', () => {
    it("remplace le nom et l'email", () => {
        expect(userService.replace(2, { name: 'Robert', email: 'robert@example.com' })).toEqual({
            id: 2,
            name: 'Robert',
            email: 'robert@example.com'
        })
        expect(userService.getById(2)).toMatchObject({ name: 'Robert', email: 'robert@example.com' })
    })

    it('accepte de conserver son propre email', () => {
        const ownEmail = userService.getById(2).email
        expect(userService.replace(2, { name: 'Robert', email: ownEmail })).toEqual({
            id: 2,
            name: 'Robert',
            email: ownEmail
        })
    })

    it("refuse l'email d'un autre utilisateur, sans modifier l'utilisateur", () => {
        const before = { ...userService.getById(2) }
        const otherEmail = userService.getById(1).email

        expect(captureError(() => userService.replace(2, { name: 'Robert', email: otherEmail }))).toMatchObject({
            status: 409,
            code: 'EMAIL_ALREADY_USED'
        })
        expect(userService.getById(2)).toEqual(before)
    })

    it('lève USER_NOT_FOUND pour un identifiant inconnu', () => {
        expect(captureError(() => userService.replace(99, { name: 'X', email: 'x@example.com' }))).toMatchObject({
            status: 404,
            code: 'USER_NOT_FOUND'
        })
    })
})

describe('userService.patch', () => {
    it('modifie uniquement le nom (non-régression du bug corrigé en FND-04)', () => {
        const emailBefore = userService.getById(2).email
        expect(userService.patch(2, { name: 'Bobby' })).toEqual({ id: 2, name: 'Bobby', email: emailBefore })
    })

    it("modifie uniquement l'email", () => {
        const nameBefore = userService.getById(2).name
        expect(userService.patch(2, { email: 'bobby@example.com' })).toEqual({
            id: 2,
            name: nameBefore,
            email: 'bobby@example.com'
        })
    })

    it('ne change rien avec un objet vide', () => {
        const before = { ...userService.getById(2) }
        expect(userService.patch(2, {})).toEqual(before)
    })

    it("refuse l'email d'un autre utilisateur, sans modifier l'utilisateur", () => {
        const before = { ...userService.getById(2) }
        const otherEmail = userService.getById(1).email

        expect(captureError(() => userService.patch(2, { name: 'Bobby', email: otherEmail }))).toMatchObject({
            status: 409,
            code: 'EMAIL_ALREADY_USED'
        })
        expect(userService.getById(2)).toEqual(before)
    })

    it('lève USER_NOT_FOUND pour un identifiant inconnu', () => {
        expect(captureError(() => userService.patch(99, { name: 'X' }))).toMatchObject({
            status: 404,
            code: 'USER_NOT_FOUND'
        })
    })
})

describe('userService.remove', () => {
    it("supprime l'utilisateur", () => {
        userService.remove(2)

        expect(captureError(() => userService.getById(2))).toMatchObject({ status: 404, code: 'USER_NOT_FOUND' })
        expect(userService.getAll()).toHaveLength(1)
    })

    it('lève USER_NOT_FOUND pour un identifiant inconnu', () => {
        expect(captureError(() => userService.remove(99))).toMatchObject({ status: 404, code: 'USER_NOT_FOUND' })
    })
})

describe('isolation des données entre les tests', () => {
    it("modifie l'état : supprime l'utilisateur 1", () => {
        userService.remove(1)
        expect(userService.getAll()).toHaveLength(1)
    })

    it("retrouve l'utilisateur 1 : chaque test repart des données initiales", () => {
        expect(userService.getById(1)).toMatchObject({ id: 1 })
        expect(userService.getAll()).toHaveLength(2)
    })
})