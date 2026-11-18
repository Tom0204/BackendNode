import type { Request, Response } from 'express'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { validateRequest, type RequestSchemas } from '../../src/middlewares/validation.middleware'
import { createUserBodySchema, userIdParamsSchema } from '../../src/schemas/user.schema'

interface FakeRequestParts {
    params?: Record<string, string>
    query?: Record<string, unknown>
    body?: unknown
}

/**
 * Exécute le middleware sur une requête simulée.
 * Renvoie la requête (pour vérifier son corps) et la fonction next espionnée.
 * Si next est appelée avec une erreur, le controller suivant n'est jamais exécuté.
 */
function runValidation(schemas: RequestSchemas, parts: FakeRequestParts = {}) {
    const req = { params: {}, query: {}, body: {}, ...parts } as unknown as Request
    const next = vi.fn<(error?: unknown) => void>()
    validateRequest(schemas)(req, {} as Response, next)
    return { req, next, error: next.mock.calls[0]?.[0] }
}

describe('validateRequest', () => {
    it('appelle next() sans erreur et remplace le corps par la sortie du schéma', () => {
        const schemas: RequestSchemas = { body: z.strictObject({ count: z.coerce.number() }) }
        const { req, next } = runValidation(schemas, { body: { count: '3' } })

        expect(next).toHaveBeenCalledTimes(1)
        expect(next).toHaveBeenCalledWith()
        expect(req.body).toEqual({ count: 3 })
    })

    it('valide les paramètres de chemin sans les convertir', () => {
        const { req, next } = runValidation({ params: userIdParamsSchema }, { params: { id: '1' } })

        expect(next).toHaveBeenCalledWith()
        expect(req.params.id).toBe('1')
    })

    it('signale chaque champ manquant, sans remplacer le corps', () => {
        const body = {}
        const { req, next, error } = runValidation({ body: createUserBodySchema }, { body })

        expect(next).toHaveBeenCalledTimes(1)
        expect(error).toMatchObject({
            status: 400,
            code: 'VALIDATION_ERROR',
            details: [
                { field: 'name', message: expect.any(String) },
                { field: 'email', message: expect.any(String) }
            ]
        })
        expect(req.body).toBe(body)
    })

    it('refuse un champ inconnu dans le corps', () => {
        const { error } = runValidation(
            { body: createUserBodySchema },
            { body: { name: 'Al', email: 'al@example.com', level: 50 } }
        )
        expect(error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: [{ field: 'level', message: 'Unknown field' }]
        })
    })

    it("refuse un paramètre de requête quand la route n'en déclare aucun", () => {
        const { error } = runValidation({}, { query: { foo: '1' } })
        expect(error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: [{ field: 'foo', message: 'Unknown query parameter' }]
        })
    })

    it('refuse un identifiant non numérique (non-régression de FND-04)', () => {
        const { error } = runValidation({ params: userIdParamsSchema }, { params: { id: 'abc' } })
        expect(error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: [{ field: 'id', message: 'Must be a positive integer' }]
        })
    })

    it("nomme l'emplacement quand l'erreur porte sur le corps entier", () => {
        const { error } = runValidation({ body: createUserBodySchema }, { body: [] })
        expect(error).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: [{ field: 'body', message: expect.any(String) }]
        })
    })

    it("donne le chemin complet d'un champ imbriqué invalide", () => {
        const schemas: RequestSchemas = {
            body: z.strictObject({ items: z.array(z.strictObject({ quantity: z.number() })) })
        }
        const { error } = runValidation(schemas, { body: { items: [{ quantity: 'x' }] } })
        expect(error).toMatchObject({
            details: [{ field: 'items.0.quantity', message: expect.any(String) }]
        })
    })

    it("donne le chemin complet d'un champ imbriqué inconnu", () => {
        const schemas: RequestSchemas = {
            body: z.strictObject({ items: z.array(z.strictObject({ quantity: z.number() })) })
        }
        const { error } = runValidation(schemas, { body: { items: [{ quantity: 1, extra: true }] } })
        expect(error).toMatchObject({
            details: [{ field: 'items.0.extra', message: 'Unknown field' }]
        })
    })

    it('regroupe les erreurs de tous les emplacements dans un seul appel à next', () => {
        const { next, error } = runValidation(
            { params: userIdParamsSchema, body: createUserBodySchema },
            { params: { id: 'abc' }, query: { foo: '1' }, body: {} }
        )

        expect(next).toHaveBeenCalledTimes(1)
        expect(error).toMatchObject({
            details: [{ field: 'id' }, { field: 'foo' }, { field: 'name' }, { field: 'email' }]
        })
    })

    it('laisse passer une requête vide quand la route ne déclare aucun schéma', () => {
        const { next } = runValidation({})
        expect(next).toHaveBeenCalledWith()
    })
})