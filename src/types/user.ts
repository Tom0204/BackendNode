/** Rôles des comptes (AUTH-01). PLAYER seul pour l'instant : les autres rôles sont décidés en AUTH-08. */
export const USER_ROLES = ['PLAYER'] as const

export type UserRole = (typeof USER_ROLES)[number]

/** Rôle attribué à tout nouveau compte (aussi imposé par la base : DEFAULT 'PLAYER'). */
export const DEFAULT_USER_ROLE: UserRole = 'PLAYER'

/**
 * Compte joueur, tel que les services le manipulent (indépendant de Prisma et d'Express).
 * Ne contient jamais le hash du mot de passe : il reste dans la base (AUTH-01).
 */
export interface User {
    /** UUID v7 généré par PostgreSQL. */
    id: string
    name: string
    /** Toujours en minuscules (normalisé par le service, imposé par la base). */
    email: string
    role: UserRole
    createdAt: Date
    updatedAt: Date
}

/** Champs d'un utilisateur modifiables par les services (ni mot de passe ni rôle). */
export interface UserData {
    name: string
    email: string
}

/** Données d'un nouveau compte : le mot de passe arrive déjà hashé (AUTH-03). */
export interface NewUser extends UserData {
    passwordHash: string
}
