/**
 * Corps d'une réponse de succès (docs/api/conventions.md, section 3).
 * - success : toujours true
 * - message : message informatif en anglais, jamais interprété par le client
 * - data : contenu de la réponse, objet ou tableau
 * - meta : métadonnées facultatives (pagination, par exemple), présentes seulement si l'endpoint les déclare
 */
export interface SuccessResponseBody<T extends object> {
    success: true
    message: string
    data: T
    meta?: Record<string, unknown>
}

/**
 * Construit le corps d'une réponse de succès.
 * Fonction pure : elle ne dépend pas d'Express et ne modifie pas les données reçues.
 * Le champ meta n'est ajouté que s'il est fourni.
 * Une suppression (204) n'utilise pas cette fonction : sa réponse n'a pas de corps (conventions, section 3.3).
 */
export function successBody<T extends object>(
    message: string,
    data: T,
    meta?: Record<string, unknown>
): SuccessResponseBody<T> {
    if (meta === undefined) {
        return { success: true, message, data }
    }
    return { success: true, message, data, meta }
}