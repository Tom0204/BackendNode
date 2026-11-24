import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAuthService, type AuthService } from '../../src/services/auth.service'
import type { PasswordHasher } from '../../src/services/password-hasher'
import { rejectionOf } from '../helpers/errors'
import { createFakePasswordHasher } from '../helpers/fake-password-hasher'
import { createInMemoryUserRepository, type InMemoryUserRepository } from '../helpers/in-memory-user-repository'

/* Inscription (AUTH-04) : règles métier testées avec un repository contrôlé et un hachage rapide. */

const PASSWORD = 'correct horse battery staple'

let repository: InMemoryUserRepository
let hasher: PasswordHasher
let authService: AuthService

beforeEach(() => {
    repository = createInMemoryUserRepository()
    hasher = createFakePasswordHasher()
    authService = createAuthService({ userRepository: repository, passwordHasher: hasher })
})

describe('authService.register', () => {
    it('crée un compte PLAYER avec un email en minuscules', async () => {
        const user = await authService.register({ name: 'Alice', email: 'Alice.Martin@Example.COM', password: PASSWORD })

        expect(user).toMatchObject({ name: 'Alice', email: 'alice.martin@example.com', role: 'PLAYER' })
        expect(await repository.findById(user.id)).toEqual(user)
    })

    it('enregistre un hash vérifiable, jamais le mot de passe en clair', async () => {
        const user = await authService.register({ name: 'Alice', email: 'alice@example.com', password: PASSWORD })
        const stored = repository.storedPasswordHash(user.id) ?? ''

        expect(stored).not.toBe('')
        expect(stored).not.toContain(PASSWORD)
        expect(await hasher.verify(stored, PASSWORD)).toBe(true)
        expect(await hasher.verify(stored, 'another password here')).toBe(false)
    })

    it('ne renvoie ni le mot de passe ni son hash', async () => {
        const user = await authService.register({ name: 'Alice', email: 'alice@example.com', password: PASSWORD })

        expect(Object.keys(user).sort()).toEqual(['createdAt', 'email', 'id', 'name', 'role', 'updatedAt'])
        expect(JSON.stringify(user)).not.toContain(PASSWORD)
    })

    it('deux comptes avec le même mot de passe ont des hashs différents', async () => {
        const alice = await authService.register({ name: 'Alice', email: 'alice@example.com', password: PASSWORD })
        const bob = await authService.register({ name: 'Bob', email: 'bob@example.com', password: PASSWORD })

        expect(repository.storedPasswordHash(alice.id)).not.toBe(repository.storedPasswordHash(bob.id))
    })

    it.each(['alice@example.com', 'ALICE@Example.com'])(
        'refuse un email déjà utilisé (%s) : 409 EMAIL_ALREADY_USED, aucun compte créé',
        async (email) => {
            await authService.register({ name: 'Alice', email: 'alice@example.com', password: PASSWORD })

            expect(await rejectionOf(authService.register({ name: 'Copie', email, password: PASSWORD }))).toMatchObject({
                status: 409,
                code: 'EMAIL_ALREADY_USED'
            })
            expect(await repository.findAll()).toHaveLength(1)
        }
    )

    it("hash calculé avant l'écriture, y compris quand l'email est déjà pris (durée de réponse comparable)", async () => {
        await authService.register({ name: 'Alice', email: 'alice@example.com', password: PASSWORD })
        const hashSpy = vi.spyOn(hasher, 'hash')

        await rejectionOf(authService.register({ name: 'Copie', email: 'alice@example.com', password: PASSWORD }))

        expect(hashSpy).toHaveBeenCalledWith(PASSWORD)
    })

    it('échec du hachage : erreur propagée, aucun compte créé', async () => {
        const failure = new Error('hachage impossible')
        const service = createAuthService({
            userRepository: repository,
            passwordHasher: { ...hasher, hash: () => Promise.reject(failure) }
        })

        expect(await rejectionOf(service.register({ name: 'Alice', email: 'alice@example.com', password: PASSWORD }))).toBe(failure)
        expect(await repository.findAll()).toEqual([])
    })

    it('une erreur inattendue du repository est propagée telle quelle (500 au niveau HTTP)', async () => {
        const failure = new Error('base indisponible')
        const service = createAuthService({
            userRepository: { ...repository, create: () => Promise.reject(failure) },
            passwordHasher: hasher
        })

        expect(await rejectionOf(service.register({ name: 'Alice', email: 'alice@example.com', password: PASSWORD }))).toBe(failure)
    })
})
