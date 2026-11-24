import type { PrismaClient } from '../generated/prisma/client'
import type { NewSession, Session, SessionWithUser } from '../types/auth'
import { isPrismaError, PRISMA_FOREIGN_KEY_VIOLATION, ReferenceNotFoundError } from './errors'

/**
 * Accès aux sessions de connexion (AUTH-05). Seule l'empreinte du jeton est stockée et recherchée.
 * Le repository ne décide pas de la validité (expiration, révocation, statut du compte) : c'est le rôle
 * du service, qui dispose de l'horloge.
 */
export interface SessionRepository {
    /** Crée une session. Compte inexistant : ReferenceNotFoundError('user'). */
    create(data: NewSession): Promise<Session>
    /** Session correspondant à l'empreinte, avec son compte ; undefined si aucune. */
    findByTokenHash(tokenHash: string): Promise<SessionWithUser | undefined>
    /** Révoque une session encore active ; false si elle n'existe pas ou était déjà révoquée. */
    revoke(id: string, revokedAt: Date): Promise<boolean>
}

const SESSION_SELECT = { id: true, userId: true, createdAt: true, expiresAt: true, revokedAt: true } as const
const SESSION_USER_SELECT = { id: true, name: true, email: true, role: true, status: true, createdAt: true, updatedAt: true } as const

export function createPrismaSessionRepository(prisma: PrismaClient): SessionRepository {
    return {
        async create(data) {
            try {
                return await prisma.session.create({ data, select: SESSION_SELECT })
            } catch (error) {
                if (isPrismaError(error, PRISMA_FOREIGN_KEY_VIOLATION)) {
                    throw new ReferenceNotFoundError('user')
                }
                throw error
            }
        },

        async findByTokenHash(tokenHash) {
            const row = await prisma.session.findUnique({
                where: { tokenHash },
                select: { ...SESSION_SELECT, user: { select: SESSION_USER_SELECT } }
            })
            if (!row) {
                return undefined
            }
            const { user, ...session } = row
            return { session, user }
        },

        async revoke(id, revokedAt) {
            // Condition revokedAt = null : une session déjà révoquée garde sa date de déconnexion d'origine.
            const { count } = await prisma.session.updateMany({ where: { id, revokedAt: null }, data: { revokedAt } })
            return count > 0
        }
    }
}
