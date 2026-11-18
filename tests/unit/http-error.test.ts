import { describe, expect, it } from 'vitest'
import {
    HttpError,
    businessRuleViolation,
    conflict,
    forbidden,
    notFound,
    unauthenticated,
    validationError
} from '../../src/utils/http-error'

describe('HttpError', () => {
    it('conserve le statut, le code, le message et les détails', () => {
        const details = [{ field: 'name', message: 'Required' }]
        const error = new HttpError(400, 'VALIDATION_ERROR', 'Validation failed', details)

        expect(error).toBeInstanceOf(Error)
        expect(error.name).toBe('HttpError')
        expect(error.status).toBe(400)
        expect(error.code).toBe('VALIDATION_ERROR')
        expect(error.message).toBe('Validation failed')
        expect(error.details).toEqual(details)
    })

    it('utilise un tableau de détails vide par défaut', () => {
        expect(new HttpError(404, 'NOT_FOUND', 'Resource not found').details).toEqual([])
    })
})

describe("fonctions de création d'erreurs", () => {
    it('validationError : 400 VALIDATION_ERROR avec message et détails par défaut', () => {
        expect(validationError()).toMatchObject({
            status: 400,
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: []
        })
    })

    it('validationError : accepte un message et des détails', () => {
        const details = [{ field: 'email', message: 'Required' }]
        expect(validationError('Invalid user', details)).toMatchObject({
            status: 400,
            code: 'VALIDATION_ERROR',
            message: 'Invalid user',
            details
        })
    })

    it('unauthenticated : 401 UNAUTHENTICATED par défaut', () => {
        expect(unauthenticated()).toMatchObject({
            status: 401,
            code: 'UNAUTHENTICATED',
            message: 'Authentication required'
        })
    })

    it('forbidden : 403 FORBIDDEN par défaut', () => {
        expect(forbidden()).toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'Forbidden' })
    })

    it('notFound : 404 NOT_FOUND par défaut', () => {
        expect(notFound()).toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'Resource not found' })
    })

    it('notFound : accepte un code et un message dédiés', () => {
        expect(notFound('USER_NOT_FOUND', 'User not found')).toMatchObject({
            status: 404,
            code: 'USER_NOT_FOUND',
            message: 'User not found'
        })
    })

    it('conflict : 409, code par défaut ou dédié', () => {
        expect(conflict()).toMatchObject({ status: 409, code: 'CONFLICT', message: 'Conflict' })
        expect(conflict('EMAIL_ALREADY_USED', 'Email already taken')).toMatchObject({
            status: 409,
            code: 'EMAIL_ALREADY_USED',
            message: 'Email already taken'
        })
    })

    it('businessRuleViolation : 422 avec le code métier fourni', () => {
        expect(businessRuleViolation('INSUFFICIENT_MANA', 'Not enough mana')).toMatchObject({
            status: 422,
            code: 'INSUFFICIENT_MANA',
            message: 'Not enough mana',
            details: []
        })
    })

    it('toutes les fonctions renvoient une HttpError', () => {
        const errors = [
            validationError(),
            unauthenticated(),
            forbidden(),
            notFound(),
            conflict(),
            businessRuleViolation('CODE', 'Message')
        ]
        for (const error of errors) {
            expect(error).toBeInstanceOf(HttpError)
        }
    })
})