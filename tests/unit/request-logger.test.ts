import type { IncomingMessage, ServerResponse } from 'node:http'
import { describe, expect, it } from 'vitest'
import { requestLogLevel, requestPath, resolveRequestId } from '../../src/middlewares/request-logger.middleware'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// Requête et réponse simulées : seules les propriétés lues par les fonctions testées.
function fakeRequest(url: string, originalUrl?: string): IncomingMessage {
    return { url, ...(originalUrl === undefined ? {} : { originalUrl }) } as unknown as IncomingMessage
}
function fakeResponse(statusCode: number): ServerResponse {
    return { statusCode } as unknown as ServerResponse
}

describe('resolveRequestId', () => {
    it('reprend un identifiant sûr fourni par le client', () => {
        expect(resolveRequestId('abc-123_DEF.4')).toBe('abc-123_DEF.4')
    })

    it.each([
        { label: 'absent', value: undefined },
        { label: 'vide', value: '' },
        { label: 'avec des espaces', value: 'id invalide' },
        { label: 'avec un retour à la ligne', value: 'abc\ninjection' },
        { label: 'trop long (129 caractères)', value: 'a'.repeat(129) },
        { label: 'en plusieurs exemplaires', value: ['a', 'b'] }
    ])('génère un UUID quand l’identifiant reçu est $label', ({ value }) => {
        expect(resolveRequestId(value)).toMatch(UUID_PATTERN)
    })

    it('accepte exactement 128 caractères', () => {
        const id = 'a'.repeat(128)
        expect(resolveRequestId(id)).toBe(id)
    })
})

describe('requestPath', () => {
    it('retire les paramètres de requête', () => {
        expect(requestPath(fakeRequest('/api/v1/users?token=secret&page=2'))).toBe('/api/v1/users')
    })

    it("préfère originalUrl (Express) à url, raccourcie par les routeurs montés", () => {
        expect(requestPath(fakeRequest('/1?token=secret', '/api/v1/users/1?token=secret'))).toBe('/api/v1/users/1')
    })

    it('garde le chemin tel quel sans paramètres', () => {
        expect(requestPath(fakeRequest('/health'))).toBe('/health')
    })
})

describe('requestLogLevel', () => {
    it.each([
        { status: 200, path: '/api/v1/users', level: 'info' },
        { status: 201, path: '/api/v1/users', level: 'info' },
        { status: 204, path: '/api/v1/users/1', level: 'info' },
        { status: 400, path: '/api/v1/users', level: 'warn' },
        { status: 404, path: '/inconnue', level: 'warn' },
        { status: 500, path: '/api/v1/users', level: 'error' },
        { status: 200, path: '/health', level: 'debug' },
        { status: 404, path: '/health', level: 'warn' }
    ])('statut $status sur $path : $level', ({ status, path, level }) => {
        expect(requestLogLevel(fakeRequest(path), fakeResponse(status))).toBe(level)
    })

    it('error quand une erreur est signalée, quel que soit le statut', () => {
        expect(requestLogLevel(fakeRequest('/api/v1/users'), fakeResponse(200), new Error('boom'))).toBe('error')
    })
})