import { z } from 'zod'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../config/auth'
import { characterCount, emailSchema, nonEmptyString } from './common.schema'

/* Schémas des routes /api/v1/auth (AUTH-04, AUTH-06). Objets stricts : un champ inconnu est rejeté en 400. */

const tooLong = { message: `Must be at most ${PASSWORD_MAX_LENGTH} characters` }

/**
 * Mot de passe d'inscription : 15 à 128 caractères, sans règle de composition ni confirmation (lot L1, D4).
 * La valeur n'est ni rognée ni normalisée : elle est hashée telle quelle. Le maximum limite le coût du hachage.
 */
export const passwordSchema = z
    .string()
    .refine((value) => characterCount(value) >= PASSWORD_MIN_LENGTH, {
        message: `Must be at least ${PASSWORD_MIN_LENGTH} characters`
    })
    .refine((value) => characterCount(value) <= PASSWORD_MAX_LENGTH, tooLong)

/** Corps de POST /api/v1/auth/register. */
export const registerBodySchema = z.strictObject({
    name: nonEmptyString,
    email: emailSchema,
    password: passwordSchema
})

/**
 * Corps de POST /api/v1/auth/login.
 * Le mot de passe n'est pas soumis à la longueur minimale : la règle d'inscription peut évoluer sans bloquer
 * les comptes existants, et un mot de passe trop court échoue de toute façon à la vérification (401 générique).
 * Le maximum reste appliqué pour borner le coût de la vérification Argon2id.
 */
export const loginBodySchema = z.strictObject({
    email: emailSchema,
    password: z
        .string()
        .min(1, 'Must not be empty')
        .refine((value) => characterCount(value) <= PASSWORD_MAX_LENGTH, tooLong)
})

export type RegisterBody = z.infer<typeof registerBodySchema>
export type LoginBody = z.infer<typeof loginBodySchema>
