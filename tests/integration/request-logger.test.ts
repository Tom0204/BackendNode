import express from 'express'
import type { Express } from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { errorHandler, notFoundHandler } from '../../src/middlewares/error.middleware'
import { createRequestLogger } from '../../src/middlewares/request-logger.middleware'
import { loadFreshApp } from '../helpers/fresh-modules'
import { createLogCapture, LOG_LEVELS, type LogEntry } from '../helpers/log-capture'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * Petite application de test qui reprend la chaîne réelle (log de requête en premier, express.json,
 * 404, gestionnaire d'erreurs), avec un logger qui écrit en mémoire pour lire les logs produits.
 */
function createLoggedApp() {
    const capture = createLogCapture('debug')
    const app = express()
    app.use(createRequestLogger(capture.logger))
    app.use(express.json())
    app.get('/ok', (_req, res) => {
        res.status(200).json({ ok: true })
    })
    app.get('/health', (_req, res) => {
        res.status(200).json({ ok: true })
    })
    app.post('/echo', (_req, res) => {
        res.status(201).json({ ok: true })
    })
    app.get('/boom', () => {
        throw new Error('secret internal detail')
    })
    app.use(notFoundHandler)
    app.use(errorHandler)
    return { app, capture }
}

// Logs écrits pendant la requête d'identifiant donné.
function logsOf(entries: LogEntry[], requestId: string): LogEntry[] {
    return entries.filter((entry) => entry.reqId === requestId)
}

describe('journalisation des requêtes', () => {
    it("relie la requête à son log : même reqId que l'en-tête X-Request-Id", async () => {
        const { app, capture } = createLoggedApp()

        const response = await request(app).get('/ok')
        const requestId = response.headers['x-request-id']

        expect(requestId).toMatch(UUID_PATTERN)
        expect(logsOf(capture.entries, requestId)).toEqual([
            expect.objectContaining({
                level: LOG_LEVELS.info,
                reqId: requestId,
                req: { method: 'GET', path: '/ok' },
                res: { statusCode: 200 },
                responseTime: expect.any(Number),
                msg: 'GET /ok 200'
            })
        ])
    })

    it("reprend l'identifiant fourni par le client s'il est sûr", async () => {
        const { app, capture } = createLoggedApp()

        const response = await request(app).get('/ok').set('X-Request-Id', 'test-123')

        expect(response.headers['x-request-id']).toBe('test-123')
        expect(logsOf(capture.entries, 'test-123')).toHaveLength(1)
    })

    it('génère un nouvel identifiant si celui du client est invalide', async () => {
        const { app } = createLoggedApp()

        const response = await request(app).get('/ok').set('X-Request-Id', 'id invalide avec espaces')

        expect(response.headers['x-request-id']).toMatch(UUID_PATTERN)
    })

    it("ne journalise ni les paramètres de requête, ni les en-têtes, ni le corps", async () => {
        const { app, capture } = createLoggedApp()

        await request(app)
            .post('/echo?token=query-secret')
            .set('Authorization', 'Bearer header-secret')
            .set('Cookie', 'session=cookie-secret')
            .send({ name: 'A', password: 'body-secret' })

        const text = capture.text()
        for (const secret of ['query-secret', 'header-secret', 'cookie-secret', 'body-secret']) {
            expect(text).not.toContain(secret)
        }
        expect(capture.entries[0]).toMatchObject({ req: { method: 'POST', path: '/echo' }, res: { statusCode: 201 } })
        expect(capture.entries[0]?.req).toEqual({ method: 'POST', path: '/echo' })
    })

    it('journalise une erreur client (4xx) en warn', async () => {
        const { app, capture } = createLoggedApp()

        await request(app).get('/inconnue')

        expect(capture.entries).toEqual([
            expect.objectContaining({ level: LOG_LEVELS.warn, res: { statusCode: 404 }, msg: 'GET /inconnue 404' })
        ])
    })

    it("journalise un JSON illisible en warn, sans le corps reçu", async () => {
        const { app, capture } = createLoggedApp()

        await request(app).post('/echo').set('Content-Type', 'application/json').send('{"password":"body-secret"')

        expect(capture.text()).not.toContain('body-secret')
        expect(capture.entries).toEqual([expect.objectContaining({ level: LOG_LEVELS.warn, res: { statusCode: 400 } })])
    })

    it("relie une erreur 500 à sa requête : log d'erreur avec la trace, réponse sans détail", async () => {
        const { app, capture } = createLoggedApp()

        const response = await request(app).get('/boom')
        const requestId = response.headers['x-request-id']

        expect(response.status).toBe(500)
        expect(response.text).not.toContain('secret internal detail')

        const logs = logsOf(capture.entries, requestId)
        expect(logs).toHaveLength(2)
        expect(logs[0]).toMatchObject({
            level: LOG_LEVELS.error,
            msg: 'Unexpected error',
            err: { message: 'secret internal detail', stack: expect.any(String) }
        })
        expect(logs[1]).toMatchObject({ level: LOG_LEVELS.error, res: { statusCode: 500 }, msg: 'GET /boom 500' })
    })

    it('journalise /health en debug (masqué au niveau info par défaut)', async () => {
        const { app, capture } = createLoggedApp()

        await request(app).get('/health')

        expect(capture.entries).toEqual([expect.objectContaining({ level: LOG_LEVELS.debug, msg: 'GET /health 200' })])
    })
})

describe("en-tête X-Request-Id sur l'application réelle", () => {
    let app: Express

    beforeEach(async () => {
        const fresh = await loadFreshApp()
        app = fresh.app
    })

    it('est présent sur une réponse de succès et sur une réponse d’erreur', async () => {
        expect((await request(app).get('/api/v1/users')).headers['x-request-id']).toMatch(UUID_PATTERN)
        expect((await request(app).get('/inconnue')).headers['x-request-id']).toMatch(UUID_PATTERN)
    })

    it("reprend l'identifiant fourni par le client", async () => {
        const response = await request(app).get('/health').set('X-Request-Id', 'client-abc')
        expect(response.headers['x-request-id']).toBe('client-abc')
    })
})