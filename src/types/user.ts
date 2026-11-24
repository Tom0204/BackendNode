/** Rôles des comptes (AUTH-01, AUTH-08) : joueur et administrateur. */
export const USER_ROLES = ['PLAYER', 'ADMIN'] as const

export type UserRole = (typeof USER_ROLES)[number]

/** Rôle attribué à tout nouveau compte (aussi imposé par la base : DEFAULT 'PLAYER'). */
export const DEFAULT_USER_ROLE: UserRole = 'PLAYER'

/** Statuts des comptes (AUTH-06) : un compte désactivé ne peut ni se connecter ni utiliser ses sessions. */
export const USER_STATUSES = ['ACTIVE', 'DISABLED'] as const

export type UserStatus = (typeof USER_STATUSES)[number]

/** Statut de tout nouveau compte (aussi imposé par la base : DEFAULT 'ACTIVE'). */
export const DEFAULT_USER_STATUS: UserStatus = 'ACTIVE'

/**
 * Compte joueur, tel que les services le manipulent (indépendant de Prisma et d'Express).
 * Ne contient jamais le hash du mot de passe : il n'est lu que pour la connexion (UserCredentials).
 */
export interface User {
    /** UUID v7 généré par PostgreSQL. */
    id: string
    name: string
    /** Toujours en minuscules (normalisé par le service, imposé par la base). */
    email: string
    role: UserRole
    status: UserStatus
    createdAt: Date
    updatedAt: Date
}

/** Champs d'un utilisateur modifiables par les services (ni mot de passe, ni rôle, ni statut). */
export interface UserData {
    name: string
    email: string
}

/** Données d'un nouveau compte : le mot de passe arrive déjà hashé (AUTH-03). */
export interface NewUser extends UserData {
    passwordHash: string
}

/** Compte et hash de son mot de passe : lecture réservée à la connexion (AUTH-06). */
export interface UserCredentials {
    user: User
    passwordHash: string
}

/** Page de comptes et nombre total de comptes (pagination, conventions §9). */
export interface UserPage {
    users: User[]
    totalItems: number
}
