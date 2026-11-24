import { z } from 'zod'
import { emailSchema, nonEmptyString } from './common.schema'

/* Schémas des routes /api/v1/users (AUTH-02, AUTH-09). Objets stricts : tout champ inconnu ou interdit
 * (role, status, id, password…) est rejeté en 400 (précision SET-05).
 */

/** Paramètres de chemin de /users/:id. L'identifiant est un UUID, traité comme une chaîne opaque (conventions §7). */
export const userIdParamsSchema = z.strictObject({
    id: z.uuid('Must be a valid UUID')
})

/**
 * Corps de PATCH /users/:id et /users/me : nom et email seulement, facultatifs mais non vides s'ils sont fournis.
 * Le mot de passe actuel n'est pas demandé (décision du lot L2, limite documentée) ;
 * le changement de mot de passe est hors périmètre.
 */
export const patchUserBodySchema = z.strictObject({
    name: nonEmptyString.optional(),
    email: emailSchema.optional()
})

/** Pagination de la liste (conventions §9) : page ≥ 1 (1 par défaut), pageSize de 1 à 100 (20 par défaut). */
export const PAGE_SIZE_DEFAULT = 20
export const PAGE_SIZE_MAX = 100

// Entier strictement positif écrit en décimal ; un paramètre répété (tableau) est refusé.
const positiveInteger = z
    .string()
    .regex(/^[1-9]\d{0,8}$/, 'Must be a positive integer')
    .transform(Number)

export const userListQuerySchema = z.strictObject({
    page: positiveInteger.optional().transform((page) => page ?? 1),
    pageSize: positiveInteger
        .pipe(z.number().max(PAGE_SIZE_MAX, `Must be at most ${PAGE_SIZE_MAX}`))
        .optional()
        .transform((pageSize) => pageSize ?? PAGE_SIZE_DEFAULT)
})

export type PatchUserBody = z.infer<typeof patchUserBodySchema>
export type UserListQuery = z.infer<typeof userListQuerySchema>
