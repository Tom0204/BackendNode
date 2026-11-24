import { Router } from 'express'
import type { CharacterClassController } from '../controllers/character-class.controller'
import { validateRequest } from '../middlewares/validation.middleware'
import { classIdParamsSchema } from '../schemas/character-class.schema'

/**
 * Routes /classes (CHAR-01) : publiques et en lecture seule. Aucune route d'écriture : les classes ne sont
 * modifiables que par le seed des données de référence.
 */
export function createCharacterClassRoutes(controller: CharacterClassController): Router {
    const router = Router()

    router.get('/', validateRequest({}), controller.getAll)
    router.get('/:classId', validateRequest({ params: classIdParamsSchema }), controller.getById)

    return router
}
