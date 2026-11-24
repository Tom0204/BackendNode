import type { Express } from 'express'
import { vi } from 'vitest'
import type { Database } from '../../src/database/client'
import { requireSafeTestDatabaseUrl } from './test-database'

/* Application complète branchée sur PostgreSQL (mmorpg_test), assemblée comme dans server.ts :
 * repositories Prisma, hachage Argon2id réel, services, application. Réservée à tests/database/.
 */

/** Durée de session des tests base de données : 24 heures, comme la valeur par défaut. */
export const DATABASE_TEST_SESSION_TTL_MS = 24 * 60 * 60 * 1000

export interface AppInstance {
    app: Express
    database: Database
}

/**
 * Démarre une instance indépendante : modules rechargés (vi.resetModules), nouveau pool, nouveau client Prisma.
 * La connexion vise uniquement mmorpg_test (requireSafeTestDatabaseUrl).
 */
export async function startAppInstance(): Promise<AppInstance> {
    vi.resetModules()
    const { createDatabase } = await import('../../src/database/client')
    const { createPrismaUserRepository } = await import('../../src/repositories/user.repository')
    const { createPrismaSessionRepository } = await import('../../src/repositories/session.repository')
    const { createPrismaCharacterClassRepository } = await import('../../src/repositories/character-class.repository')
    const { createPrismaCharacterRepository } = await import('../../src/repositories/character.repository')
    const { createAuthService } = await import('../../src/services/auth.service')
    const { createUserService } = await import('../../src/services/user.service')
    const { createCharacterClassService } = await import('../../src/services/character-class.service')
    const { createCharacterService } = await import('../../src/services/character.service')
    const { createArgon2PasswordHasher } = await import('../../src/services/password-hasher')
    const { createApp } = await import('../../src/app')

    const database = createDatabase(requireSafeTestDatabaseUrl())
    const userRepository = createPrismaUserRepository(database.prisma)
    const characterClassRepository = createPrismaCharacterClassRepository(database.prisma)
    const app = createApp({
        authService: createAuthService({
            userRepository,
            sessionRepository: createPrismaSessionRepository(database.prisma),
            passwordHasher: createArgon2PasswordHasher(),
            sessionTtlMs: DATABASE_TEST_SESSION_TTL_MS
        }),
        userService: createUserService(userRepository),
        characterClassService: createCharacterClassService(characterClassRepository),
        characterService: createCharacterService({
            characterRepository: createPrismaCharacterRepository(database.prisma),
            characterClassRepository
        })
    })
    return { app, database }
}

/** Ferme la connexion de l'instance (pool et client Prisma). */
export async function stopAppInstance({ database }: AppInstance): Promise<void> {
    const { closeDatabase } = await import('../../src/database/client')
    await closeDatabase(database)
}
