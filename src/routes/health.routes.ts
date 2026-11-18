import { Router } from 'express'
import { healthController } from '../controllers/health.controller'

const router = Router()

// Route technique, montée hors du préfixe /api/v1 (conventions, section 1).
// Pas de validateRequest : la route ne lit aucun paramètre et doit répondre tant que le service tourne,
// même si un outil de surveillance ajoute un paramètre de requête (décision D4 de FND-07).
// Express répond aussi automatiquement aux requêtes HEAD sur cette route GET.
router.get('/', healthController.check)

export default router