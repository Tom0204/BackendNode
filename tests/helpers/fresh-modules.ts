import type { Express } from 'express'
import { vi } from 'vitest'

/** Type du service utilisateur, obtenu sans importer le module à l'exécution. */
export type UserService = typeof import('../../src/services/user.service').userService

/**
 * Charge une application Express neuve, dont le repository en mémoire est revenu à son état initial.
 * Renvoie aussi le service utilisateur de CETTE application, pour pouvoir l'espionner (vi.spyOn).
 *
 * vi.resetModules() vide le cache des modules : les import() qui suivent réexécutent
 * src/app.ts, les services et le repository. À appeler dans un beforeEach.
 */
export async function loadFreshApp(): Promise<{ app: Express; userService: UserService }> {
    vi.resetModules()
    const { default: app } = await import('../../src/app')
    // Même cache que l'application ci-dessus : c'est bien l'instance utilisée par ses routes.
    const { userService } = await import('../../src/services/user.service')
    return { app, userService }
}

/** Charge un service utilisateur neuf, sans application Express (tests unitaires). */
export async function loadFreshUserService(): Promise<UserService> {
    vi.resetModules()
    const { userService } = await import('../../src/services/user.service')
    return userService
}