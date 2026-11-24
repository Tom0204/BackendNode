import { z } from 'zod'
import { EMAIL_MAX_LENGTH } from '../config/auth'

/* Règles de validation partagées par plusieurs routes. */

/** Chaîne qui contient au moins un caractère non blanc ; la valeur n'est pas modifiée (règle reprise de FND-04). */
export const nonEmptyString = z.string().regex(/\S/, 'Must not be empty')

/** Email : format vérifié, 254 caractères au plus. La mise en minuscules est faite par le service. */
export const emailSchema = z
    .string()
    .max(EMAIL_MAX_LENGTH, `Must be at most ${EMAIL_MAX_LENGTH} characters`)
    .pipe(z.email('Must be a valid email'))

/** Longueur en caractères Unicode : un emoji ou un caractère accentué composé compte pour un seul caractère. */
export const characterCount = (value: string): number => [...value].length
