import type { PrismaClient } from '../generated/prisma/client'
import type { User, UserData } from '../types/user'
import { isPrismaError, PRISMA_RECORD_NOT_FOUND, PRISMA_UNIQUE_VIOLATION, UniqueConstraintError } from './errors'

/**
 * Accès aux comptes joueurs (DB-04). Seule couche qui touche à la base : les services ne voient que cette interface.
 * - Introuvable : `undefined` (lecture, modification) ou `false` (suppression), jamais d'exception.
 * - Email déjà utilisé : UniqueConstraintError('email'). L'unicité est garantie par la base, pas par une lecture préalable.
 * - Les données reçues sont supposées validées et normalisées par le service (email en minuscules).
 */
export interface UserRepository {
    /** Tous les utilisateurs, du plus ancien au plus récent (createdAt, puis id pour départager). */
    findAll(): Promise<User[]>
    findById(id: string): Promise<User | undefined>
    create(data: UserData): Promise<User>
    update(id: string, data: Partial<UserData>): Promise<User | undefined>
    delete(id: string): Promise<boolean>
}

// Colonnes lues : exactement les champs du type User (jamais de colonne ajoutée par une migration future).
const USER_SELECT = { id: true, name: true, email: true, createdAt: true, updatedAt: true } as const

// Ordre explicite et stable : createdAt a une précision d'une milliseconde, l'id (UUID v7) départage les égalités.
const USER_ORDER = [{ createdAt: 'asc' }, { id: 'asc' }] as const

// Traduit la violation d'unicité (seule contrainte unique modifiable : l'email).
function translateWriteError(error: unknown): never {
    if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
        throw new UniqueConstraintError('email')
    }
    throw error
}

export function createPrismaUserRepository(prisma: PrismaClient): UserRepository {
    return {
        findAll: () => prisma.user.findMany({ select: USER_SELECT, orderBy: [...USER_ORDER] }),

        async findById(id) {
            return (await prisma.user.findUnique({ where: { id }, select: USER_SELECT })) ?? undefined
        },

        async create(data) {
            try {
                return await prisma.user.create({ data, select: USER_SELECT })
            } catch (error) {
                return translateWriteError(error)
            }
        },

        async update(id, data) {
            try {
                return await prisma.user.update({ where: { id }, data, select: USER_SELECT })
            } catch (error) {
                if (isPrismaError(error, PRISMA_RECORD_NOT_FOUND)) {
                    return undefined
                }
                return translateWriteError(error)
            }
        },

        async delete(id) {
            // Suppression en cascade de ses personnages (data-model.md §5).
            const { count } = await prisma.user.deleteMany({ where: { id } })
            return count > 0
        }
    }
}
