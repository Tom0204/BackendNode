import type { RequestHandler } from 'express'
import { rateLimit, type Logger as RateLimitLogger } from 'express-rate-limit'
import type { Logger } from 'pino'
import { GLOBAL_RATE_LIMIT, STRICT_RATE_LIMIT, type RateLimitSettings } from '../config/http'
import { logger as defaultLogger } from '../config/logger'
import { HttpError } from '../utils/http-error'

/**
 * Adapte le logger Pino de l'application à l'interface attendue par express-rate-limit (option `logger`).
 * Sans cette option, la bibliothèque écrit avec console.warn et console.error.
 * Rien n'est modifié globalement : cet objet n'est utilisé que par les limiteurs qui le reçoivent.
 *
 * La bibliothèque appelle warn(erreur) pour un avertissement d'évolution (ChangeWarning),
 * error(erreur) pour un problème de configuration détecté (ValidationError),
 * et error(erreur, message) pour une erreur de son stockage : `context` conserve alors ce message.
 */
export function createRateLimitLogger(log: Logger): RateLimitLogger {
    return {
        warn: (error, context) => log.warn({ err: error, context }, 'Rate limiter warning'),
        error: (error, context) => log.error({ err: error, context }, 'Rate limiter error')
    }
}

/**
 * Crée un limiteur de requêtes par adresse IP (D5).
 * - Compteur en mémoire, propre à ce limiteur et à ce processus (stockage partagé : QUAL-02).
 * - En-têtes RateLimit et RateLimit-Policy (format IETF), plus Retry-After en cas de dépassement.
 * - Dépassement : l'erreur 429 RATE_LIMITED est transmise avec next() au gestionnaire d'erreurs existant (FND-03),
 *   qui produit la réponse au format habituel. Aucun mécanisme de réponse parallèle.
 * - Les messages internes de la bibliothèque sont écrits dans les logs de l'application (createRateLimitLogger).
 *   Ses contrôles de configuration (par exemple un en-tête X-Forwarded-For reçu alors que trust proxy est désactivé,
 *   voir QUAL-06) ne s'exécutent qu'une fois par limiteur, sur la première requête concernée par chaque contrôle.
 *   `log` permet aux tests de lire ces messages.
 *
 * Chaque appel crée un compteur distinct : un même limiteur ne doit pas être partagé entre plusieurs groupes de routes
 * dont les quotas doivent rester séparés.
 */
export function createRateLimiter(settings: RateLimitSettings, log: Logger = defaultLogger): RequestHandler {
    return rateLimit({
        windowMs: settings.windowMs,
        limit: settings.limit,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler: (_req, _res, next) => {
            next(new HttpError(429, 'RATE_LIMITED', 'Too many requests'))
        },
        logger: createRateLimitLogger(log)
    })
}

/** Limiteur global de /api/v1 : 300 requêtes par minute et par adresse IP. */
export const globalRateLimiter: RequestHandler = createRateLimiter(GLOBAL_RATE_LIMIT)

/**
 * Crée un limiteur strict (10 requêtes par 15 minutes) pour un endpoint sensible.
 * Prêt à l'emploi, mais branché sur aucune route : la connexion et l'inscription arrivent avec QUAL-02.
 * Usage prévu : router.post('/login', createStrictRateLimiter(), ...).
 */
export function createStrictRateLimiter(): RequestHandler {
    return createRateLimiter(STRICT_RATE_LIMIT)
}