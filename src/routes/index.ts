import { Router } from 'express'
import userRoutes from './user.routes'

/** Préfixe de la version 1 de l'API : toutes les routes métier sont montées sous ce chemin (conventions, section 1). */
export const API_V1_PREFIX = '/api/v1'

/** Routeur de la version 1 : chaque ressource y est montée par son chemin relatif au préfixe. */
const router = Router()

router.use('/users', userRoutes)

export default router