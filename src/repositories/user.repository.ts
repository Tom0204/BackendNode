import type { PrismaClient } from '../generated/prisma/client'
import type { NewUser, User, UserCredentials, UserData, UserPage, UserRole, UserStatus } from '../types/user'
import { isPrismaError, PRISMA_RECORD_NOT_FOUND, PRISMA_UNIQUE_VIOLATION, UniqueConstraintError } from './errors'

/**
 * Accès aux comptes joueurs (DB-04). Seule couche qui touche à la base : les services ne voient que cette interface.
 * - Introuvable : `undefined` (lecture, modification) ou `false` (suppression), jamais d'exception.
 * - Email déjà utilisé : UniqueConstraintError('email'). L'unicité est garantie par la base, pas par une lecture préalable.
 * - Les données reçues sont supposées validées et normalisées par le service (email en minuscules).
 * - Le hash du mot de passe n'est lu que par findCredentialsByEmail (connexion, AUTH-06) : le type User ne le contient pas.
 */
export interface UserRepository {
    /** Tous les utilisateurs, du plus ancien au plus récent (createdAt, puis id pour départager). */
    findAll(): Promise<User[]>
    /** Une page d'utilisateurs, dans le même ordre, et le nombre total (lus dans une même transaction). */
    findPage(page: { skip: number; take: number }): Promise<UserPage>
    findById(id: string): Promise<User | undefined>
    findByEmail(email: string): Promise<User | undefined>
    /** Compte et hash de son mot de passe : réservé à la connexion. */
    findCredentialsByEmail(email: string): Promise<UserCredentials | undefined>
    create(data: NewUser): Promise<User>
    update(id: string, data: Partial<UserData>): Promise<User | undefined>
    /** Rôle et statut : modifiés uniquement par le script d'administration (D8 du lot L2). */
    setRole(id: string, role: UserRole): Promise<User | undefined>
    setStatus(id: string, status: UserStatus): Promise<User | undefined>
    /**
     * Supprime le compte. Une seule instruction DELETE : ses personnages et ses sessions sont supprimés
     * par la base dans la même opération (ON DELETE CASCADE), donc tout ou rien.
     */
    delete(id: string): Promise<boolean>
}

// Colonnes lues : exactement les champs du type User. password_hash n'y figure pas.
const USER_SELECT = { id: true, name: true, email: true, role: true, status: true, createdAt: true, updatedAt: true } as const

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
    // Modification d'un compte : undefined s'il n'existe pas, erreur d'unicité traduite.
    async function updateUser(id: string, data: Partial<UserData> | { role: UserRole } | { status: UserStatus }) {
        try {
            return await prisma.user.update({ where: { id }, data, select: USER_SELECT })
        } catch (error) {
            if (isPrismaError(error, PRISMA_RECORD_NOT_FOUND)) {
                return undefined
            }
            return translateWriteError(error)
        }
    }

    return {
        findAll: () => prisma.user.findMany({ select: USER_SELECT, orderBy: [...USER_ORDER] }),

        async findPage({ skip, take }) {
            const [users, totalItems] = await prisma.$transaction([
                prisma.user.findMany({ select: USER_SELECT, orderBy: [...USER_ORDER], skip, take }),
                prisma.user.count()
            ])
            return { users, totalItems }
        },

        async findById(id) {
            return (await prisma.user.findUnique({ where: { id }, select: USER_SELECT })) ?? undefined
        },

        async findByEmail(email) {
            return (await prisma.user.findUnique({ where: { email }, select: USER_SELECT })) ?? undefined
        },

        async findCredentialsByEmail(email) {
            const row = await prisma.user.findUnique({ where: { email }, select: { ...USER_SELECT, passwordHash: true } })
            if (!row) {
                return undefined
            }
            const { passwordHash, ...user } = row
            return { user, passwordHash }
        },

        async create(data) {
            try {
                return await prisma.user.create({ data, select: USER_SELECT })
            } catch (error) {
                return translateWriteError(error)
            }
        },

        update: (id, data) => updateUser(id, data),

        setRole: (id, role) => updateUser(id, { role }),

        setStatus: (id, status) => updateUser(id, { status }),

        async delete(id) {
            // Suppression en cascade de ses personnages et de ses sessions (data-model.md §5).
            const { count } = await prisma.user.deleteMany({ where: { id } })
            return count > 0
        }
    }
}
