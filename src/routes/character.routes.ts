import { Router, type RequestHandler } from 'express'
import type { CharacterController } from '../controllers/character.controller'
import { validateRequest } from '../middlewares/validation.middleware'
import { characterIdParamsSchema, createCharacterBodySchema } from '../schemas/character.schema'

/**
 * Routes /characters (CHAR-03 à CHAR-05, STAT-02), toutes protégées. Renommage et suppression : CHAR-06 et CHAR-07.
 * Aucune route n'écrit le niveau ni l'expérience : seul le serveur les modifie (STAT-04, fonction interne).
 * L'authentification passe avant la validation : sans jeton valide, la réponse est 401 quel que soit le corps.
 */
export function createCharacterRoutes(controller: CharacterController, requireAuth: RequestHandler): Router {
    const router = Router()

    router.use(requireAuth)

    router.post('/', validateRequest({ body: createCharacterBodySchema }), controller.create)
    router.get('/', validateRequest({}), controller.listMine)
    router.get('/:characterId', validateRequest({ params: characterIdParamsSchema }), controller.getById)
    router.get('/:characterId/stats', validateRequest({ params: characterIdParamsSchema }), controller.getStats)

    return router
}
