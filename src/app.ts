import express, { type Express } from 'express'
import { API_V1_PREFIX, createApiV1Router } from './routes'
import healthRoutes from './routes/health.routes'
import { createAuthRoutes } from './routes/auth.routes'
import { createAuthController } from './controllers/auth.controller'
import type { AuthService } from './services/auth.service'
import { errorHandler, notFoundHandler } from './middlewares/error.middleware'
import { createRequestLogger } from './middlewares/request-logger.middleware'
import { createCorsMiddleware, createSecurityHeaders, requireJsonContentType } from './middlewares/security.middleware'
import { globalRateLimiter } from './middlewares/rate-limit.middleware'
import { logger } from './config/logger'
import { corsAllowedOrigins, JSON_BODY_LIMIT } from './config/http'

/**
 * Services dont dépend l'application (DB-04).
 * server.ts les construit avec les repositories Prisma ; les tests peuvent les construire
 * avec un repository contrôlé, sans base de données.
 */
export interface AppDependencies {
    authService: AuthService
}

/** Construit l'application Express. Aucune connexion n'est ouverte ici. */
export function createApp({ authService }: AppDependencies): Express {
    const app = express()

    // L'ordre compte (FND-08) :
    // 1. Log de requête en premier : toute réponse, y compris 413, 415 et 429, est journalisée avec son identifiant.
    app.use(createRequestLogger(logger))
    // 2. En-têtes de sécurité sur toutes les réponses.
    app.use(createSecurityHeaders())
    // 3. CORS avant le rate limiting : les préflights OPTIONS reçoivent leur réponse ici, sans consommer le quota,
    //    et une réponse 429 reste lisible par un navigateur autorisé.
    app.use(createCorsMiddleware(corsAllowedOrigins))
    // 4. Rate limiting de /api/v1 avant la lecture du corps : une rafale est arrêtée sans lire ni analyser les corps,
    //    et les requêtes rejetées en 413, 415 ou 400 comptent dans le quota. /health n'est pas limité.
    app.use(API_V1_PREFIX, globalRateLimiter)
    // 5. Corps de requête : JSON uniquement, 10 Ko au plus.
    app.use(requireJsonContentType)
    app.use(express.json({ limit: JSON_BODY_LIMIT }))

    app.use('/health', healthRoutes)
    app.use(API_V1_PREFIX, createApiV1Router({ auth: createAuthRoutes(createAuthController(authService)) }))

    app.use(notFoundHandler)
    app.use(errorHandler)

    return app
}
