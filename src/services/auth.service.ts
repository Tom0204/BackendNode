import { isUniqueConstraintError } from '../repositories/errors'
import type { UserRepository } from '../repositories/user.repository'
import type { User } from '../types/user'
import type { PasswordHasher } from './password-hasher'
import { emailTaken, normalizeEmail } from './user.service'

/** Données d'inscription, déjà validées par le schéma de la route (format de l'email, longueur du mot de passe). */
export interface RegistrationInput {
    name: string
    email: string
    password: string
}

export interface AuthServiceDependencies {
    userRepository: UserRepository
    passwordHasher: PasswordHasher
}

/**
 * Service d'authentification (AUTH-04). Indépendant d'Express : réutilisable par un autre transport.
 * La connexion et les jetons relèvent d'AUTH-05 et AUTH-06.
 */
export function createAuthService({ userRepository, passwordHasher }: AuthServiceDependencies) {
    return {
        /**
         * Crée un compte : email en minuscules, mot de passe hashé avant toute écriture, rôle par défaut (PLAYER).
         * Le hash est calculé même si l'email est déjà pris : la durée de la réponse ne révèle pas l'existence du compte.
         * L'unicité est garantie par la base : un email déjà utilisé donne 409 EMAIL_ALREADY_USED.
         * Le compte renvoyé ne contient ni le mot de passe ni son hash.
         */
        async register(input: RegistrationInput): Promise<User> {
            const passwordHash = await passwordHasher.hash(input.password)
            try {
                return await userRepository.create({
                    name: input.name,
                    email: normalizeEmail(input.email),
                    passwordHash
                })
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    throw emailTaken()
                }
                throw error
            }
        }
    }
}

export type AuthService = ReturnType<typeof createAuthService>
