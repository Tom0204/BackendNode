import type { Request, Response } from 'express'
import type { RegisterBody } from '../schemas/auth.schema'
import type { AuthService } from '../services/auth.service'
import { asyncHandler } from '../utils/async-handler'
import { successBody } from '../utils/response'
import { toUserResponse } from './user.dto'

// Le corps est validé en amont par validateRequest (voir auth.routes.ts).
// Le service est appelé par `service.méthode(...)` à chaque requête : un test peut espionner ses méthodes.
export function createAuthController(service: AuthService) {
    return {
        // Inscription : 201 avec le compte public ; aucun jeton n'est émis (AUTH-04).
        register: asyncHandler(async (req: Request, res: Response) => {
            const body: RegisterBody = req.body
            const user = await service.register(body)
            res.status(201).json(successBody('User registered successfully', toUserResponse(user)))
        })
    }
}

export type AuthController = ReturnType<typeof createAuthController>
