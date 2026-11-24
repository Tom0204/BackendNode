import { Prisma } from '../generated/prisma/client'

/* Erreurs des repositories (DB-04).
 * Les repositories traduisent les erreurs Prisma en erreurs métier : les services ne dépendent ni de Prisma
 * ni de ses codes. Les erreurs sont reconnues par leur propriété `kind` (et non par instanceof), ce qui
 * reste fiable avec des repositories de test et des modules rechargés.
 */

/** Une valeur unique existe déjà (email, nom de personnage…). */
export class UniqueConstraintError extends Error {
    readonly kind = 'UNIQUE_CONSTRAINT'

    constructor(public readonly field: string) {
        super(`Unique constraint violated on ${field}`)
        this.name = 'UniqueConstraintError'
    }
}

/** Une donnée référencée (utilisateur, classe, zone…) n'existe pas. */
export class ReferenceNotFoundError extends Error {
    readonly kind = 'REFERENCE_NOT_FOUND'

    constructor(public readonly reference: string) {
        super(`Referenced ${reference} not found`)
        this.name = 'ReferenceNotFoundError'
    }
}

/** Une limite de capacité est atteinte (nombre maximal de personnages par compte…). */
export class LimitReachedError extends Error {
    readonly kind = 'LIMIT_REACHED'

    constructor(public readonly resource: string, public readonly limit: number) {
        super(`Limit of ${limit} ${resource} reached`)
        this.name = 'LimitReachedError'
    }
}

function hasKind(error: unknown, kind: string): boolean {
    return typeof error === 'object' && error !== null && 'kind' in error && error.kind === kind
}

export function isUniqueConstraintError(error: unknown): error is UniqueConstraintError {
    return hasKind(error, 'UNIQUE_CONSTRAINT')
}

export function isReferenceNotFoundError(error: unknown): error is ReferenceNotFoundError {
    return hasKind(error, 'REFERENCE_NOT_FOUND')
}

export function isLimitReachedError(error: unknown): error is LimitReachedError {
    return hasKind(error, 'LIMIT_REACHED')
}

// Codes d'erreur de Prisma utilisés par les repositories.
/** Violation d'unicité. */
export const PRISMA_UNIQUE_VIOLATION = 'P2002'
/** Clé étrangère invalide. */
export const PRISMA_FOREIGN_KEY_VIOLATION = 'P2003'
/** Enregistrement à modifier, à supprimer ou à relier introuvable. */
export const PRISMA_RECORD_NOT_FOUND = 'P2025'

/** Vrai si l'erreur est une erreur Prisma connue portant ce code. Réservé aux repositories. */
export function isPrismaError(error: unknown, code: string): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
}
