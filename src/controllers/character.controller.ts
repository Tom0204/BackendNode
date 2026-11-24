import type { Request, Response } from 'express'
import { getAuth } from '../middlewares/auth.middleware'
import type { CreateCharacterBody } from '../schemas/character.schema'
import type { CharacterService } from '../services/character.service'
import { asyncHandler } from '../utils/async-handler'
import { successBody } from '../utils/response'
import { toCharacterResponse, toCharacterStatsResponse } from './character.dto'

// Routes protégées : le propriétaire est l'utilisateur authentifié (getAuth), jamais une donnée de la requête.
// Les paramètres et le corps sont validés en amont (character.routes.ts) ; les droits sont vérifiés par le service.
export function createCharacterController(service: CharacterService) {
    return {
        create: asyncHandler(async (req: Request, res: Response) => {
            const body: CreateCharacterBody = req.body
            const character = await service.create(getAuth(req), body)
            res.status(201).json(successBody('Character created successfully', toCharacterResponse(character)))
        }),

        listMine: asyncHandler(async (req: Request, res: Response) => {
            const characters = await service.listMine(getAuth(req))
            res.status(200).json(successBody('Characters retrieved successfully', characters.map(toCharacterResponse)))
        }),

        getById: asyncHandler(async (req: Request, res: Response) => {
            const character = await service.getById(getAuth(req), req.params.characterId)
            res.status(200).json(successBody('Character retrieved successfully', toCharacterResponse(character)))
        }),

        getStats: asyncHandler(async (req: Request, res: Response) => {
            const characterStats = await service.getStats(getAuth(req), req.params.characterId)
            res.status(200).json(successBody('Character stats retrieved successfully', toCharacterStatsResponse(characterStats)))
        })
    }
}

export type CharacterController = ReturnType<typeof createCharacterController>
