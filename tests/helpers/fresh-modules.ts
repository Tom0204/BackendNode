import type { Express } from 'express'
import { vi } from 'vitest'
import type { UserRepository } from '../../src/repositories/user.repository'
import type { UserService } from '../../src/services/user.service'
import type { User, UserData } from '../../src/types/user'

export type { UserService }

/** Application de test et ses dépendances, toutes neuves. */
export interface FreshApp {
    app: Express
    /** Service utilisé par les routes de CETTE application : il peut être espionné (vi.spyOn). */
    userService: UserService
    /** Repository contrôlé (en mémoire) de cette application. */
    userRepository: UserRepository
    /** Utilisateurs créés au départ, dans l'ordre de `options.users`. */
    users: User[]
}

/**
 * Charge une application Express neuve, branchée sur un repository utilisateur en mémoire (DB-04).
 * Aucune base de données n'est utilisée.
 *
 * vi.resetModules() vide le cache des modules : les import() qui suivent réexécutent src/app.ts
 * et les middlewares avec état (compteurs du rate limiting). À appeler dans un beforeEach.
 */
export async function loadFreshApp(options: { users?: UserData[] } = {}): Promise<FreshApp> {
    vi.resetModules()
    const { createApp } = await import('../../src/app')
    const { createUserService } = await import('../../src/services/user.service')
    const { createInMemoryUserRepository } = await import('./in-memory-user-repository')

    const userRepository = createInMemoryUserRepository()
    const users: User[] = []
    for (const data of options.users ?? []) {
        users.push(await userRepository.create(data))
    }
    const userService = createUserService(userRepository)
    return { app: createApp({ userService }), userService, userRepository, users }
}
