import type { UserRepository } from '../repositories/user.repository'
import { isUniqueConstraintError } from '../repositories/errors'
import type { AuthContext } from '../types/auth'
import type { User, UserData } from '../types/user'
import { conflict, forbidden, notFound } from '../utils/http-error'
import { canAccessUser, isAdmin } from './access-policy'

// Règles métier de gestion des comptes (AUTH-02, AUTH-08, AUTH-09). Ce service ne contient aucune requête :
// les accès à la base passent par le repository reçu (DB-04).
// Chaque opération reçoit l'utilisateur authentifié (`actor`) et vérifie elle-même ses droits :
// - liste : administrateurs seulement (403) ;
// - lecture, modification, suppression d'un compte : son propriétaire ou un administrateur ;
//   tout autre compte est traité comme inexistant (404 USER_NOT_FOUND), sans lecture ni écriture.
// La création d'un compte passe par l'inscription (auth.service.ts, AUTH-04).

const userNotFound = () => notFound('USER_NOT_FOUND', 'User not found')
const adminRequired = () => forbidden('FORBIDDEN', 'Administrator role required')

/** Erreur 409 d'un email déjà utilisé, commune à l'inscription et à la modification d'un compte. */
export const emailTaken = () => conflict('EMAIL_ALREADY_USED', 'Email already taken')

/** Email enregistré en minuscules : deux emails qui ne diffèrent que par la casse désignent le même compte. */
export function normalizeEmail(email: string): string {
    return email.toLowerCase()
}

/** Pagination demandée (conventions §9), déjà validée par le schéma de la route. */
export interface PageRequest {
    page: number
    pageSize: number
}

/** Métadonnées de pagination renvoyées avec une liste (conventions §9). */
export interface Pagination {
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
}

/** Construit le service utilisateur à partir d'un repository (Prisma en production, contrôlé dans les tests). */
export function createUserService(repository: UserRepository) {
    // Refus avant tout accès à la base : un joueur ne lit ni ne modifie jamais le compte d'un autre.
    function assertCanAccess(actor: AuthContext, id: string): void {
        if (!canAccessUser(actor, id)) {
            throw userNotFound()
        }
    }

    async function getById(actor: AuthContext, id: string): Promise<User> {
        assertCanAccess(actor, id)
        const user = await repository.findById(id)
        if (!user) {
            throw userNotFound()
        }
        return user
    }

    // Modification de name et email : 404 si inaccessible ou inexistant, 409 si l'email appartient à un autre compte.
    async function patch(actor: AuthContext, id: string, input: Partial<UserData>): Promise<User> {
        assertCanAccess(actor, id)
        const data: Partial<UserData> = {}
        if (input.name !== undefined) {
            data.name = input.name
        }
        if (input.email !== undefined) {
            data.email = normalizeEmail(input.email)
        }
        let user: User | undefined
        try {
            user = await repository.update(id, data)
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                throw emailTaken()
            }
            throw error
        }
        if (!user) {
            throw userNotFound()
        }
        return user
    }

    return {
        /** Liste paginée de tous les comptes : administrateurs seulement. */
        async getPage(actor: AuthContext, { page, pageSize }: PageRequest): Promise<{ users: User[]; pagination: Pagination }> {
            if (!isAdmin(actor)) {
                throw adminRequired()
            }
            const { users, totalItems } = await repository.findPage({ skip: (page - 1) * pageSize, take: pageSize })
            return { users, pagination: { page, pageSize, totalItems, totalPages: Math.ceil(totalItems / pageSize) } }
        },

        getById,

        patch,

        /** Compte de l'utilisateur authentifié (AUTH-09) : déterminé par le jeton, jamais par un identifiant fourni. */
        getMe: (actor: AuthContext): Promise<User> => getById(actor, actor.userId),

        patchMe: (actor: AuthContext, input: Partial<UserData>): Promise<User> => patch(actor, actor.userId, input),

        /**
         * Suppression d'un compte : par son propriétaire ou par un administrateur.
         * Le refus a lieu avant tout accès à la base : aucune donnée n'est effacée.
         * La suppression elle-même est une seule opération : personnages et sessions suivent par cascade.
         */
        async remove(actor: AuthContext, id: string): Promise<void> {
            assertCanAccess(actor, id)
            if (!(await repository.delete(id))) {
                throw userNotFound()
            }
        }
    }
}

export type UserService = ReturnType<typeof createUserService>
