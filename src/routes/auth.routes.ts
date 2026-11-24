import { Router } from 'express'
import type { AuthController } from '../controllers/auth.controller'
import { validateRequest } from '../middlewares/validation.middleware'
import { registerBodySchema } from '../schemas/auth.schema'

/** Routes /auth, branchées sur le controller reçu (construit par createApp). */
export function createAuthRoutes(controller: AuthController): Router {
    const router = Router()

    // Route publique : seule route de gestion des comptes accessible sans authentification.
    router.post('/register', validateRequest({ body: registerBodySchema }), controller.register)

    return router
}
