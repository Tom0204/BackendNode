import { randomUUID } from 'node:crypto'
import { UniqueConstraintError } from '../../src/repositories/errors'
import type { UserRepository } from '../../src/repositories/user.repository'
import { DEFAULT_USER_ROLE, DEFAULT_USER_STATUS, type NewUser, type User } from '../../src/types/user'

/* Repository utilisateur contrôlé, pour les tests sans base de données (DB-04).
 * Réservé aux tests : la persistance du projet est PostgreSQL (AGENTS.md, aucune persistance définitive en mémoire).
 * Il reproduit le comportement du repository Prisma, vérifié par la même suite de contrat
 * (tests/helpers/user-repository-contract.ts) : email unique, introuvable → undefined/false,
 * tri par date de création puis identifiant, rôle PLAYER et statut ACTIVE par défaut, hash jamais renvoyé
 * hors findCredentialsByEmail.
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

    const sortedUsers = (): User[] => [...records.values()].map(({ user }) => user).sort(compareUsers)

    const recordByEmail = (email: string): StoredUser | undefined =>
        [...records.values()].find(({ user }) => user.email === email)

    // Modifie un compte existant ; undefined s'il n'existe pas.
    function updateRecord(id: string, changes: Partial<User>): User | undefined {
        const record = records.get(id)
        if (!record) {
            return undefined
        }
        const updated: User = { ...record.user, ...changes, updatedAt: new Date() }
        records.set(id, { ...record, user: updated })
        return copy(updated)
    }

    return {
        async findAll() {
            return sortedUsers().map(copy)
        },

        async findPage({ skip, take }) {
            const users = sortedUsers()
            return { users: users.slice(skip, skip + take).map(copy), totalItems: users.length }
        },

        async findById(id) {
            const record = records.get(id)
            return record ? copy(record.user) : undefined
        },

        async findByEmail(email) {
            const record = recordByEmail(email)
            return record ? copy(record.user) : undefined
        },

        async findCredentialsByEmail(email) {
            const record = recordByEmail(email)
            return record ? { user: copy(record.user), passwordHash: record.passwordHash } : undefined
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
                status: DEFAULT_USER_STATUS,
                createdAt: now,
                updatedAt: now
            }
            records.set(user.id, { user, passwordHash: data.passwordHash })
            return copy(user)
        },

        async update(id, data) {
            if (records.has(id) && data.email !== undefined && emailTakenByAnother(data.email, id)) {
                throw new UniqueConstraintError('email')
            }
            return updateRecord(id, data)
        },

        async setRole(id, role) {
            return updateRecord(id, { role })
        },

        async setStatus(id, status) {
            return updateRecord(id, { status })
        },

        async delete(id) {
            return records.delete(id)
        },

        storedPasswordHash(id) {
            return records.get(id)?.passwordHash
        }
    }
}
