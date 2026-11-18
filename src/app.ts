import express from 'express'
import routes, { API_V1_PREFIX } from './routes'
import healthRoutes from './routes/health.routes'
import { errorHandler, notFoundHandler } from './middlewares/error.middleware'
import { createRequestLogger } from './middlewares/request-logger.middleware'
import { createCorsMiddleware, createSecurityHeaders, requireJsonContentType } from './middlewares/security.middleware'
import { globalRateLimiter } from './middlewares/rate-limit.middleware'
import { logger } from './config/logger'
import { corsAllowedOrigins, JSON_BODY_LIMIT } from './config/http'

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
app.use(API_V1_PREFIX, routes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app