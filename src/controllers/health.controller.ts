import type { Request, Response } from 'express'
import { successBody } from '../utils/response'

// Valeur d'énumération en UPPER_SNAKE_CASE (conventions, section 8).
const HEALTH_STATUS_OK = 'OK'

export const healthController = {
    // Réponse minimale : aucune information sur la version, l'environnement ou le système.
    // no-store : aucun cache (navigateur, proxy) ne doit conserver un état de santé ancien.
    check: (_req: Request, res: Response) => {
        res.set('Cache-Control', 'no-store')
        res.status(200).json(successBody('Service is healthy', { status: HEALTH_STATUS_OK }))
    }
}