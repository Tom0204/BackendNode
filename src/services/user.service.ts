import type { UserRepository } from '../repositories/user.repository'
import { isUniqueConstraintError } from '../repositories/errors'
import { conflict, notFound } from '../utils/http-error'
import type { User, UserData } from '../types/user'

// Règles métier de gestion des comptes existants. Ce service ne contient aucune requête :
// les accès à la base passent par le repository reçu (DB-04).
// Les routes /api/v1/users sont retirées jusqu'à la mise en place des permissions (AUTH-02, reporté après AUTH-07/08) :
// ce service n'est pas exposé pour l'instant ; la création d'un compte passe par l'inscription (auth.service.ts, AUTH-04).

const userNotFound = () => notFound('USER_NOT_FOUND', 'User not found')
/** Erreur 409 d'un email déjà utilisé, commune à l'inscription et à la modification d'un compte. */
export const emailTaken = () => conflict('EMAIL_ALREADY_USED', 'Email already taken')

/** Email enregistré en minuscules : deux emails qui ne diffèrent que par la casse désignent le même compte. */
export function normalizeEmail(email: string): string {
    return email.toLowerCase()
}

// L'unicité de l'email est garantie par la base : sa violation devient 409 EMAIL_ALREADY_USED.
function translateRepositoryError(error: unknown): never {
    if (isUniqueConstraintError(error)) {
        throw emailTaken()
    }
    throw error
}

/** Construit le service utilisateur à partir d'un repository (Prisma en production, contrôlé dans les tests). */
export function createUserService(repository: UserRepository) {
    async function getById(id: string): Promise<User> {
        const user = await repository.findById(id)
        if (!user) {
            throw userNotFound()
        }
        return user
    }

    // Modification : 404 si l'utilisateur n'existe pas, 409 si l'email appartient à un autre compte.
    async function update(id: string, data: Partial<UserData>): Promise<User> {
        let user: User | undefined
        try {
            user = await repository.update(id, data)
        } catch (error) {
            translateRepositoryError(error)
        }
        if (!user) {
            throw userNotFound()
        }
        return user
    }

    return {
        getAll: (): Promise<User[]> => repository.findAll(),

        getById,

        replace: (id: string, input: UserData): Promise<User> =>
            update(id, { name: input.name, email: normalizeEmail(input.email) }),

        patch(id: string, input: Partial<UserData>): Promise<User> {
            const data: Partial<UserData> = {}
            if (input.name !== undefined) {
                data.name = input.name
            }
            if (input.email !== undefined) {
                data.email = normalizeEmail(input.email)
            }
            return update(id, data)
        },

        async remove(id: string): Promise<void> {
            if (!(await repository.delete(id))) {
                throw userNotFound()
            }
        }
    }
}

export type UserService = ReturnType<typeof createUserService>
