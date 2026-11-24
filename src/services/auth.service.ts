import { randomUUID } from 'node:crypto'
import { isUniqueConstraintError } from '../repositories/errors'
import type { SessionRepository } from '../repositories/session.repository'
import type { UserRepository } from '../repositories/user.repository'
import type { AuthContext, LoginResult } from '../types/auth'
import type { User } from '../types/user'
import { forbidden, unauthenticated } from '../utils/http-error'
import type { PasswordHasher } from './password-hasher'
import { generateSessionToken, hashSessionToken, SESSION_TOKEN_PATTERN } from './session-token'
import { emailTaken, normalizeEmail } from './user.service'

/** Données d'inscription, déjà validées par le schéma de la route (format de l'email, longueur du mot de passe). */
export interface RegistrationInput {
    name: string
    email: string
    password: string
}

/** Données de connexion, déjà validées par le schéma de la route. */
export interface LoginInput {
    email: string
    password: string
}

export interface AuthServiceDependencies {
    userRepository: UserRepository
    sessionRepository: SessionRepository
    passwordHasher: PasswordHasher
    /** Durée de vie absolue d'une session, en millisecondes (SESSION_TTL_HOURS). */
    sessionTtlMs: number
    /** Horloge injectable : les tests vérifient l'expiration sans attendre. */
    now?: () => Date
}

// Erreurs de l'authentification. Un même message pour un email inconnu et un mauvais mot de passe (AUTH-06).
const invalidCredentials = () => unauthenticated('INVALID_CREDENTIALS', 'Invalid email or password')
const accountDisabled = () => forbidden('ACCOUNT_DISABLED', 'Account disabled')
// Jeton absent, mal formé, inconnu, expiré, révoqué ou compte désactivé : une seule réponse, sans détail (AUTH-07).
const authenticationRequired = () => unauthenticated()

/**
 * Service d'authentification (AUTH-04 à AUTH-07, AUTH-10). Indépendant d'Express : réutilisable par un autre transport.
 * Stratégie (D1 du lot L2) : sessions opaques stockées en PostgreSQL, durée de vie absolue, révocation réelle.
 */
export function createAuthService({
    userRepository,
    sessionRepository,
    passwordHasher,
    sessionTtlMs,
    now = () => new Date()
}: AuthServiceDependencies) {
    // Hash d'un mot de passe aléatoire, calculé une seule fois : il sert à vérifier un mot de passe même quand
    // l'email est inconnu, pour que la durée de la réponse ne révèle pas l'existence du compte.
    let decoyHash: Promise<string> | undefined
    const getDecoyHash = (): Promise<string> => (decoyHash ??= passwordHasher.hash(randomUUID()))

    return {
        /**
         * Crée un compte : email en minuscules, mot de passe hashé avant toute écriture, rôle PLAYER, statut ACTIVE.
         * Le hash est calculé même si l'email est déjà pris : la durée de la réponse ne révèle pas l'existence du compte.
         * Aucun jeton n'est émis : la connexion est une étape distincte (AUTH-04).
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
        },

        /**
         * Connexion (AUTH-06) : vérifie le mot de passe avec la bibliothèque, puis ouvre une session.
         * - Email inconnu ou mauvais mot de passe : 401 INVALID_CREDENTIALS, même message et même travail.
         * - Compte désactivé : 403 ACCOUNT_DISABLED, seulement si le mot de passe est correct (D4) ;
         *   sans le mot de passe, un tiers n'apprend rien sur le compte.
         */
        async login(input: LoginInput): Promise<LoginResult> {
            const credentials = await userRepository.findCredentialsByEmail(normalizeEmail(input.email))
            if (!credentials) {
                await passwordHasher.verify(await getDecoyHash(), input.password)
                throw invalidCredentials()
            }
            if (!(await passwordHasher.verify(credentials.passwordHash, input.password))) {
                throw invalidCredentials()
            }
            if (credentials.user.status !== 'ACTIVE') {
                throw accountDisabled()
            }

            const token = generateSessionToken()
            const expiresAt = new Date(now().getTime() + sessionTtlMs)
            await sessionRepository.create({ userId: credentials.user.id, tokenHash: hashSessionToken(token), expiresAt })
            return { token, expiresAt, user: credentials.user }
        },

        /**
         * Authentifie une requête (AUTH-07) à partir du jeton transmis.
         * Refus (401) : format invalide, session inconnue, révoquée ou expirée, compte désactivé.
         */
        async authenticate(token: string): Promise<AuthContext> {
            if (!SESSION_TOKEN_PATTERN.test(token)) {
                throw authenticationRequired()
            }
            const found = await sessionRepository.findByTokenHash(hashSessionToken(token))
            if (
                !found ||
                found.session.revokedAt !== null ||
                found.session.expiresAt.getTime() <= now().getTime() ||
                found.user.status !== 'ACTIVE'
            ) {
                throw authenticationRequired()
            }
            return { userId: found.user.id, role: found.user.role, sessionId: found.session.id }
        },

        /** Déconnexion (AUTH-10) : révoque uniquement la session utilisée par la requête. */
        async logout(auth: AuthContext): Promise<void> {
            await sessionRepository.revoke(auth.sessionId, now())
        }
    }
}

export type AuthService = ReturnType<typeof createAuthService>
