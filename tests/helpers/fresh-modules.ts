import type { Express } from 'express'
import { vi } from 'vitest'
import type { AuthService } from '../../src/services/auth.service'
import type { PasswordHasher } from '../../src/services/password-hasher'
import type { UserService } from '../../src/services/user.service'
import type { User, UserRole, UserStatus } from '../../src/types/user'
import type { InMemorySessionRepository } from './in-memory-session-repository'
import type { InMemoryUserRepository } from './in-memory-user-repository'
import type { TestClock } from './test-clock'

export type { AuthService, UserService }

/** Durée de session des tests : 24 heures, comme la valeur par défaut (SESSION_TTL_HOURS). */
export const TEST_SESSION_TTL_MS = 24 * 60 * 60 * 1000

/** Mot de passe valide (15 caractères au moins) des comptes créés par les tests. */
export const TEST_PASSWORD = 'correct horse battery staple'

/** Application de test et ses dépendances, toutes neuves. */
export interface FreshApp {
    app: Express
    /** Services utilisés par les routes de CETTE application : ils peuvent être espionnés (vi.spyOn). */
    authService: AuthService
    userService: UserService
    /** Repositories contrôlés (en mémoire) de cette application. */
    userRepository: InMemoryUserRepository
    sessionRepository: InMemorySessionRepository
    /** Hachage rapide des tests (voir fake-password-hasher.ts). */
    passwordHasher: PasswordHasher
    /** Horloge de l'authentification : clock.advance() fait expirer les sessions sans attendre. */
    clock: TestClock
}

/** Compte créé par un test, avec un jeton de session valide. */
export interface TestAccount {
    user: User
    token: string
}

/**
 * Charge une application Express neuve, branchée sur des repositories en mémoire (DB-04),
 * un hachage rapide (AUTH-03) et une horloge contrôlée (AUTH-05). Aucune base de données n'est utilisée.
 *
 * vi.resetModules() vide le cache des modules : les import() qui suivent réexécutent src/app.ts
 * et les middlewares avec état (compteurs du rate limiting). À appeler dans un beforeEach.
 */
export async function loadFreshApp(): Promise<FreshApp> {
    vi.resetModules()
    const { createApp } = await import('../../src/app')
    const { createAuthService } = await import('../../src/services/auth.service')
    const { createUserService } = await import('../../src/services/user.service')
    const { createInMemoryUserRepository } = await import('./in-memory-user-repository')
    const { createInMemorySessionRepository } = await import('./in-memory-session-repository')
    const { createFakePasswordHasher } = await import('./fake-password-hasher')
    const { createTestClock } = await import('./test-clock')

    const userRepository = createInMemoryUserRepository()
    const sessionRepository = createInMemorySessionRepository(userRepository)
    const passwordHasher = createFakePasswordHasher()
    const clock = createTestClock()
    const authService = createAuthService({
        userRepository,
        sessionRepository,
        passwordHasher,
        sessionTtlMs: TEST_SESSION_TTL_MS,
        now: clock.now
    })
    const userService = createUserService(userRepository)
    return {
        app: createApp({ authService, userService }),
        authService,
        userService,
        userRepository,
        sessionRepository,
        passwordHasher,
        clock
    }
}

/**
 * Crée un compte par les services (sans passer par HTTP, donc sans consommer la limite de connexion),
 * lui donne le rôle et le statut voulus, puis ouvre une session.
 */
export async function createTestAccount(
    fresh: FreshApp,
    { name, email, role = 'PLAYER', status = 'ACTIVE' }: { name: string; email: string; role?: UserRole; status?: UserStatus }
): Promise<TestAccount> {
    const registered = await fresh.authService.register({ name, email, password: TEST_PASSWORD })
    if (role !== 'PLAYER') {
        await fresh.userRepository.setRole(registered.id, role)
    }
    const { token, user } = await fresh.authService.login({ email, password: TEST_PASSWORD })
    if (status !== 'ACTIVE') {
        await fresh.userRepository.setStatus(registered.id, status)
        return { user: { ...user, status }, token }
    }
    return { user, token }
}

/** En-tête Authorization d'un jeton. */
export const bearer = (token: string): string => `Bearer ${token}`
