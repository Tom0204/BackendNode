import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAuthService, type AuthService } from '../../src/services/auth.service'
import type { PasswordHasher } from '../../src/services/password-hasher'
import { hashSessionToken } from '../../src/services/session-token'
import { rejectionOf } from '../helpers/errors'
import { createFakePasswordHasher } from '../helpers/fake-password-hasher'
import { createInMemorySessionRepository, type InMemorySessionRepository } from '../helpers/in-memory-session-repository'
import { createInMemoryUserRepository, type InMemoryUserRepository } from '../helpers/in-memory-user-repository'
import { createTestClock, type TestClock } from '../helpers/test-clock'

/* Service d'authentification (AUTH-04 à AUTH-07, AUTH-10) : repositories contrôlés, hachage rapide, horloge contrôlée. */

const PASSWORD = 'correct horse battery staple'
const TTL_MS = 24 * 60 * 60 * 1000

let users: InMemoryUserRepository
let sessions: InMemorySessionRepository
let hasher: PasswordHasher
let clock: TestClock
let authService: AuthService

beforeEach(() => {
    users = createInMemoryUserRepository()
    sessions = createInMemorySessionRepository(users)
    hasher = createFakePasswordHasher()
    clock = createTestClock()
    authService = createAuthService({ userRepository: users, sessionRepository: sessions, passwordHasher: hasher, sessionTtlMs: TTL_MS, now: clock.now })
})

const registerAlice = () => authService.register({ name: 'Alice', email: 'alice@example.com', password: PASSWORD })

describe('authService.register (AUTH-04)', () => {
    it('crée un compte PLAYER, ACTIVE, avec un email en minuscules', async () => {
        const user = await authService.register({ name: 'Alice', email: 'Alice.Martin@Example.COM', password: PASSWORD })

        expect(user).toMatchObject({ name: 'Alice', email: 'alice.martin@example.com', role: 'PLAYER', status: 'ACTIVE' })
        expect(await users.findById(user.id)).toEqual(user)
    })

    it('enregistre un hash vérifiable, jamais le mot de passe en clair, et ne le renvoie pas', async () => {
        const user = await registerAlice()
        const stored = users.storedPasswordHash(user.id) ?? ''

        expect(stored).not.toContain(PASSWORD)
        expect(await hasher.verify(stored, PASSWORD)).toBe(true)
        expect(JSON.stringify(user)).not.toContain(stored)
    })

    it("n'ouvre aucune session", async () => {
        const user = await registerAlice()
        expect(sessions.sessionsOf(user.id)).toEqual([])
    })

    it.each(['alice@example.com', 'ALICE@Example.com'])('email déjà utilisé (%s) : 409 EMAIL_ALREADY_USED', async (email) => {
        await registerAlice()
        expect(await rejectionOf(authService.register({ name: 'Copie', email, password: PASSWORD }))).toMatchObject({
            status: 409,
            code: 'EMAIL_ALREADY_USED'
        })
        expect(await users.findAll()).toHaveLength(1)
    })

    it("hash calculé même quand l'email est déjà pris (durée de réponse comparable)", async () => {
        await registerAlice()
        const hashSpy = vi.spyOn(hasher, 'hash')
        await rejectionOf(registerAlice())
        expect(hashSpy).toHaveBeenCalledWith(PASSWORD)
    })

    it('une erreur inattendue du repository est propagée telle quelle (500 au niveau HTTP)', async () => {
        const failure = new Error('base indisponible')
        const service = createAuthService({
            userRepository: { ...users, create: () => Promise.reject(failure) },
            sessionRepository: sessions,
            passwordHasher: hasher,
            sessionTtlMs: TTL_MS
        })
        expect(await rejectionOf(service.register({ name: 'Alice', email: 'alice@example.com', password: PASSWORD }))).toBe(failure)
    })
})

describe('authService.login (AUTH-06)', () => {
    it('renvoie un jeton, sa date d’expiration (maintenant + 24 h) et le compte ; ouvre une session', async () => {
        const alice = await registerAlice()

        const result = await authService.login({ email: 'ALICE@example.com', password: PASSWORD })

        expect(result.user).toEqual(alice)
        expect(result.expiresAt).toEqual(new Date(clock.now().getTime() + TTL_MS))
        const [session] = sessions.sessionsOf(alice.id)
        expect(session).toMatchObject({ userId: alice.id, expiresAt: result.expiresAt, revokedAt: null })
        // Seule l'empreinte est enregistrée.
        expect(session?.tokenHash).toBe(hashSessionToken(result.token))
        expect(session?.tokenHash).not.toBe(result.token)
    })

    it('chaque connexion ouvre une session distincte avec un jeton distinct', async () => {
        const alice = await registerAlice()
        const first = await authService.login({ email: 'alice@example.com', password: PASSWORD })
        const second = await authService.login({ email: 'alice@example.com', password: PASSWORD })
        expect(first.token).not.toBe(second.token)
        expect(sessions.sessionsOf(alice.id)).toHaveLength(2)
    })

    it('mauvais mot de passe : 401 INVALID_CREDENTIALS, aucune session', async () => {
        const alice = await registerAlice()
        expect(await rejectionOf(authService.login({ email: 'alice@example.com', password: 'wrong horse battery' }))).toMatchObject({
            status: 401,
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password'
        })
        expect(sessions.sessionsOf(alice.id)).toEqual([])
    })

    it('email inconnu : même erreur, après une vérification sur un hash fictif (durée comparable)', async () => {
        await registerAlice()
        const verifySpy = vi.spyOn(hasher, 'verify')

        const unknown = await rejectionOf(authService.login({ email: 'bob@example.com', password: PASSWORD }))
        const wrong = await rejectionOf(authService.login({ email: 'alice@example.com', password: 'wrong horse battery' }))

        expect(unknown).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' })
        expect(wrong).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' })
        expect(verifySpy).toHaveBeenCalledTimes(2)
    })

    it('compte désactivé, bon mot de passe : 403 ACCOUNT_DISABLED, aucune session', async () => {
        const alice = await registerAlice()
        await users.setStatus(alice.id, 'DISABLED')
        expect(await rejectionOf(authService.login({ email: 'alice@example.com', password: PASSWORD }))).toMatchObject({
            status: 403,
            code: 'ACCOUNT_DISABLED'
        })
        expect(sessions.sessionsOf(alice.id)).toEqual([])
    })

    it('compte désactivé, mauvais mot de passe : 401 générique (rien n’est révélé)', async () => {
        const alice = await registerAlice()
        await users.setStatus(alice.id, 'DISABLED')
        expect(await rejectionOf(authService.login({ email: 'alice@example.com', password: 'wrong horse battery' }))).toMatchObject({
            status: 401,
            code: 'INVALID_CREDENTIALS'
        })
    })
})

describe('authService.authenticate (AUTH-07)', () => {
    it('jeton valide : identifiant, rôle et session de l’utilisateur', async () => {
        const alice = await registerAlice()
        const { token } = await authService.login({ email: 'alice@example.com', password: PASSWORD })
        const [session] = sessions.sessionsOf(alice.id)

        expect(await authService.authenticate(token)).toEqual({ userId: alice.id, role: 'PLAYER', sessionId: session?.id })
    })

    it('le rôle est relu à chaque requête : une promotion prend effet immédiatement', async () => {
        const alice = await registerAlice()
        const { token } = await authService.login({ email: 'alice@example.com', password: PASSWORD })
        await users.setRole(alice.id, 'ADMIN')
        expect(await authService.authenticate(token)).toMatchObject({ role: 'ADMIN' })
    })

    it('expiration : valide 1 ms avant les 24 h, refusée à 24 h exactement', async () => {
        await registerAlice()
        const { token } = await authService.login({ email: 'alice@example.com', password: PASSWORD })

        clock.advance(TTL_MS - 1)
        await expect(authService.authenticate(token)).resolves.toBeDefined()
        clock.advance(1)
        expect(await rejectionOf(authService.authenticate(token))).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
    })

    it.each([
        { label: 'mal formé', token: 'pas-un-jeton' },
        { label: 'inconnu (bon format)', token: 'a'.repeat(43) }
    ])('jeton $label : 401 UNAUTHENTICATED', async ({ token }) => {
        expect(await rejectionOf(authService.authenticate(token))).toMatchObject({
            status: 401,
            code: 'UNAUTHENTICATED',
            message: 'Authentication required'
        })
    })

    it('jeton mal formé : refusé sans lecture en base', async () => {
        const findSpy = vi.spyOn(sessions, 'findByTokenHash')
        await rejectionOf(authService.authenticate('pas-un-jeton'))
        expect(findSpy).not.toHaveBeenCalled()
    })

    it('compte désactivé après la connexion : ses sessions sont refusées immédiatement', async () => {
        const alice = await registerAlice()
        const { token } = await authService.login({ email: 'alice@example.com', password: PASSWORD })
        await users.setStatus(alice.id, 'DISABLED')
        expect(await rejectionOf(authService.authenticate(token))).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
    })

    it('compte supprimé : ses sessions sont refusées', async () => {
        const alice = await registerAlice()
        const { token } = await authService.login({ email: 'alice@example.com', password: PASSWORD })
        await users.delete(alice.id)
        expect(await rejectionOf(authService.authenticate(token))).toMatchObject({ status: 401 })
    })
})

describe('authService.logout (AUTH-10)', () => {
    it('révoque la session utilisée : son jeton est ensuite refusé', async () => {
        await registerAlice()
        const { token } = await authService.login({ email: 'alice@example.com', password: PASSWORD })
        const auth = await authService.authenticate(token)

        await authService.logout(auth)

        expect(await rejectionOf(authService.authenticate(token))).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
    })

    it('ne révoque que la session utilisée : les autres sessions du même compte restent valides', async () => {
        const alice = await registerAlice()
        const first = await authService.login({ email: 'alice@example.com', password: PASSWORD })
        const second = await authService.login({ email: 'alice@example.com', password: PASSWORD })

        await authService.logout(await authService.authenticate(first.token))

        await expect(authService.authenticate(second.token)).resolves.toMatchObject({ userId: alice.id })
        expect(sessions.sessionsOf(alice.id).map((session) => session.revokedAt !== null).sort()).toEqual([false, true])
    })

    it('enregistre la date de déconnexion de l’horloge du serveur', async () => {
        const alice = await registerAlice()
        const { token } = await authService.login({ email: 'alice@example.com', password: PASSWORD })
        clock.advance(60_000)
        await authService.logout(await authService.authenticate(token))
        expect(sessions.sessionsOf(alice.id)[0]?.revokedAt).toEqual(clock.now())
    })
})
