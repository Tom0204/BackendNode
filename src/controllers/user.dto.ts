import type { User, UserRole } from '../types/user'

/**
 * Compte tel que renvoyé par l'API (DTO public, AUTH-01).
 * Liste blanche de champs : ni mot de passe, ni hash, ni dates internes.
 */
export interface UserResponse {
    id: string
    name: string
    email: string
    role: UserRole
}

export function toUserResponse(user: User): UserResponse {
    return { id: user.id, name: user.name, email: user.email, role: user.role }
}
