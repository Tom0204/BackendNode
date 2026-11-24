import type { Request, RequestHandler } from 'express'
import { TOKEN_TYPE } from '../config/auth'
import type { AuthService } from '../services/auth.service'
import type { AuthContext } from '../types/auth'
import type { UserRole } from '../types/user'
import { forbidden, HttpError, unauthenticated } from '../utils/http-error'

/* Authentification et autorisation des requêtes (AUTH-07, AUTH-08). */

// « Bearer <jeton> » : le nom du schéma est insensible à la casse (RFC 7235), le jeton est un seul mot.
const BEARER_PATTERN = /^Bearer ([^\s]+)$/i

/** Défi renvoyé avec chaque 401 d'une route protégée (RFC 6750). */
const WWW_AUTHENTICATE = `${TOKEN_TYPE} realm="api"`

/**
 * Exige une session valide (AUTH-07).
 * - Le jeton n'est lu que dans l'en-tête Authorization, jamais dans l'URL ni dans le corps.
 * - Absent, mal formé, inconnu, expiré, révoqué, compte désactivé : 401 UNAUTHENTICATED, sans détail.
 * - Valide : req.auth contient l'utilisateur authentifié (identifiant, rôle, session).
 */
export function createRequireAuth(authService: AuthService): RequestHandler {
    return (req, res, next) => {
        const match = BEARER_PATTERN.exec(req.get('Authorization') ?? '')
        const rejectWith = (error: unknown) => {
            if (error instanceof HttpError && error.status === 401) {
                res.set('WWW-Authenticate', WWW_AUTHENTICATE)
            }
            next(error)
        }
        if (!match?.[1]) {
            rejectWith(unauthenticated())
            return
        }
        authService.authenticate(match[1]).then((auth) => {
            req.auth = auth
            next()
        }, rejectWith)
    }
}

/**
 * Exige l'un des rôles donnés (AUTH-08) : 403 FORBIDDEN sinon. À placer après requireAuth.
 * Les services vérifient aussi les droits : ce middleware n'est qu'une première barrière.
 */
export function requireRole(...roles: UserRole[]): RequestHandler {
    return (req, _res, next) => {
        const auth = req.auth
        if (!auth) {
            next(unauthenticated())
            return
        }
        next(roles.includes(auth.role) ? undefined : forbidden('FORBIDDEN', 'Administrator role required'))
    }
}

/**
 * Utilisateur authentifié d'une requête protégée. Son absence est une erreur de programmation
 * (route protégée sans requireAuth) : elle donne 500, jamais un accès anonyme.
 */
export function getAuth(req: Request): AuthContext {
    if (!req.auth) {
        throw new Error('Route protégée sans requireAuth : contexte d’authentification absent')
    }
    return req.auth
}
