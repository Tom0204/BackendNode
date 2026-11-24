import { z } from 'zod'

/* Schémas des routes /api/v1/classes (CHAR-01). */

/** Paramètres de chemin de /classes/:classId. */
export const classIdParamsSchema = z.strictObject({
    classId: z.uuid('Must be a valid UUID')
})
