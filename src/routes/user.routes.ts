import { Router } from 'express'
import type { UserController } from '../controllers/user.controller'
import { validateRequest } from '../middlewares/validation.middleware'
import {
    createUserBodySchema,
    patchUserBodySchema,
    replaceUserBodySchema,
    userIdParamsSchema
} from '../schemas/user.schema'

/** Routes /users, branchées sur le controller reçu (construit par createApp). */
export function createUserRoutes(controller: UserController): Router {
    const router = Router()

    // Chaque route déclare ses schémas. Un emplacement non déclaré doit être vide.
    router.get('/', validateRequest({}), controller.getAll)
    router.get('/:id', validateRequest({ params: userIdParamsSchema }), controller.getById)
    router.post('/', validateRequest({ body: createUserBodySchema }), controller.create)
    router.put('/:id', validateRequest({ params: userIdParamsSchema, body: replaceUserBodySchema }), controller.replace)
    router.patch('/:id', validateRequest({ params: userIdParamsSchema, body: patchUserBodySchema }), controller.patch)
    router.delete('/:id', validateRequest({ params: userIdParamsSchema }), controller.remove)

    return router
}
