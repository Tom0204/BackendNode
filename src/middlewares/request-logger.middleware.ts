import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { LevelWithSilent, Logger } from 'pino'
import { pinoHttp } from 'pino-http'

/** En-tête qui transporte l'identifiant de requête (FND-05, décision D4). */
export const REQUEST_ID_HEADER = 'X-Request-Id'

// Identifiant fourni par le client accepté seulement s'il est court et sans caractère risqué.
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/

// Route technique interrogée régulièrement par les outils de surveillance (FND-07).
const HEALTH_PATH = '/health'

/** Reprend l'identifiant reçu s'il est sûr, sinon en génère un nouveau (UUID). */
export function resolveRequestId(incoming: string | string[] | undefined): string {
    return typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID()
}

/**
 * Chemin de la requête, sans les paramètres de requête (précision du propriétaire sur D5) :
 * « /api/v1/users?token=abc » devient « /api/v1/users ».
 * originalUrl (ajouté par Express) est préféré à url, que les routeurs montés raccourcissent.
 */
export function requestPath(req: IncomingMessage): string {
    const url = 'originalUrl' in req && typeof req.originalUrl === 'string' ? req.originalUrl : (req.url ?? '')
    const queryStart = url.indexOf('?')
    return queryStart === -1 ? url : url.slice(0, queryStart)
}

/** Niveau du log de fin de requête selon le statut (D5) ; /health en debug pour éviter le bruit (D7). */
export function requestLogLevel(req: IncomingMessage, res: ServerResponse, error?: Error): LevelWithSilent {
    if (error !== undefined || res.statusCode >= 500) {
        return 'error'
    }
    if (res.statusCode >= 400) {
        return 'warn'
    }
    return requestPath(req) === HEALTH_PATH ? 'debug' : 'info'
}

function requestSummary(req: IncomingMessage, res: ServerResponse): string {
    return `${req.method ?? ''} ${requestPath(req)} ${res.statusCode}`
}

/**
 * Middleware de journalisation des requêtes (pino-http), à monter en premier dans app.ts.
 * - Identifiant de requête repris ou généré, renvoyé dans l'en-tête X-Request-Id et présent dans chaque log (reqId).
 * - Log de fin de requête minimal : méthode, chemin sans paramètres, statut, durée. Ni en-têtes, ni corps.
 * - req.log est un logger enfant qui ajoute reqId à tout log écrit pendant la requête.
 */
export function createRequestLogger(logger: Logger) {
    return pinoHttp({
        logger,
        genReqId: (req, res) => {
            const requestId = resolveRequestId(req.headers['x-request-id'])
            res.setHeader(REQUEST_ID_HEADER, requestId)
            return requestId
        },
        // req.log ne porte que reqId, pas toute la requête.
        quietReqLogger: true,
        customAttributeKeys: { reqId: 'reqId' },
        // Remplace les sérialiseurs par défaut, qui incluraient les en-têtes et l'URL complète.
        wrapSerializers: false,
        serializers: {
            req: (req: IncomingMessage) => ({ method: req.method, path: requestPath(req) }),
            res: (res: ServerResponse) => ({ statusCode: res.statusCode })
        },
        customLogLevel: requestLogLevel,
        customSuccessMessage: requestSummary,
        customErrorMessage: (req, res) => requestSummary(req, res)
    })
}