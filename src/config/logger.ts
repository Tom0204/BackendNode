import { pino, type DestinationStream, type LevelWithSilent, type Logger, type LoggerOptions } from 'pino'
import { env } from './environment'

/**
 * Clés masquées dans tous les logs, quel que soit l'objet journalisé (FND-05, décision D5).
 * « *.cle » couvre la clé un niveau plus bas (par exemple { user: { password } }).
 */
const SENSITIVE_KEYS = ['authorization', 'cookie', 'set-cookie', 'password', 'token', 'accessToken', 'refreshToken', 'secret']

const REDACTED_PATHS = SENSITIVE_KEYS.flatMap((key) => [`["${key}"]`, `*["${key}"]`])

/** Valeur qui remplace une donnée masquée. */
export const REDACTED_VALUE = '[REDACTED]'

/** Délai maximal accordé au logger pour écrire ses derniers messages avant l'arrêt du processus. */
const FLUSH_TIMEOUT_MS = 1000

export interface LoggerSettings {
    level: LevelWithSilent
    /** true : affichage lisible et coloré (pino-pretty) ; false : JSON, une ligne par événement. */
    pretty: boolean
}

/**
 * Crée un logger Pino.
 * `destination` permet aux tests de récupérer les logs en mémoire ; elle n'est utilisée qu'en mode JSON.
 */
export function createLogger(settings: LoggerSettings, destination?: DestinationStream): Logger {
    const options: LoggerOptions = {
        level: settings.level,
        redact: { paths: REDACTED_PATHS, censor: REDACTED_VALUE }
    }

    if (settings.pretty) {
        // pino-pretty s'exécute dans un processus léger séparé (« transport ») : la sortie reste lisible
        // sans ralentir le traitement des requêtes.
        return pino({
            ...options,
            transport: {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' }
            }
        })
    }

    return destination ? pino(options, destination) : pino(options)
}

/** Logger unique de l'application : lisible en développement, JSON en test et en production (décision D2). */
export const logger = createLogger({ level: env.LOG_LEVEL, pretty: env.NODE_ENV === 'development' })

let exiting = false

/**
 * Écrit les derniers messages du logger, puis arrête le processus avec le code donné (décision D6).
 * - En JSON, Pino écrit déjà de façon synchrone ; en développement, pino-pretty tourne à part :
 *   flush() attend que les messages en attente soient transmis.
 * - Un délai de sécurité garantit l'arrêt même si l'écriture ne se termine pas.
 * - Un second appel est ignoré : un seul arrêt, avec le premier code demandé.
 */
export function flushLoggerAndExit(code: number): void {
    if (exiting) {
        return
    }
    exiting = true

    const safetyTimer = setTimeout(() => process.exit(code), FLUSH_TIMEOUT_MS)
    logger.flush(() => {
        clearTimeout(safetyTimer)
        process.exit(code)
    })
}