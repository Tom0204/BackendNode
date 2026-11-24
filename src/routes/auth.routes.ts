import { Router, type RequestHandler } from 'express'
import type { AuthController } from '../controllers/auth.controller'
import { createStrictRateLimiter } from '../middlewares/rate-limit.middleware'
import { validateRequest } from '../middlewares/validation.middleware'
import { loginBodySchema, registerBodySchema } from '../schemas/auth.schema'

/**
 * Routes /auth, branchées sur le controller reçu (construit par createApp).
 * - register et login : publiques ;
 * - logout : protégée par requireAuth.
 */
export function createAuthRoutes(controller: AuthController, requireAuth: RequestHandler): Router {
    const router = Router()

    router.post('/register', validateRequest({ body: registerBodySchema }), controller.register)
    // Limite stricte des tentatives de connexion (AUTH-06, D6 du lot L2) : 10 requêtes par 15 minutes et par adresse IP,
    // comptées avant la validation et la vérification du mot de passe. Un limiteur par application.
    router.post('/login', createStrictRateLimiter(), validateRequest({ body: loginBodySchema }), controller.login)
    router.post('/logout', requireAuth, validateRequest({}), controller.logout)

    return router
}
