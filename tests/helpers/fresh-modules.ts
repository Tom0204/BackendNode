import type { Express } from 'express'
import { vi } from 'vitest'
import type { AuthService } from '../../src/services/auth.service'
import type { PasswordHasher } from '../../src/services/password-hasher'
import type { InMemoryUserRepository } from './in-memory-user-repository'

export type { AuthService }

/** Application de test et ses dépendances, toutes neuves. */
export interface FreshApp {
    app: Express
    /** Service utilisé par les routes de CETTE application : il peut être espionné (vi.spyOn). */
    authService: AuthService
    /** Repository contrôlé (en mémoire) de cette application. */
    userRepository: InMemoryUserRepository
    /** Hachage rapide des tests (voir fake-password-hasher.ts). */
    passwordHasher: PasswordHasher
}

/**
 * Charge une application Express neuve, branchée sur un repository utilisateur en mémoire (DB-04)
 * et sur un hachage rapide (AUTH-03). Aucune base de données n'est utilisée.
 *
 * vi.resetModules() vide le cache des modules : les import() qui suivent réexécutent src/app.ts
 * et les middlewares avec état (compteurs du rate limiting). À appeler dans un beforeEach.
 */
export async function loadFreshApp(): Promise<FreshApp> {
    vi.resetModules()
    const { createApp } = await import('../../src/app')
    const { createAuthService } = await import('../../src/services/auth.service')
    const { createInMemoryUserRepository } = await import('./in-memory-user-repository')
    const { createFakePasswordHasher } = await import('./fake-password-hasher')

    const userRepository = createInMemoryUserRepository()
    const passwordHasher = createFakePasswordHasher()
    const authService = createAuthService({ userRepository, passwordHasher })
    return { app: createApp({ authService }), authService, userRepository, passwordHasher }
}
