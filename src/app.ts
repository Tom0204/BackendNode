import express from 'express'
import cors from 'cors'
import routes, { API_V1_PREFIX } from './routes'
import healthRoutes from './routes/health.routes'
import { errorHandler, notFoundHandler } from './middlewares/error.middleware'
import { createRequestLogger } from './middlewares/request-logger.middleware'
import { logger } from './config/logger'

const app = express()

// En premier : chaque requête reçoit son identifiant et est journalisée, même si elle est rejetée ensuite.
app.use(createRequestLogger(logger))
app.use(cors())
app.use(express.json())

// Route technique, hors du préfixe de version (conventions, section 1).
app.use('/health', healthRoutes)

// Routes métier, toutes sous /api/v1.
app.use(API_V1_PREFIX, routes)

// Ces deux middlewares doivent rester en dernier, dans cet ordre :
// 404 pour toute route non trouvée, puis formatage centralisé de toutes les erreurs.
app.use(notFoundHandler)
app.use(errorHandler)

export default app