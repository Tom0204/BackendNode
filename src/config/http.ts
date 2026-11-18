import { env, type Env } from './environment'

/* Réglages des protections HTTP (FND-08).
 * Valeurs fixes pour l'instant : QUAL-02 les rendra configurables par environnement.
 */

/** Taille maximale d'un corps JSON (D1). Au-delà : 413 PAYLOAD_TOO_LARGE. */
export const JSON_BODY_LIMIT = '10kb'

/** Réglage d'un limiteur de requêtes : `limit` requêtes au plus par fenêtre de `windowMs` millisecondes, par adresse IP. */
export interface RateLimitSettings {
    windowMs: number
    limit: number
}

const ONE_MINUTE_MS = 60 * 1000

/** Limite globale de /api/v1 (D5) : 300 requêtes par minute et par adresse IP. */
export const GLOBAL_RATE_LIMIT: RateLimitSettings = { windowMs: ONE_MINUTE_MS, limit: 300 }

/** Limite stricte prête pour les endpoints sensibles (connexion, inscription) : 10 requêtes par 15 minutes. Branchée par QUAL-02. */
export const STRICT_RATE_LIMIT: RateLimitSettings = { windowMs: 15 * ONE_MINUTE_MS, limit: 10 }

/**
 * En-têtes de réponse qu'un navigateur sur une autre origine a le droit de lire.
 * Sans cette liste, le JavaScript du Front-End ne verrait ni l'identifiant de requête (FND-05),
 * ni le délai d'attente après une réponse 429.
 */
export const CORS_EXPOSED_HEADERS = ['X-Request-Id', 'Retry-After', 'RateLimit', 'RateLimit-Policy']

/** Origines autorisées par CORS : '*' pour toutes, sinon la liste exacte (éventuellement vide : aucune). */
export type CorsAllowedOrigins = '*' | readonly string[]

/** Variables d'environnement utiles au calcul de la politique CORS. */
export interface CorsSettings {
    NODE_ENV: Env['NODE_ENV']
    CORS_ORIGINS?: readonly string[] | undefined
}

/**
 * Politique CORS selon la configuration (D4) :
 * - CORS_ORIGINS définie : seulement ces origines, quel que soit l'environnement ;
 * - non définie en production : aucune origine (critère d'acceptation : jamais toutes par défaut) ;
 * - non définie en development ou test : toutes, pour ne pas gêner le développement local.
 */
export function resolveCorsAllowedOrigins(settings: CorsSettings): CorsAllowedOrigins {
    if (settings.CORS_ORIGINS !== undefined) {
        return settings.CORS_ORIGINS
    }
    return settings.NODE_ENV === 'production' ? [] : '*'
}

/** Politique CORS de l'application, calculée une fois au démarrage. */
export const corsAllowedOrigins: CorsAllowedOrigins = resolveCorsAllowedOrigins(env)