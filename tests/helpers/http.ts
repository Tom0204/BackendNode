import { expect } from 'vitest'
import type { ErrorDetail } from '../../src/utils/http-error'

/** Partie d'une réponse HTTP utile aux vérifications (compatible avec les réponses de supertest). */
interface HttpResponseLike {
    status: number
    headers: Record<string, unknown>
    body: unknown
}

/**
 * Vérifie qu'une réponse respecte le format d'erreur des conventions (section 4) :
 * statut attendu, JSON, enveloppe { success: false, message, error: { code, details } }, sans champ data.
 * Si `details` est fourni, il doit correspondre exactement ; sinon, seul le fait que ce soit un tableau est vérifié.
 */
export function expectErrorResponse(
    response: HttpResponseLike,
    status: number,
    code: string,
    details?: ErrorDetail[]
): void {
    expect(response.status).toBe(status)
    expect(response.headers['content-type']).toMatch(/^application\/json/)
    expect(response.body).toEqual({
        success: false,
        message: expect.any(String),
        error: { code, details: details ?? expect.any(Array) }
    })
}