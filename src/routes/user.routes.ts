import { Router, type RequestHandler } from 'express'
import type { UserController } from '../controllers/user.controller'
import { requireRole } from '../middlewares/auth.middleware'
import { validateRequest } from '../middlewares/validation.middleware'
import { patchUserBodySchema, userIdParamsSchema, userListQuerySchema } from '../schemas/user.schema'

/**
 * Routes /users (AUTH-02, AUTH-09), toutes protégées. Pas de POST (l'inscription le remplace) ni de PUT (D7 du lot L2).
 * L'authentification passe avant la validation : sans jeton valide, la réponse est 401 quel que soit le corps.
 */
export function createUserRoutes(controller: UserController, requireAuth: RequestHandler): Router {
    const router = Router()

    router.use(requireAuth)

    router.get('/', requireRole('ADMIN'), validateRequest({ query: userListQuerySchema }), controller.getPage)
    // /me avant /:id ; « me » n'est de toute façon pas un UUID.
    router.get('/me', validateRequest({}), controller.getMe)
    router.patch('/me', validateRequest({ body: patchUserBodySchema }), controller.patchMe)
    router.get('/:id', validateRequest({ params: userIdParamsSchema }), controller.getById)
    router.patch('/:id', validateRequest({ params: userIdParamsSchema, body: patchUserBodySchema }), controller.patch)
    router.delete('/:id', validateRequest({ params: userIdParamsSchema }), controller.remove)

    return router
}
