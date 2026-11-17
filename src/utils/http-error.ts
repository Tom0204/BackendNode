/* Détail d'une erreur de validation */
export interface ErrorDetail {
    field: string
    message: string
}

/* Erreur applicative transmise au gestionnaire d'erreurs.
 * - status : statut HTTP
 * - code : code stable en UPPER_SNAKE_CASE, c'est le contrat avec le client
 * - message : message public en anglais, sans détail interne
 * - details : champs en cause pour une erreur de validation, tableau vide sinon
 */
export class HttpError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string,
        public readonly details: ErrorDetail[] = []
    ) {
        super(message)
        this.name = 'HttpError'
    }
}

/* 400 : données invalides. */
export const validationError = (message = 'Validation failed', details: ErrorDetail[] = []) =>
    new HttpError(400, 'VALIDATION_ERROR', message, details)

/* 401 : authentification absente, invalide ou expirée. */
export const unauthenticated = (code = 'UNAUTHENTICATED', message = 'Authentication required') =>
    new HttpError(401, code, message)

/* 403 : refus lié au rôle. */
export const forbidden = (code = 'FORBIDDEN', message = 'Forbidden') =>
    new HttpError(403, code, message)

/* 404 : ressource introuvable ou inaccessible (même réponse dans les deux cas). */
export const notFound = (code = 'NOT_FOUND', message = 'Resource not found') =>
    new HttpError(404, code, message)

/* 409 : unicité, limite de capacité atteinte, ressource déjà engagée, action déjà effectuée. */
export const conflict = (code = 'CONFLICT', message = 'Conflict') =>
    new HttpError(409, code, message)

/* 422 : condition de jeu non remplie, ou ressource du corps introuvable. Le code métier est obligatoire. */
export const businessRuleViolation = (code: string, message: string) =>
    new HttpError(422, code, message)