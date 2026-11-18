import cors from 'cors'
import type { RequestHandler } from 'express'
import helmet from 'helmet'
import { CORS_EXPOSED_HEADERS, type CorsAllowedOrigins } from '../config/http'
import { HttpError } from '../utils/http-error'

/**
 * En-têtes de sécurité HTTP (D3), avec la configuration par défaut de helmet :
 * X-Content-Type-Options: nosniff, X-Frame-Options, Referrer-Policy, Strict-Transport-Security,
 * Content-Security-Policy... et suppression de X-Powered-By.
 */
export function createSecurityHeaders(): RequestHandler {
    return helmet()
}

/**
 * CORS (D4). Ne concerne que les navigateurs : une requête sans en-tête Origin (Postman, curl, tests)
 * n'est jamais bloquée, elle reçoit simplement sa réponse.
 * Origine non autorisée : aucun en-tête Access-Control-Allow-Origin, le navigateur bloque la lecture de la réponse.
 * Les préflights OPTIONS reçoivent ici leur réponse (204) : elles n'atteignent ni le rate limiting ni les routes.
 * Une liste vide (production sans CORS_ORIGINS) n'autorise aucune origine, mais répond quand même aux préflights.
 */
export function createCorsMiddleware(allowedOrigins: CorsAllowedOrigins): RequestHandler {
    return cors({
        origin: allowedOrigins === '*' ? '*' : [...allowedOrigins],
        exposedHeaders: CORS_EXPOSED_HEADERS
    })
}

// Une requête a un corps si elle annonce une longueur positive ou un envoi par morceaux (Transfer-Encoding).
// Content-Length: 0 (par exemple un POST vide envoyé par Postman) n'est pas un corps.
function hasBody(headers: { 'content-length'?: string; 'transfer-encoding'?: string }): boolean {
    if (headers['transfer-encoding'] !== undefined) {
        return true
    }
    const length = Number(headers['content-length'])
    return Number.isFinite(length) && length > 0
}

/**
 * Rejette en 415 UNSUPPORTED_MEDIA_TYPE une requête dont le corps n'est pas annoncé en JSON (D2, reprise de FND-03).
 * Une requête sans corps n'est pas concernée, quelle que soit sa méthode.
 * « application/json; charset=utf-8 » est accepté ; un jeu de caractères non pris en charge
 * est ensuite refusé en 415 par express.json() (FND-03).
 */
export const requireJsonContentType: RequestHandler = (req, _res, next) => {
    if (!hasBody(req.headers) || req.is('application/json')) {
        next()
        return
    }
    next(new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported media type'))
}