import express from 'express'
import type { Express } from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import { errorHandler, notFoundHandler } from '../../src/middlewares/error.middleware'
import { createRequestLogger } from '../../src/middlewares/request-logger.middleware'
import { loadFreshApp } from '../helpers/fresh-modules'
import { expectErrorResponse } from '../helpers/http'
import { createLogCapture, LOG_LEVELS } from '../helpers/log-capture'

// Chemin écrit en clair : les tests décrivent le contrat public de l'API.
const REGISTER = '/api/v1/auth/register'

let app: Express

beforeEach(async () => {
    const fresh = await loadFreshApp()
    app = fresh.app
})

describe('route inconnue', () => {
    it('GET /inconnue : 404 ROUTE_NOT_FOUND au format JSON (non-régression)', async () => {
        const response = await request(app).get('/inconnue')

        expectErrorResponse(response, 404, 'ROUTE_NOT_FOUND', [])
        expect(response.body.message).toBe('Route not found')
    })

    it('méthode non prévue sur un chemin existant : 404 ROUTE_NOT_FOUND', async () => {
        const response = await request(app).put(REGISTER)
        expectErrorResponse(response, 404, 'ROUTE_NOT_FOUND', [])
    })
})

describe('corps de requête rejetés par express.json()', () => {
    it('JSON illisible : 400 INVALID_JSON (non-régression)', async () => {
        const response = await request(app)
            .post(REGISTER)
            .set('Content-Type', 'application/json')
            .send('{bad')

        expectErrorResponse(response, 400, 'INVALID_JSON', [])
        expect(response.body.message).toBe('Malformed JSON body')
    })

    it('corps trop volumineux : 413 PAYLOAD_TOO_LARGE', async () => {
        // Environ 200 Ko, au-delà de la limite par défaut d'express.json() (100 Ko).
        const response = await request(app)
            .post(REGISTER)
            .send({ name: 'a'.repeat(200_000), email: 'big@example.com' })

        expectErrorResponse(response, 413, 'PAYLOAD_TOO_LARGE', [])
        expect(response.body.message).toBe('Payload too large')
    })

    it('jeu de caractères non pris en charge : 415 UNSUPPORTED_MEDIA_TYPE', async () => {
        const response = await request(app)
            .post(REGISTER)
            .set('Content-Type', 'application/json; charset=iso-8859-1')
            .send('{"name":"A","email":"a@example.com"}')

        expectErrorResponse(response, 415, 'UNSUPPORTED_MEDIA_TYPE', [])
        expect(response.body.message).toBe('Unsupported media type')
    })
})

describe('erreur inattendue', () => {
        it("500 INTERNAL_ERROR générique : aucun détail interne dans la réponse, détail dans les logs du serveur", async () => {
        // Logger qui écrit en mémoire, pour lire le log d'erreur produit (FND-05).
        const capture = createLogCapture()

        // Petite application de test : une route qui lève une erreur inattendue,
        // entourée des VRAIS middlewares (log de requête de FND-05, gestionnaires de FND-03).
        // Le code de l'application n'est pas modifié.
        const testApp = express()
        testApp.use(createRequestLogger(capture.logger))
        testApp.get('/boom', () => {
            throw new Error('secret internal detail')
        })
        testApp.use(notFoundHandler)
        testApp.use(errorHandler)

        const response = await request(testApp).get('/boom')

        expectErrorResponse(response, 500, 'INTERNAL_ERROR', [])
        expect(response.body.message).toBe('Internal server error')
        // Ni le message interne, ni une trace d'appels (fichier.ts:ligne) dans la réponse.
        expect(response.text).not.toContain('secret internal detail')
        expect(response.text).not.toMatch(/\.ts:\d+/)
        // L'erreur complète est journalisée une seule fois, rattachée à la requête par son identifiant.
        const errorLogs = capture.entries.filter((entry) => entry.msg === 'Unexpected error')
        expect(errorLogs).toHaveLength(1)
        expect(errorLogs[0]).toMatchObject({
            level: LOG_LEVELS.error,
            reqId: response.headers['x-request-id'],
            err: { message: 'secret internal detail' }
        })
    })
})