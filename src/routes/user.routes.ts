import { Router } from 'express'
import { userController } from '../controllers/user.controller'
import { validateRequest } from '../middlewares/validation.middleware'
import {
    createUserBodySchema,
    patchUserBodySchema,
    replaceUserBodySchema,
    userIdParamsSchema
} from '../schemas/user.schema'

const router = Router()

// Chaque route déclare ses schémas. Un emplacement non déclaré doit être vide.
router.get('/', validateRequest({}), userController.getAll)
router.get('/:id', validateRequest({ params: userIdParamsSchema }), userController.getById)
router.post('/', validateRequest({ body: createUserBodySchema }), userController.create)
router.put('/:id', validateRequest({ params: userIdParamsSchema, body: replaceUserBodySchema }), userController.replace)
router.patch('/:id', validateRequest({ params: userIdParamsSchema, body: patchUserBodySchema }), userController.patch)
router.delete('/:id', validateRequest({ params: userIdParamsSchema }), userController.remove)

export default router