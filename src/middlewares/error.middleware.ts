import type { ErrorRequestHandler, RequestHandler } from 'express'
import { logger } from '../config/logger'
import { HttpError, type ErrorDetail } from '../utils/http-error'

/* Corps d'une réponse d'erreur */
interface ErrorResponseBody {
    success: false
    message: string
    error: {
        code: string
        details: ErrorDetail[]
    }
}

// Erreurs levées par express.json() avant d'atteindre les routes.
// Elles portent une propriété `type` qui identifie la cause.
const BODY_PARSER_ERRORS = new Map<string, { status: number; code: string; message: string }>([
    ['entity.parse.failed', { status: 400, code: 'INVALID_JSON', message: 'Malformed JSON body' }],
    ['entity.too.large', { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Payload too large' }],
    ['encoding.unsupported', { status: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported media type' }],
    ['charset.unsupported', { status: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported media type' }]
])

function fromBodyParserError(err: unknown): HttpError | undefined {
    if (typeof err !== 'object' || err === null || !('type' in err)) {
        return undefined
    }
    const type = err.type
    if (typeof type !== 'string') {
        return undefined
    }
    const known = BODY_PARSER_ERRORS.get(type)
    return known ? new HttpError(known.status, known.code, known.message) : undefined
}

/* Route inconnue : transmet une 404 au gestionnaire d'erreurs. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
    next(new HttpError(404, 'ROUTE_NOT_FOUND', 'Route not found'))
}

/* Gestionnaire d'erreurs centralisé.
 * Express reconnaît un middleware d'erreur à ses QUATRE paramètres
*/
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    if (res.headersSent) {
        // La réponse a déjà commencé : Express interrompt la connexion.
        next(err)
        return
    }

    let httpError = err instanceof HttpError ? err : fromBodyParserError(err)
    if (!httpError) {
        // Erreur inattendue : détail uniquement dans les logs du serveur, jamais dans la réponse.
        // req.log (pino-http) ajoute l'identifiant de la requête ; le logger global sert de secours.
        const log = req.log ?? logger
        log.error({ err }, 'Unexpected error')
        httpError = new HttpError(500, 'INTERNAL_ERROR', 'Internal server error')
    }

    const body: ErrorResponseBody = {
        success: false,
        message: httpError.message,
        error: { code: httpError.code, details: httpError.details }
    }
    res.status(httpError.status).json(body)
}