import { randomUUID } from 'node:crypto'
import { UniqueConstraintError } from '../../src/repositories/errors'
import type { UserRepository } from '../../src/repositories/user.repository'
import { DEFAULT_USER_ROLE, type NewUser, type User } from '../../src/types/user'

/* Repository utilisateur contrôlé, pour les tests sans base de données (DB-04).
 * Réservé aux tests : la persistance du projet est PostgreSQL (AGENTS.md, aucune persistance définitive en mémoire).
 * Il reproduit le comportement du repository Prisma, vérifié par la même suite de contrat
 * (tests/helpers/user-repository-contract.ts) : email unique, introuvable → undefined/false,
 * tri par date de création puis identifiant, rôle PLAYER par défaut, hash jamais renvoyé.
 */

/** Repository en mémoire, avec un accès réservé aux tests au hash enregistré (comme une lecture directe en base). */
export interface InMemoryUserRepository extends UserRepository {
    storedPasswordHash(id: string): string | undefined
}

// Enregistrement interne : le compte et son hash, comme une ligne de la table users.
interface StoredUser {
    user: User
    passwordHash: string
}

// Copie : un test ne peut pas modifier l'état du repository par la référence renvoyée.
const copy = (user: User): User => ({ ...user, createdAt: new Date(user.createdAt), updatedAt: new Date(user.updatedAt) })

function compareUsers(a: User, b: User): number {
    const byDate = a.createdAt.getTime() - b.createdAt.getTime()
    if (byDate !== 0) {
        return byDate
    }
    // UUID en minuscules : l'ordre des chaînes est celui des octets, comme le type uuid de PostgreSQL.
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function createInMemoryUserRepository(): InMemoryUserRepository {
    const records = new Map<string, StoredUser>()

    const emailTakenByAnother = (email: string, id?: string): boolean =>
        [...records.values()].some(({ user }) => user.email === email && user.id !== id)

    return {
        async findAll() {
            return [...records.values()].map(({ user }) => user).sort(compareUsers).map(copy)
        },

        async findById(id) {
            const record = records.get(id)
            return record ? copy(record.user) : undefined
        },

        async create(data: NewUser) {
            if (emailTakenByAnother(data.email)) {
                throw new UniqueConstraintError('email')
            }
            const now = new Date()
            const user: User = {
                id: randomUUID(),
                name: data.name,
                email: data.email,
                role: DEFAULT_USER_ROLE,
                createdAt: now,
                updatedAt: now
            }
            records.set(user.id, { user, passwordHash: data.passwordHash })
            return copy(user)
        },

        async update(id, data) {
            const record = records.get(id)
            if (!record) {
                return undefined
            }
            if (data.email !== undefined && emailTakenByAnother(data.email, id)) {
                throw new UniqueConstraintError('email')
            }
            const updated: User = { ...record.user, ...data, updatedAt: new Date() }
            records.set(id, { ...record, user: updated })
            return copy(updated)
        },

        async delete(id) {
            return records.delete(id)
        },

        storedPasswordHash(id) {
            return records.get(id)?.passwordHash
        }
    }
}
