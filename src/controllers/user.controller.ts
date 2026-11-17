import { Request, Response } from 'express'
import { userService } from '../services/user.service'
import type { CreateUserBody, PatchUserBody, ReplaceUserBody } from '../schemas/user.schema'

// Les paramètres et le corps sont validés en amont par validateRequest (voir user.routes.ts) :
// req.params.id est un entier positif sous forme de chaîne, req.body respecte le schéma de la route.
export const userController = {
    getAll: (req: Request, res: Response) => {
        res.status(200).json(userService.getAll())
    },

    getById: (req: Request, res: Response) => {
        res.status(200).json(userService.getById(Number(req.params.id)))
    },

    create: (req: Request, res: Response) => {
        const body: CreateUserBody = req.body
        res.status(201).json(userService.create(body))
    },

    replace: (req: Request, res: Response) => {
        const body: ReplaceUserBody = req.body
        res.status(200).json(userService.replace(Number(req.params.id), body))
    },

    patch: (req: Request, res: Response) => {
        const body: PatchUserBody = req.body
        res.status(200).json(userService.patch(Number(req.params.id), body))
    },

    remove: (req: Request, res: Response) => {
        userService.remove(Number(req.params.id))
        res.status(204).send()
    }
}