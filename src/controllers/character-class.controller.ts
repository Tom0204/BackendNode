import type { Request, Response } from 'express'
import type { CharacterClassService } from '../services/character-class.service'
import { asyncHandler } from '../utils/async-handler'
import { successBody } from '../utils/response'
import { toCharacterClassResponse } from './character.dto'

// Routes publiques : aucune authentification. Les paramètres sont validés en amont (character-class.routes.ts).
export function createCharacterClassController(service: CharacterClassService) {
    return {
        getAll: asyncHandler(async (_req: Request, res: Response) => {
            const classes = await service.getAll()
            res.status(200).json(successBody('Classes retrieved successfully', classes.map(toCharacterClassResponse)))
        }),

        getById: asyncHandler(async (req: Request, res: Response) => {
            const characterClass = await service.getById(req.params.classId)
            res.status(200).json(successBody('Class retrieved successfully', toCharacterClassResponse(characterClass)))
        })
    }
}

export type CharacterClassController = ReturnType<typeof createCharacterClassController>
