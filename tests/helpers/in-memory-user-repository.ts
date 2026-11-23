import { randomUUID } from 'node:crypto'
import { UniqueConstraintError } from '../../src/repositories/errors'
import type { UserRepository } from '../../src/repositories/user.repository'
import type { User, UserData } from '../../src/types/user'

/* Repository utilisateur contrôlé, pour les tests sans base de données (DB-04).
 * Réservé aux tests : la persistance du projet est PostgreSQL (AGENTS.md, aucune persistance définitive en mémoire).
 * Il reproduit le comportement du repository Prisma, vérifié par la même suite de contrat
 * (tests/helpers/user-repository-contract.ts) : email unique, introuvable → undefined/false,
 * tri par date de création puis identifiant.
 */

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

export function createInMemoryUserRepository(): UserRepository {
    const users = new Map<string, User>()

    const emailTakenByAnother = (email: string, id?: string): boolean =>
        [...users.values()].some((user) => user.email === email && user.id !== id)

    return {
        async findAll() {
            return [...users.values()].sort(compareUsers).map(copy)
        },

        async findById(id) {
            const user = users.get(id)
            return user ? copy(user) : undefined
        },

        async create(data: UserData) {
            if (emailTakenByAnother(data.email)) {
                throw new UniqueConstraintError('email')
            }
            const now = new Date()
            const user: User = { id: randomUUID(), name: data.name, email: data.email, createdAt: now, updatedAt: now }
            users.set(user.id, user)
            return copy(user)
        },

        async update(id, data) {
            const user = users.get(id)
            if (!user) {
                return undefined
            }
            if (data.email !== undefined && emailTakenByAnother(data.email, id)) {
                throw new UniqueConstraintError('email')
            }
            const updated: User = { ...user, ...data, updatedAt: new Date() }
            users.set(id, updated)
            return copy(updated)
        },

        async delete(id) {
            return users.delete(id)
        }
    }
}
