import { z } from 'zod'

// Chaîne contenant au moins un caractère autre qu'un espace.
// Même règle qu'avant FND-04 : la valeur n'est pas modifiée (ni rognée ni normalisée).
const nonEmptyString = z.string().regex(/\S/, 'Must not be empty')

/* Paramètres de chemin des routes /users/:id. L'identifiant reste une chaîne (conventions, section 7). */
export const userIdParamsSchema = z.strictObject({
    id: z.string().regex(/^[1-9]\d*$/, 'Must be a positive integer')
})

/* Corps de POST /users. */
export const createUserBodySchema = z.strictObject({
    name: nonEmptyString,
    email: nonEmptyString
})

/* Corps de PUT /users/:id : remplacement complet, mêmes règles que la création. */
export const replaceUserBodySchema = createUserBodySchema

/* Corps de PATCH /users/:id : champs facultatifs, mais non vides s'ils sont fournis. */
export const patchUserBodySchema = z.strictObject({
    name: nonEmptyString.optional(),
    email: nonEmptyString.optional()
})

export type CreateUserBody = z.infer<typeof createUserBodySchema>
export type ReplaceUserBody = z.infer<typeof replaceUserBodySchema>
export type PatchUserBody = z.infer<typeof patchUserBodySchema>