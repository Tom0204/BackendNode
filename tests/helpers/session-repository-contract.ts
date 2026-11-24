import { beforeEach, describe, expect, it } from 'vitest'
import { isReferenceNotFoundError } from '../../src/repositories/errors'
import type { SessionRepository } from '../../src/repositories/session.repository'
import type { UserRepository } from '../../src/repositories/user.repository'
import { generateSessionToken, hashSessionToken } from '../../src/services/session-token'
import type { User } from '../../src/types/user'
import { newUser, UNKNOWN_USER_ID } from './user-repository-contract'

/* Contrat d'un repository de sessions (AUTH-05).
 * Même suite sur le repository en mémoire (npm test) et sur le repository Prisma (npm run test:db).
 */

const HOUR_MS = 60 * 60 * 1000

export interface SessionRepositoryPair {
    users: UserRepository
    sessions: SessionRepository
}

/** `getRepositories` renvoie des repositories vides au début de chaque test (le nettoyage est fait par l'appelant). */
export function describeSessionRepositoryContract(label: string, getRepositories: () => SessionRepositoryPair): void {
    describe(`Contrat SessionRepository : ${label}`, () => {
        let users: UserRepository
        let sessions: SessionRepository
        let owner: User
        const expiresAt = new Date(Date.now() + HOUR_MS)

        beforeEach(async () => {
            ;({ users, sessions } = getRepositories())
            owner = await users.create(newUser('Owner', 'owner@test.local'))
        })

        it('create : renvoie la session sans empreinte, non révoquée', async () => {
            const session = await sessions.create({ userId: owner.id, tokenHash: hashSessionToken(generateSessionToken()), expiresAt })
            expect(session).toMatchObject({ userId: owner.id, expiresAt, revokedAt: null })
            expect(session.createdAt).toBeInstanceOf(Date)
            expect(Object.keys(session).sort()).toEqual(['createdAt', 'expiresAt', 'id', 'revokedAt', 'userId'])
        })

        it('create : compte inexistant → ReferenceNotFoundError', async () => {
            const error = await sessions
                .create({ userId: UNKNOWN_USER_ID, tokenHash: hashSessionToken(generateSessionToken()), expiresAt })
                .catch((e: unknown) => e)
            expect(isReferenceNotFoundError(error)).toBe(true)
        })

        it('findByTokenHash : session et compte pour la bonne empreinte, undefined sinon', async () => {
            const tokenHash = hashSessionToken(generateSessionToken())
            const session = await sessions.create({ userId: owner.id, tokenHash, expiresAt })
            expect(await sessions.findByTokenHash(tokenHash)).toEqual({ session, user: owner })
            expect(await sessions.findByTokenHash(hashSessionToken(generateSessionToken()))).toBeUndefined()
        })

        it('revoke : date enregistrée une seule fois ; false pour une session inconnue ou déjà révoquée', async () => {
            const tokenHash = hashSessionToken(generateSessionToken())
            const session = await sessions.create({ userId: owner.id, tokenHash, expiresAt })
            const revokedAt = new Date(Date.now() + 1000)

            expect(await sessions.revoke(session.id, revokedAt)).toBe(true)
            expect(await sessions.revoke(session.id, new Date(Date.now() + 5000))).toBe(false)
            expect((await sessions.findByTokenHash(tokenHash))?.session.revokedAt).toEqual(revokedAt)
            expect(await sessions.revoke(UNKNOWN_USER_ID, revokedAt)).toBe(false)
        })

        it('revoke : les autres sessions du même compte restent actives', async () => {
            const firstHash = hashSessionToken(generateSessionToken())
            const secondHash = hashSessionToken(generateSessionToken())
            const first = await sessions.create({ userId: owner.id, tokenHash: firstHash, expiresAt })
            await sessions.create({ userId: owner.id, tokenHash: secondHash, expiresAt })

            await sessions.revoke(first.id, new Date())

            expect((await sessions.findByTokenHash(secondHash))?.session.revokedAt).toBeNull()
        })

        it('compte supprimé : ses sessions ne sont plus trouvées', async () => {
            const tokenHash = hashSessionToken(generateSessionToken())
            await sessions.create({ userId: owner.id, tokenHash, expiresAt })
            await users.delete(owner.id)
            expect(await sessions.findByTokenHash(tokenHash)).toBeUndefined()
        })
    })
}
