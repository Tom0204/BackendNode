import { randomUUID } from 'node:crypto'
import { ReferenceNotFoundError } from '../../src/repositories/errors'
import type { SessionRepository } from '../../src/repositories/session.repository'
import type { UserRepository } from '../../src/repositories/user.repository'
import type { Session } from '../../src/types/auth'

/* Repository de sessions contrôlé, pour les tests sans base de données (AUTH-05).
 * Même comportement que le repository Prisma, vérifié par la suite de contrat
 * (tests/helpers/session-repository-contract.ts). Le compte associé est relu dans le repository utilisateur :
 * un compte supprimé rend ses sessions introuvables, comme la suppression en cascade de PostgreSQL.
 */

export interface InMemorySessionRepository extends SessionRepository {
    /** Sessions enregistrées pour un compte, avec leur empreinte (lecture réservée aux tests). */
    sessionsOf(userId: string): Array<Session & { tokenHash: string }>
}

interface StoredSession extends Session {
    tokenHash: string
}

const copy = ({ tokenHash: _tokenHash, ...session }: StoredSession): Session => ({
    ...session,
    createdAt: new Date(session.createdAt),
    expiresAt: new Date(session.expiresAt),
    revokedAt: session.revokedAt === null ? null : new Date(session.revokedAt)
})

export function createInMemorySessionRepository(users: UserRepository): InMemorySessionRepository {
    const sessions = new Map<string, StoredSession>()

    return {
        async create({ userId, tokenHash, expiresAt }) {
            if (!(await users.findById(userId))) {
                throw new ReferenceNotFoundError('user')
            }
            if ([...sessions.values()].some((session) => session.tokenHash === tokenHash)) {
                throw new Error('token_hash déjà présent (contrainte unique)')
            }
            const session: StoredSession = { id: randomUUID(), userId, tokenHash, createdAt: new Date(), expiresAt, revokedAt: null }
            sessions.set(session.id, session)
            return copy(session)
        },

        async findByTokenHash(tokenHash) {
            const session = [...sessions.values()].find((candidate) => candidate.tokenHash === tokenHash)
            const user = session ? await users.findById(session.userId) : undefined
            return session && user ? { session: copy(session), user } : undefined
        },

        async revoke(id, revokedAt) {
            const session = sessions.get(id)
            if (!session || session.revokedAt !== null) {
                return false
            }
            sessions.set(id, { ...session, revokedAt })
            return true
        },

        sessionsOf(userId) {
            return [...sessions.values()].filter((session) => session.userId === userId).map((session) => ({ ...copy(session), tokenHash: session.tokenHash }))
        }
    }
}
