import type { RequestHandler } from 'express'
import { z } from 'zod'
import { validationError, type ErrorDetail } from '../utils/http-error'

type RequestLocation = 'params' | 'query' | 'body'

/**
 * Schémas déclarés par une route.
 * Un emplacement sans schéma ne doit contenir aucune donnée : toute clé y est refusée.
 */
export interface RequestSchemas {
    params?: z.ZodType
    query?: z.ZodType
    body?: z.ZodType
}

const LOCATIONS: readonly RequestLocation[] = ['params', 'query', 'body']

// Utilisé quand une route ne déclare pas de schéma pour un emplacement.
const EMPTY_SCHEMA = z.strictObject({})

const UNKNOWN_KEY_MESSAGES: Record<RequestLocation, string> = {
    params: 'Unknown path parameter',
    query: 'Unknown query parameter',
    body: 'Unknown field'
}

// Convertit les erreurs Zod au format { field, message } (docs/api/conventions.md, section 4).
function toDetails(error: z.ZodError, location: RequestLocation): ErrorDetail[] {
    return error.issues.flatMap((issue) => {
        const path = issue.path.map(String)
        if (issue.code === 'unrecognized_keys') {
            return issue.keys.map((key) => ({
                field: [...path, key].join('.'),
                message: UNKNOWN_KEY_MESSAGES[location]
            }))
        }
        // Une erreur sur l'emplacement entier porte le nom de l'emplacement (ex. "body").
        return [{ field: path.length > 0 ? path.join('.') : location, message: issue.message }]
    })
}

/**
 * Valide params, query et body avant le controller.
 * - En cas d'erreur : 400 VALIDATION_ERROR avec tous les champs en cause ; le controller n'est pas appelé.
 * - En cas de succès : req.body est remplacé par la sortie du schéma.
 *   params et query sont validés mais pas convertis : ils restent des chaînes, comme les type Express.
 */
export function validateRequest(schemas: RequestSchemas): RequestHandler {
    return (req, _res, next) => {
        const details: ErrorDetail[] = []
        let validatedBody: unknown = req.body

        for (const location of LOCATIONS) {
            const schema: z.ZodType = schemas[location] ?? EMPTY_SCHEMA
            const result = schema.safeParse(req[location])
            if (!result.success) {
                details.push(...toDetails(result.error, location))
            } else if (location === 'body') {
                validatedBody = result.data
            }
        }

        if (details.length > 0) {
            next(validationError('Validation failed', details))
            return
        }

        req.body = validatedBody
        next()
    }
}