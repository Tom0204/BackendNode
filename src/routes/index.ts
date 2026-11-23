import { Router } from 'express'

/** Préfixe de la version 1 de l'API : toutes les routes métier sont montées sous ce chemin (conventions, section 1). */
export const API_V1_PREFIX = '/api/v1'

/** Routeurs des ressources de la version 1, construits par createApp. */
export interface ApiV1Routers {
    users: Router
}

/** Routeur de la version 1 : chaque ressource y est montée par son chemin relatif au préfixe. */
export function createApiV1Router(routers: ApiV1Routers): Router {
    const router = Router()
    router.use('/users', routers.users)
    return router
}
