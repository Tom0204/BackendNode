import type { Request, Response } from 'express'
import { TOKEN_TYPE } from '../config/auth'
import { getAuth } from '../middlewares/auth.middleware'
import type { LoginBody, RegisterBody } from '../schemas/auth.schema'
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
        }),

        // Connexion : 200 avec le jeton et le compte public (AUTH-06, D5 du lot L2).
        // Cache-Control: no-store : une réponse contenant un jeton ne doit être conservée par aucun cache.
        login: asyncHandler(async (req: Request, res: Response) => {
            const body: LoginBody = req.body
            const { token, expiresAt, user } = await service.login(body)
            res.set('Cache-Control', 'no-store')
            res.status(200).json(
                successBody('Login successful', {
                    accessToken: token,
                    tokenType: TOKEN_TYPE,
                    expiresAt: expiresAt.toISOString(),
                    user: toUserResponse(user)
                })
            )
        }),

        // Déconnexion : révoque la session de la requête, 204 sans corps (AUTH-10).
        logout: asyncHandler(async (req: Request, res: Response) => {
            await service.logout(getAuth(req))
            res.status(204).send()
        })
    }
}

export type AuthController = ReturnType<typeof createAuthController>
