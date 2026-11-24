import type { Request, Response } from 'express'
import { getAuth } from '../middlewares/auth.middleware'
import { userListQuerySchema, type PatchUserBody } from '../schemas/user.schema'
import type { UserService } from '../services/user.service'
import { asyncHandler } from '../utils/async-handler'
import { successBody } from '../utils/response'
import { toUserResponse } from './user.dto'

// Routes protégées : requireAuth a placé l'utilisateur authentifié dans la requête (getAuth).
// Les paramètres, la requête et le corps sont validés en amont par validateRequest (voir user.routes.ts).
// Les droits sont vérifiés par le service, qui reçoit l'utilisateur authentifié.
export function createUserController(service: UserService) {
    return {
        getPage: asyncHandler(async (req: Request, res: Response) => {
            // validateRequest valide la requête sans la convertir : la conversion (texte → nombre, défauts) est faite ici
            // avec le même schéma, qui ne peut plus échouer.
            const query = userListQuerySchema.parse(req.query)
            const { users, pagination } = await service.getPage(getAuth(req), query)
            res.status(200).json(successBody('Users retrieved successfully', users.map(toUserResponse), { pagination }))
        }),

        getMe: asyncHandler(async (req: Request, res: Response) => {
            const user = await service.getMe(getAuth(req))
            res.status(200).json(successBody('User retrieved successfully', toUserResponse(user)))
        }),

        patchMe: asyncHandler(async (req: Request, res: Response) => {
            const body: PatchUserBody = req.body
            const user = await service.patchMe(getAuth(req), body)
            res.status(200).json(successBody('User updated successfully', toUserResponse(user)))
        }),

        getById: asyncHandler(async (req: Request, res: Response) => {
            const user = await service.getById(getAuth(req), req.params.id)
            res.status(200).json(successBody('User retrieved successfully', toUserResponse(user)))
        }),

        patch: asyncHandler(async (req: Request, res: Response) => {
            const body: PatchUserBody = req.body
            const user = await service.patch(getAuth(req), req.params.id, body)
            res.status(200).json(successBody('User updated successfully', toUserResponse(user)))
        }),

        remove: asyncHandler(async (req: Request, res: Response) => {
            await service.remove(getAuth(req), req.params.id)
            res.status(204).send()
        })
    }
}

export type UserController = ReturnType<typeof createUserController>
