import express from 'express'
import type { Express } from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveCorsAllowedOrigins, type CorsAllowedOrigins } from '../../src/config/http'
import { errorHandler, notFoundHandler } from '../../src/middlewares/error.middleware'
import { createCorsMiddleware } from '../../src/middlewares/security.middleware'
import { loadFreshApp } from '../helpers/fresh-modules'
import { expectErrorResponse, expectSuccessResponse } from '../helpers/http'

// Chemin écrit en clair : les tests décrivent le contrat public de l'API.
const USERS = '/api/v1/users'
const ALLOWED_ORIGIN = 'https://jeu.example.com'
const OTHER_ORIGIN = 'https://autre.example.com'

let app: Express
// Utilisateur existant, pour les requêtes qui en ciblent un (DELETE).
let existingUserId: string

beforeEach(async () => {
    const fresh = await loadFreshApp({ users: [{ name: 'Alice', email: 'alice@example.com' }] })
    app = fresh.app
    existingUserId = fresh.users[0]?.id ?? ''
})

describe('en-têtes de sécurité (helmet)', () => {
    it.each([
        { label: 'GET /health (succès)', path: '/health' },
        { label: 'route inconnue (erreur)', path: '/inconnue' }
    ])('$label : en-têtes de sécurité présents, X-Powered-By absent', async ({ path }) => {
        const response = await request(app).get(path)

        expect(response.headers['x-content-type-options']).toBe('nosniff')
        expect(response.headers['x-frame-options']).toBe('SAMEORIGIN')
        expect(response.headers['referrer-policy']).toBe('no-referrer')
        expect(response.headers['strict-transport-security']).toMatch(/^max-age=\d+/)
        expect(response.headers['content-security-policy']).toContain("default-src 'self'")
        expect(response.headers['x-powered-by']).toBeUndefined()
    })

    it("/health garde son Cache-Control: no-store et sa réponse JSON (non-régression FND-07)", async () => {
        const response = await request(app).get('/health')

        expectSuccessResponse(response, 200, 'Service is healthy', { status: 'OK' })
        expect(response.headers['cache-control']).toBe('no-store')
    })
})

describe('taille maximale du corps JSON (10 Ko)', () => {
    it('corps de 11 Ko : 413 PAYLOAD_TOO_LARGE', async () => {
        const response = await request(app)
            .post(USERS)
            .send({ name: 'a'.repeat(11 * 1024), email: 'big@example.com' })

        expectErrorResponse(response, 413, 'PAYLOAD_TOO_LARGE', [])
    })

    it('corps de 9 Ko : lu et traité normalement (201)', async () => {
        const response = await request(app)
            .post(USERS)
            .send({ name: 'a'.repeat(9 * 1024), email: 'nine@example.com' })

        expect(response.status).toBe(201)
    })
})

describe('format du corps : JSON uniquement (415)', () => {
    it.each([
        { label: 'text/plain', type: 'text/plain', body: '{"name":"A","email":"a@example.com"}' },
        { label: 'formulaire', type: 'application/x-www-form-urlencoded', body: 'name=A&email=a%40example.com' },
        { label: 'XML', type: 'application/xml', body: '<user><name>A</name></user>' }
    ])('corps $label : 415 UNSUPPORTED_MEDIA_TYPE', async ({ type, body }) => {
        const response = await request(app).post(USERS).set('Content-Type', type).send(body)

        expectErrorResponse(response, 415, 'UNSUPPORTED_MEDIA_TYPE', [])
        expect(response.body.message).toBe('Unsupported media type')
    })

    it('corps sans Content-Type : 415 UNSUPPORTED_MEDIA_TYPE', async () => {
        // Un Buffer est envoyé tel quel, sans Content-Type (une chaîne recevrait un type « formulaire » par défaut).
        const response = await request(app).post(USERS).send(Buffer.from('{"name":"A","email":"a@example.com"}'))

        expectErrorResponse(response, 415, 'UNSUPPORTED_MEDIA_TYPE', [])
    })

    it('application/json; charset=utf-8 : accepté (201)', async () => {
        const response = await request(app)
            .post(USERS)
            .set('Content-Type', 'application/json; charset=utf-8')
            .send(JSON.stringify({ name: 'Charset', email: 'charset@example.com' }))

        expect(response.status).toBe(201)
    })

    it('requête sans corps : non concernée (GET 200, DELETE 204)', async () => {
        expect((await request(app).get(USERS)).status).toBe(200)
        expect((await request(app).delete(`${USERS}/${existingUserId}`)).status).toBe(204)
    })

    it("POST avec Content-Length: 0 et sans Content-Type : non concerné (400 de validation, pas 415)", async () => {
        const response = await request(app).post(USERS).set('Content-Length', '0')

        expectErrorResponse(response, 400, 'VALIDATION_ERROR')
    })
})

describe("CORS de l'application (development et test : toutes les origines)", () => {
    it("autorise une origine quelconque et expose X-Request-Id et les en-têtes de rate limiting", async () => {
        const response = await request(app).get('/health').set('Origin', OTHER_ORIGIN)

        expect(response.headers['access-control-allow-origin']).toBe('*')
        expect(response.headers['access-control-expose-headers']).toBe(
            'X-Request-Id,Retry-After,RateLimit,RateLimit-Policy'
        )
    })

    it('répond à une préflight OPTIONS (204) sans atteindre les routes', async () => {
        const response = await request(app)
            .options(USERS)
            .set('Origin', OTHER_ORIGIN)
            .set('Access-Control-Request-Method', 'POST')
            .set('Access-Control-Request-Headers', 'Content-Type')

        expect(response.status).toBe(204)
        expect(response.headers['access-control-allow-origin']).toBe('*')
        expect(response.headers['access-control-allow-methods']).toContain('POST')
    })

    it("avec CORS_ORIGINS : seules les origines listées sont autorisées (configuration lue au chargement)", async () => {
        vi.stubEnv('CORS_ORIGINS', ALLOWED_ORIGIN)
        const { app: restrictedApp } = await loadFreshApp()

        const allowed = await request(restrictedApp).get('/health').set('Origin', ALLOWED_ORIGIN)
        const refused = await request(restrictedApp).get('/health').set('Origin', OTHER_ORIGIN)

        expect(allowed.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN)
        expect(refused.headers['access-control-allow-origin']).toBeUndefined()
        // CORS ne bloque pas le serveur : la réponse est produite, c'est le navigateur qui refuse de la lire.
        expect(refused.status).toBe(200)
    })
})

describe('resolveCorsAllowedOrigins', () => {
    it.each([
        { label: 'liste définie, production', settings: { NODE_ENV: 'production', CORS_ORIGINS: [ALLOWED_ORIGIN] }, expected: [ALLOWED_ORIGIN] },
        { label: 'liste définie, development', settings: { NODE_ENV: 'development', CORS_ORIGINS: [ALLOWED_ORIGIN] }, expected: [ALLOWED_ORIGIN] },
        { label: 'non définie, production : aucune origine', settings: { NODE_ENV: 'production' }, expected: [] },
        { label: 'non définie, development : toutes', settings: { NODE_ENV: 'development' }, expected: '*' },
        { label: 'non définie, test : toutes', settings: { NODE_ENV: 'test' }, expected: '*' }
    ] as const)('$label', ({ settings, expected }) => {
        expect(resolveCorsAllowedOrigins(settings)).toEqual(expected)
    })
})

/**
 * Petite application avec le VRAI middleware CORS et une politique donnée.
 * Permet de vérifier le comportement de production sans changer NODE_ENV pour toute l'application.
 */
function corsTestApp(allowedOrigins: CorsAllowedOrigins): Express {
    const testApp = express()
    testApp.use(createCorsMiddleware(allowedOrigins))
    testApp.get('/ping', (_req, res) => {
        res.json({ success: true, message: 'pong', data: {} })
    })
    testApp.use(notFoundHandler)
    testApp.use(errorHandler)
    return testApp
}

describe('CORS en production', () => {
    describe('sans CORS_ORIGINS (aucune origine autorisée)', () => {
        const productionApp = corsTestApp(resolveCorsAllowedOrigins({ NODE_ENV: 'production' }))

        it("origine externe : aucun en-tête Access-Control-Allow-Origin", async () => {
            const response = await request(productionApp).get('/ping').set('Origin', OTHER_ORIGIN)

            expect(response.headers['access-control-allow-origin']).toBeUndefined()
        })

        it('préflight : réponse 204 sans autorisation (le navigateur bloque la requête)', async () => {
            const response = await request(productionApp)
                .options('/ping')
                .set('Origin', OTHER_ORIGIN)
                .set('Access-Control-Request-Method', 'POST')

            expect(response.status).toBe(204)
            expect(response.headers['access-control-allow-origin']).toBeUndefined()
        })

        it('requête sans Origin (Postman, curl) : traitée normalement', async () => {
            const response = await request(productionApp).get('/ping')

            expectSuccessResponse(response, 200, 'pong', {})
        })
    })

    describe('avec CORS_ORIGINS', () => {
        const productionApp = corsTestApp(
            resolveCorsAllowedOrigins({ NODE_ENV: 'production', CORS_ORIGINS: [ALLOWED_ORIGIN] })
        )

        it("origine listée : renvoyée dans Access-Control-Allow-Origin, avec Vary: Origin", async () => {
            const response = await request(productionApp).get('/ping').set('Origin', ALLOWED_ORIGIN)

            expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN)
            expect(response.headers.vary).toContain('Origin')
            expect(response.headers['access-control-allow-credentials']).toBeUndefined()
        })

        it('origine non listée : aucun en-tête Access-Control-Allow-Origin', async () => {
            const response = await request(productionApp).get('/ping').set('Origin', OTHER_ORIGIN)

            expect(response.headers['access-control-allow-origin']).toBeUndefined()
        })

        it("requête sans Origin (Postman, curl) : traitée normalement", async () => {
            expectSuccessResponse(await request(productionApp).get('/ping'), 200, 'pong', {})
        })
    })
})