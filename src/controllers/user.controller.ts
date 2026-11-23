import type { Request, Response } from 'express'
import type { UserService } from '../services/user.service'
import type { CreateUserBody, PatchUserBody, ReplaceUserBody } from '../schemas/user.schema'
import type { User } from '../types/user'
import { asyncHandler } from '../utils/async-handler'
import { successBody } from '../utils/response'

/** Utilisateur tel que renvoyé par l'API : contrat inchangé, les dates restent internes (exposition décidée en AUTH-02). */
export interface UserResponse {
    id: string
    name: string
    email: string
}

export function toUserResponse(user: User): UserResponse {
    return { id: user.id, name: user.name, email: user.email }
}

// Les paramètres et le corps sont validés en amont par validateRequest (voir user.routes.ts) :
// req.params.id est un UUID, req.body respecte le schéma de la route.
// Les réponses de succès suivent l'enveloppe des conventions (section 3), sauf la suppression : 204 sans corps.
// Chaque handler est asynchrone : asyncHandler transmet ses erreurs au gestionnaire centralisé (Express 4).
// Le service est appelé par `service.méthode(...)` à chaque requête : un test peut espionner ses méthodes.
export function createUserController(service: UserService) {
    return {
        getAll: asyncHandler(async (_req: Request, res: Response) => {
            const users = await service.getAll()
            res.status(200).json(successBody('Users retrieved successfully', users.map(toUserResponse)))
        }),

        getById: asyncHandler(async (req: Request, res: Response) => {
            const user = await service.getById(req.params.id)
            res.status(200).json(successBody('User retrieved successfully', toUserResponse(user)))
        }),

        create: asyncHandler(async (req: Request, res: Response) => {
            const body: CreateUserBody = req.body
            const user = await service.create(body)
            res.status(201).json(successBody('User created successfully', toUserResponse(user)))
        }),

        replace: asyncHandler(async (req: Request, res: Response) => {
            const body: ReplaceUserBody = req.body
            const user = await service.replace(req.params.id, body)
            res.status(200).json(successBody('User replaced successfully', toUserResponse(user)))
        }),

        patch: asyncHandler(async (req: Request, res: Response) => {
            const body: PatchUserBody = req.body
            const user = await service.patch(req.params.id, body)
            res.status(200).json(successBody('User updated successfully', toUserResponse(user)))
        }),

        remove: asyncHandler(async (req: Request, res: Response) => {
            await service.remove(req.params.id)
            res.status(204).send()
        })
    }
}

export type UserController = ReturnType<typeof createUserController>
