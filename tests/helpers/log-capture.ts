import type { Logger } from 'pino'
import { createLogger } from '../../src/config/logger'

/** Une ligne de log JSON, telle qu'écrite par Pino. */
export type LogEntry = Record<string, unknown>

/**
 * Crée un logger JSON qui écrit en mémoire au lieu de la sortie standard.
 * - entries : chaque ligne de log, déjà convertie en objet ;
 * - text() : tous les logs bruts, pour vérifier qu'une valeur n'y apparaît nulle part.
 */
export function createLogCapture(level: 'info' | 'debug' | 'warn' = 'debug'): {
    logger: Logger
    entries: LogEntry[]
    text: () => string
} {
    const rawLines: string[] = []
    const entries: LogEntry[] = []
    const destination = {
        write(line: string): void {
            rawLines.push(line)
            entries.push(JSON.parse(line) as LogEntry)
        }
    }
    return { logger: createLogger({ level, pretty: false }, destination), entries, text: () => rawLines.join('') }
}

/** Niveaux numériques de Pino, pour lire le champ level des logs JSON. */
export const LOG_LEVELS = { debug: 20, info: 30, warn: 40, error: 50, fatal: 60 } as const