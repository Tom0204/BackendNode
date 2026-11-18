import express from 'express'
import type { Express, RequestHandler } from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { STRICT_RATE_LIMIT } from '../../src/config/http'
import { errorHandler, notFoundHandler } from '../../src/middlewares/error.middleware'
import {
    createRateLimiter,
    createRateLimitLogger,
    createStrictRateLimiter
} from '../../src/middlewares/rate-limit.middleware'
import { createRequestLogger } from '../../src/middlewares/request-logger.middleware'
import { createCorsMiddleware } from '../../src/middlewares/security.middleware'
import { loadFreshApp } from '../helpers/fresh-modules'
import { expectErrorResponse, expectSuccessResponse } from '../helpers/http'
import { createLogCapture, LOG_LEVELS } from '../helpers/log-capture'

// Chemin écrit en clair : les tests décrivent le contrat public de l'API.
const USERS = '/api/v1/users'

/**
 * Petite application avec un VRAI limiteur (limite basse pour garder le test rapide),
 * entouré des vrais middlewares : log de requête (FND-05), CORS et gestionnaires d'erreurs (FND-03).
 */
function rateLimitedTestApp(limiter: RequestHandler, capture = createLogCapture()): Express {
    const testApp = express()
    testApp.use(createRequestLogger(capture.logger))
    testApp.use(createCorsMiddleware('*'))
    testApp.use('/limited', limiter)
    testApp.get('/limited', (_req, res) => {
        res.json({ success: true, message: 'ok', data: {} })
    })
    testApp.use(notFoundHandler)
    testApp.use(errorHandler)
    return testApp
}

/** Envoie `count` requêtes GET l'une après l'autre et renvoie les statuts obtenus. */
async function sendSequentially(app: Express, path: string, count: number): Promise<number[]> {
    const statuses: number[] = []
    for (let i = 0; i < count; i++) {
        statuses.push((await request(app).get(path)).status)
    }
    return statuses
}

describe('limiteur de requêtes (createRateLimiter)', () => {
    it("au-delà de la limite : 429 RATE_LIMITED au format d'erreur habituel, avec Retry-After", async () => {
        const app = rateLimitedTestApp(createRateLimiter({ windowMs: 60_000, limit: 3 }))

        expect(await sendSequentially(app, '/limited', 3)).toEqual([200, 200, 200])
        const response = await request(app).get('/limited')

        expectErrorResponse(response, 429, 'RATE_LIMITED', [])
        expect(response.body.message).toBe('Too many requests')
        // Délai en secondes avant de pouvoir réessayer (au plus la durée de la fenêtre).
        expect(Number(response.headers['retry-after'])).toBeGreaterThan(0)
        expect(Number(response.headers['retry-after'])).toBeLessThanOrEqual(60)
        expect(response.headers.ratelimit).toMatch(/^limit=3, remaining=0, reset=\d+$/)
        expect(response.headers['ratelimit-policy']).toBe('3;w=60')
    })

    it('chaque réponse indique le quota restant (en-têtes RateLimit, pas de X-RateLimit-*)', async () => {
        const app = rateLimitedTestApp(createRateLimiter({ windowMs: 60_000, limit: 3 }))

        const response = await request(app).get('/limited')

        expect(response.status).toBe(200)
        expect(response.headers.ratelimit).toMatch(/^limit=3, remaining=2, reset=\d+$/)
        expect(response.headers['x-ratelimit-limit']).toBeUndefined()
        expect(response.headers['retry-after']).toBeUndefined()
    })

    it('la réponse 429 passe par le gestionnaire existant : un seul log warn, avec le reqId', async () => {
        const capture = createLogCapture()
        const app = rateLimitedTestApp(createRateLimiter({ windowMs: 60_000, limit: 1 }), capture)

        await request(app).get('/limited')
        const response = await request(app).get('/limited').set('X-Request-Id', 'burst-2')

        expect(response.status).toBe(429)
        const completed = capture.entries.filter((entry) => entry.reqId === 'burst-2')
        expect(completed).toHaveLength(1)
        expect(completed[0]).toMatchObject({ level: LOG_LEVELS.warn, res: { statusCode: 429 } })
    })

    it('une réponse 429 reste lisible par un navigateur autorisé (en-têtes CORS présents)', async () => {
        const app = rateLimitedTestApp(createRateLimiter({ windowMs: 60_000, limit: 1 }))

        await request(app).get('/limited')
        const response = await request(app).get('/limited').set('Origin', 'https://jeu.example.com')

        expect(response.status).toBe(429)
        expect(response.headers['access-control-allow-origin']).toBe('*')
        expect(response.headers['access-control-expose-headers']).toContain('Retry-After')
    })

    it('les préflights OPTIONS sont traitées par CORS et ne consomment pas le quota', async () => {
        const app = rateLimitedTestApp(createRateLimiter({ windowMs: 60_000, limit: 2 }))

        for (let i = 0; i < 5; i++) {
            const preflight = await request(app)
                .options('/limited')
                .set('Origin', 'https://jeu.example.com')
                .set('Access-Control-Request-Method', 'GET')
            expect(preflight.status).toBe(204)
            expect(preflight.headers.ratelimit).toBeUndefined()
        }

        expect(await sendSequentially(app, '/limited', 3)).toEqual([200, 200, 429])
    })

    it('deux limiteurs ont des compteurs indépendants', async () => {
        const first = rateLimitedTestApp(createRateLimiter({ windowMs: 60_000, limit: 1 }))
        const second = rateLimitedTestApp(createRateLimiter({ windowMs: 60_000, limit: 1 }))

        expect(await sendSequentially(first, '/limited', 2)).toEqual([200, 429])
        expect(await sendSequentially(second, '/limited', 1)).toEqual([200])
    })

})

describe('messages internes de express-rate-limit (redirigés vers Pino)', () => {
    it("X-Forwarded-For dès la première requête : ignoré, non bloquant, une seule ligne de log, rien dans la console (trust proxy : QUAL-06)", async () => {
        const consoleWarn = vi.spyOn(console, 'warn')
        const consoleError = vi.spyOn(console, 'error')
        const capture = createLogCapture()
        const app = rateLimitedTestApp(createRateLimiter({ windowMs: 60_000, limit: 5 }, capture.logger), capture)

        const first = await request(app).get('/limited').set('X-Forwarded-For', '203.0.113.7')
        const second = await request(app).get('/limited').set('X-Forwarded-For', '203.0.113.8')

        expect([first.status, second.status]).toEqual([200, 200])
        // L'adresse IP réelle de la connexion est utilisée : les deux requêtes partagent le même compteur.
        expect(second.headers.ratelimit).toMatch(/^limit=5, remaining=3, /)
        // Une seule ligne, dans les logs de l'application : la bibliothèque n'exécute ce contrôle qu'une fois par limiteur.
        const messages = capture.entries.filter((entry) => String(entry.msg).startsWith('Rate limiter'))
        expect(messages).toHaveLength(1)
        expect(messages[0]).toMatchObject({
            level: LOG_LEVELS.error,
            msg: 'Rate limiter error',
            err: { type: 'ValidationError', code: 'ERR_ERL_UNEXPECTED_X_FORWARDED_FOR' }
        })
        // Pas de seconde écriture directe dans la console.
        expect(consoleWarn).not.toHaveBeenCalled()
        expect(consoleError).not.toHaveBeenCalled()
    })

    it('le contrôle X-Forwarded-For ne porte que sur la première requête du limiteur (comportement de la bibliothèque)', async () => {
        const capture = createLogCapture()
        const app = rateLimitedTestApp(createRateLimiter({ windowMs: 60_000, limit: 5 }, capture.logger), capture)

        await request(app).get('/limited')
        await request(app).get('/limited').set('X-Forwarded-For', '203.0.113.7')

        // Contrôle déjà effectué (et réussi) sur la première requête : rien n'est signalé ensuite.
        // La vraie protection est la configuration de trust proxy, prévue par QUAL-06.
        expect(capture.entries.filter((entry) => String(entry.msg).startsWith('Rate limiter'))).toHaveLength(0)
    })

    it("createRateLimitLogger : warn et error écrivent une ligne chacun, au bon niveau, en gardant le message d'origine", () => {
        const capture = createLogCapture()
        const rateLimitLogger = createRateLimitLogger(capture.logger)

        rateLimitLogger.warn(new Error('change'))
        rateLimitLogger.error(new Error('store down'), 'express-rate-limit: error from store')

        expect(capture.entries).toHaveLength(2)
        expect(capture.entries[0]).toMatchObject({ level: LOG_LEVELS.warn, msg: 'Rate limiter warning', err: { message: 'change' } })
        expect(capture.entries[0]).not.toHaveProperty('context')
        expect(capture.entries[1]).toMatchObject({
            level: LOG_LEVELS.error,
            msg: 'Rate limiter error',
            err: { message: 'store down' },
            context: 'express-rate-limit: error from store'
        })
    })
})

describe('limiteur strict (prêt pour QUAL-02, non branché)', () => {
    it('10 requêtes par 15 minutes, puis 429 RATE_LIMITED', async () => {
        expect(STRICT_RATE_LIMIT).toEqual({ windowMs: 15 * 60 * 1000, limit: 10 })
        const app = rateLimitedTestApp(createStrictRateLimiter())

        const statuses = await sendSequentially(app, '/limited', 11)

        expect(statuses.slice(0, 10)).toEqual(Array(10).fill(200))
        expect(statuses[10]).toBe(429)
    })

    it("n'est branché sur aucune route de l'application", async () => {
        const { app } = await loadFreshApp()

        // Seul le limiteur global s'applique : 300 requêtes par fenêtre de 60 secondes.
        const response = await request(app).get(USERS)
        expect(response.headers['ratelimit-policy']).toBe('300;w=60')
    })
})

describe("limiteur global de l'application (/api/v1)", () => {
    let app: Express

    beforeEach(async () => {
        const fresh = await loadFreshApp()
        app = fresh.app
    })

    it('300 requêtes par minute : la 301e reçoit 429 RATE_LIMITED, /health reste disponible', async () => {
        const statuses = await sendSequentially(app, USERS, 300)
        expect(statuses.every((status) => status === 200)).toBe(true)

        expectErrorResponse(await request(app).get(USERS), 429, 'RATE_LIMITED', [])
        // Le quota est commun à toutes les routes de /api/v1, y compris les chemins inconnus.
        expectErrorResponse(await request(app).get(`${USERS}/1`), 429, 'RATE_LIMITED', [])
        expectErrorResponse(await request(app).get('/api/v1/inconnue'), 429, 'RATE_LIMITED', [])
        // /health et les routes hors /api/v1 ne sont pas limitées.
        expectSuccessResponse(await request(app).get('/health'), 200, 'Service is healthy', { status: 'OK' })
        expectErrorResponse(await request(app).get('/inconnue'), 404, 'ROUTE_NOT_FOUND', [])
    })

    it("/health n'est pas limité : aucun en-tête RateLimit", async () => {
        const response = await request(app).get('/health')
        expect(response.headers.ratelimit).toBeUndefined()
    })

    it('les requêtes rejetées pour leur corps (415, 413) comptent dans le quota', async () => {
        const rejected = await request(app).post(USERS).set('Content-Type', 'text/plain').send('texte')
        expect(rejected.status).toBe(415)
        expect(rejected.headers.ratelimit).toMatch(/^limit=300, remaining=299, /)

        const tooLarge = await request(app).post(USERS).send({ name: 'a'.repeat(11 * 1024), email: 'x@example.com' })
        expect(tooLarge.status).toBe(413)
        expect(tooLarge.headers.ratelimit).toMatch(/^limit=300, remaining=298, /)
    })

    it('une préflight OPTIONS sur /api/v1 ne consomme pas le quota', async () => {
        const preflight = await request(app)
            .options(USERS)
            .set('Origin', 'https://jeu.example.com')
            .set('Access-Control-Request-Method', 'POST')
        expect(preflight.status).toBe(204)

        const response = await request(app).get(USERS)
        expect(response.headers.ratelimit).toMatch(/^limit=300, remaining=299, /)
    })
})