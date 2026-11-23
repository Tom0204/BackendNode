import type { NextFunction, Request, RequestHandler, Response } from 'express'

/**
 * Adapte un handler asynchrone à Express 4 (DB-04).
 * Express 4 ignore la promesse renvoyée par un handler : sans ce relais, une erreur asynchrone
 * n'atteindrait jamais le middleware d'erreurs et la requête resterait sans réponse.
 * Toute promesse rejetée est transmise à next(), donc au gestionnaire d'erreurs centralisé.
 */
export function asyncHandler(
    handler: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler {
    return (req, res, next) => {
        handler(req, res, next).catch(next)
    }
}
