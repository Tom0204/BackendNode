import { env } from './src/config/environment'
import { flushLoggerAndExit, logger } from './src/config/logger'
import { createApp } from './src/app'
import { checkDatabaseConnection, createDatabase } from './src/database/client'
import { describeDatabaseError } from './src/database/errors'
import { createPrismaUserRepository } from './src/repositories/user.repository'
import { createPrismaSessionRepository } from './src/repositories/session.repository'
import { createAuthService } from './src/services/auth.service'
import { createUserService } from './src/services/user.service'
import { createPrismaCharacterClassRepository } from './src/repositories/character-class.repository'
import { createPrismaCharacterRepository } from './src/repositories/character.repository'
import { createCharacterClassService } from './src/services/character-class.service'
import { createCharacterService } from './src/services/character.service'
import { HOUR_MS } from './src/config/auth'
import { createArgon2PasswordHasher } from './src/services/password-hasher'
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

// Production sans CORS_ORIGINS : aucune origine externe n'est autorisée par CORS (FND-08, décision D4).
// Ce n'est pas une erreur, mais probablement un oubli de configuration : on le signale au démarrage.
if (env.NODE_ENV === 'production' && env.CORS_ORIGINS === undefined) {
    logger.warn(
        "CORS_ORIGINS n'est pas définie : aucune origine externe n'est autorisée par CORS. " +
            "Les navigateurs ne pourront pas appeler l'API depuis un autre site ; Postman et curl ne sont pas concernés."
    )
}

// Démarrage : vérification de la base (DB-01), puis ouverture du port (FND-09).
// Fonction async appelée avec .then() plutôt qu'un await au niveau supérieur :
// le build produit un fichier CommonJS (dist/server.cjs), qui n'accepte pas await hors d'une fonction.
async function start(): Promise<void> {
    // environment.ts rend DATABASE_URL obligatoire hors test ; ce contrôle couvre un lancement avec NODE_ENV=test.
    if (env.DATABASE_URL === undefined) {
        logger.fatal('Le serveur ne peut pas démarrer : DATABASE_URL non définie (voir .env.example).')
        flushLoggerAndExit(1)
        return
    }

    const database = createDatabase(env.DATABASE_URL)
    // Erreur d'une connexion inactive du pool : journalisée sans arrêter le serveur.
    // Seul le code est journalisé : le message pourrait contenir des informations sensibles.
    database.pool.on('error', (error) => {
        logger.error({ code: systemErrorCode(error) }, 'Database pool error')
    })

    // La base est vérifiée avant l'ouverture du port : le serveur ne reçoit aucune requête sans base disponible.
    try {
        await checkDatabaseConnection(database.pool)
    } catch (error) {
        // Seuls le code et les lignes calculées sont journalisés, jamais l'objet d'erreur (URL, message).
        const [title, ...details] = describeDatabaseError(error)
        logger.fatal({ code: systemErrorCode(error), details }, title)
        flushLoggerAndExit(1)
        return
    }

    // Assemblage (DB-04, AUTH-04 à AUTH-10, CHAR-01 à CHAR-05) : repositories Prisma et hachage Argon2id → services → application.
    const userRepository = createPrismaUserRepository(database.prisma)
    const authService = createAuthService({
        userRepository,
        sessionRepository: createPrismaSessionRepository(database.prisma),
        passwordHasher: createArgon2PasswordHasher(),
        sessionTtlMs: env.SESSION_TTL_HOURS * HOUR_MS
    })
    const characterClassRepository = createPrismaCharacterClassRepository(database.prisma)
    const app = createApp({
        authService,
        userService: createUserService(userRepository),
        characterClassService: createCharacterClassService(characterClassRepository),
        characterService: createCharacterService({
            characterRepository: createPrismaCharacterRepository(database.prisma),
            characterClassRepository
        })
    })

    try {
        await startServer(app, env.PORT)
    } catch (error) {
        // Erreur de démarrage connue (FND-09) : message clair en fatal, sans trace d'appels,
        // puis écriture des logs et arrêt avec le code 1.
        const [title, ...details] = describeStartupError(error, env.PORT)
        logger.fatal({ port: env.PORT, code: systemErrorCode(error), details }, title)
        flushLoggerAndExit(1)
        return
    }

    logger.info({ port: env.PORT, nodeEnv: env.NODE_ENV }, `Server is running on http://localhost:${env.PORT}`)
}

void start()
