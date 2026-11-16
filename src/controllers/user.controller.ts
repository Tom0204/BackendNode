import {Request, Response} from 'express'
import {userService} from '../services/user.service'

export const userController = {
    getAll: (req: Request, res: Response) => {
        res.status(200).json(userService.getAll())
    },

    getById: (req: Request, res: Response) => {
        res.status(200).json(userService.getById(Number(req.params.id)))
    },

    create: (req: Request, res: Response) => {
        res.status(201).json(userService.create(req.body))
    },

    replace: (req: Request, res: Response) => {
        res.status(200).json(userService.replace(Number(req.params.id), req.body))
    },

    patch: (req: Request, res: Response) => {
        res.status(200).json(userService.patch(Number(req.params.id), req.body))
    },

    remove: (req: Request, res: Response) => {
        userService.remove(Number(req.params.id))
        res.status(204).send()
    }
}