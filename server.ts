import { env } from './src/config/environment'
import { flushLoggerAndExit, logger } from './src/config/logger'
import app from './src/app'
import { describeStartupError, startServer, systemErrorCode } from './src/startup'

// Erreurs imprévues du processus : log fatal, écriture des logs, puis arrêt avec le code 1 (FND-05, décision D6).
process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception')
    flushLoggerAndExit(1)
})
process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection')
    flushLoggerAndExit(1)
})

// .then()/.catch() plutôt qu'un await au niveau supérieur :
// le build produit un fichier CommonJS (dist/server.cjs), qui n'accepte pas await hors d'une fonction.
startServer(app, env.PORT)
    .then(() => {
        logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, `Server is running on http://localhost:${env.PORT}`)
    })
    .catch((error: unknown) => {
        // Erreur de démarrage connue (FND-09) : message clair en fatal, sans trace d'appels,
        // puis écriture des logs et arrêt avec le code 1.
        const [title, ...details] = describeStartupError(error, env.PORT)
        logger.fatal({ port: env.PORT, code: systemErrorCode(error), details }, title)
        flushLoggerAndExit(1)
    })