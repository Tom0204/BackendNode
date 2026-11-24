import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { getAuth, requireRole } from '../../src/middlewares/auth.middleware'
import type { AuthContext } from '../../src/types/auth'

/* Middlewares d'autorisation (AUTH-07, AUTH-08) : cas qui ne passent pas par une route réelle. */

const PLAYER: AuthContext = { userId: 'u1', role: 'PLAYER', sessionId: 's1' }
const ADMIN: AuthContext = { userId: 'u2', role: 'ADMIN', sessionId: 's2' }

function runRequireRole(auth: AuthContext | undefined) {
    const next = vi.fn<(error?: unknown) => void>()
    requireRole('ADMIN')({ auth } as Request, {} as Response, next)
    return next.mock.calls[0]?.[0]
}

describe('requireRole', () => {
    it('rôle autorisé : next() sans erreur', () => {
        expect(runRequireRole(ADMIN)).toBeUndefined()
    })

    it('autre rôle : 403 FORBIDDEN', () => {
        expect(runRequireRole(PLAYER)).toMatchObject({ status: 403, code: 'FORBIDDEN' })
    })

    it('sans authentification préalable : 401 (jamais un accès anonyme)', () => {
        expect(runRequireRole(undefined)).toMatchObject({ status: 401, code: 'UNAUTHENTICATED' })
    })
})

describe('getAuth', () => {
    it('renvoie le contexte placé par requireAuth', () => {
        expect(getAuth({ auth: PLAYER } as Request)).toBe(PLAYER)
    })

    it('route protégée sans requireAuth : erreur de programmation (500), pas un accès anonyme', () => {
        let thrown: unknown
        try {
            getAuth({} as Request)
        } catch (error) {
            thrown = error
        }
        // Erreur ordinaire, sans statut HTTP : le gestionnaire d'erreurs la transforme en 500 générique.
        expect(thrown).toBeInstanceOf(Error)
        expect(thrown).not.toHaveProperty('status')
    })
})
