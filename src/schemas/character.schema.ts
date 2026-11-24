import { z } from 'zod'
import { CHARACTER_NAME_PATTERN } from '../config/gameplay'

/* Schémas des routes /api/v1/characters (CHAR-02 à CHAR-05). Objets stricts : tout champ inconnu est refusé (400),
 * en particulier ceux que seul le serveur fixe : level, experience, currentZoneId, userId, statistiques.
 */

/** Nom : exactement la contrainte SQL characters_name_format_check (3 à 16 lettres ASCII, sans accent, espace ni chiffre). */
export const characterNameSchema = z.string().regex(CHARACTER_NAME_PATTERN, 'Must be 3 to 16 letters (A-Z, a-z)')

/** Corps de POST /characters : le client ne fournit que le nom et la classe (rules.md §3). */
export const createCharacterBodySchema = z.strictObject({
    name: characterNameSchema,
    classId: z.uuid('Must be a valid UUID')
})

/** Paramètres de chemin de /characters/:characterId. */
export const characterIdParamsSchema = z.strictObject({
    characterId: z.uuid('Must be a valid UUID')
})

export type CreateCharacterBody = z.infer<typeof createCharacterBodySchema>
