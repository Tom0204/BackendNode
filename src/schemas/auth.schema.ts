import { z } from 'zod'
import { EMAIL_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../config/auth'

/* Schémas des routes /api/v1/auth (AUTH-04). Objets stricts : un champ inconnu est rejeté en 400. */

// Chaîne qui contient au moins un caractère non blanc ; la valeur n'est pas modifiée (règle reprise de FND-04).
const nonEmptyString = z.string().regex(/\S/, 'Must not be empty')

// Longueur en caractères Unicode : un emoji ou un caractère accentué composé compte pour un seul caractère.
const characterCount = (value: string): number => [...value].length

/**
 * Mot de passe : 15 à 128 caractères, sans règle de composition ni confirmation (décision D4 d'AUTH-01 à 04).
 * La valeur n'est ni rognée ni normalisée : elle est hashée telle quelle. Le maximum limite le coût du hachage.
 */
export const passwordSchema = z
    .string()
    .refine((value) => characterCount(value) >= PASSWORD_MIN_LENGTH, {
        message: `Must be at least ${PASSWORD_MIN_LENGTH} characters`
    })
    .refine((value) => characterCount(value) <= PASSWORD_MAX_LENGTH, {
        message: `Must be at most ${PASSWORD_MAX_LENGTH} characters`
    })

/** Email : format vérifié, 254 caractères au plus. La mise en minuscules est faite par le service. */
export const emailSchema = z
    .string()
    .max(EMAIL_MAX_LENGTH, `Must be at most ${EMAIL_MAX_LENGTH} characters`)
    .pipe(z.email('Must be a valid email'))

/** Corps de POST /api/v1/auth/register. */
export const registerBodySchema = z.strictObject({
    name: nonEmptyString,
    email: emailSchema,
    password: passwordSchema
})

export type RegisterBody = z.infer<typeof registerBodySchema>
