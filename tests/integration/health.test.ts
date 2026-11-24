import type { Express } from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadFreshApp, type AuthService } from '../helpers/fresh-modules'
import { expectErrorResponse, expectSuccessResponse } from '../helpers/http'

let app: Express
let authService: AuthService

beforeEach(async () => {
    const fresh = await loadFreshApp()
    app = fresh.app
    authService = fresh.authService
})

describe('GET /health', () => {
    it("200 avec l'enveloppe exacte : statut simple, aucune information sensible", async () => {
        const response = await request(app).get('/health')

        // Correspondance exacte : aucune clé en plus (version, environnement, système...) n'est tolérée.
        expectSuccessResponse(response, 200, 'Service is healthy', { status: 'OK' })
    })

    it('interdit la mise en cache (Cache-Control: no-store)', async () => {
        const response = await request(app).get('/health')
        expect(response.headers['cache-control']).toBe('no-store')
    })

    it('répond aussi à HEAD, sans corps', async () => {
        const response = await request(app).head('/health')

        expect(response.status).toBe(200)
        expect(response.headers['cache-control']).toBe('no-store')
        expect(response.text ?? '').toBe('')
    })

    it('ignore les paramètres de requête : toujours 200 (aucune validation sur /health)', async () => {
        const response = await request(app).get('/health').query({ probe: '1' })
        expectSuccessResponse(response, 200, 'Service is healthy', { status: 'OK' })
    })

    it("n'est pas sous le préfixe /api/v1", async () => {
        expectErrorResponse(await request(app).get('/api/v1/health'), 404, 'ROUTE_NOT_FOUND', [])
    })
})

describe('migration des anciennes routes (FND-07)', () => {
    it('GET /users : 404 ROUTE_NOT_FOUND', async () => {
        expectErrorResponse(await request(app).get('/users'), 404, 'ROUTE_NOT_FOUND', [])
    })

    it('GET /users/1 : 404 ROUTE_NOT_FOUND', async () => {
        expectErrorResponse(await request(app).get('/users/1'), 404, 'ROUTE_NOT_FOUND', [])
    })

    it("POST /users : 404 ROUTE_NOT_FOUND, sans appeler aucun service", async () => {
        const createSpy = vi.spyOn(authService, 'register')

        const response = await request(app).post('/users').send({ name: 'Al', email: 'al@example.com' })

        expectErrorResponse(response, 404, 'ROUTE_NOT_FOUND', [])
        expect(createSpy).not.toHaveBeenCalled()
    })

    it('GET / : 404 ROUTE_NOT_FOUND (ancienne route supprimée)', async () => {
        expectErrorResponse(await request(app).get('/'), 404, 'ROUTE_NOT_FOUND', [])
    })
})

describe('routes inconnues sous /api/v1', () => {
    it('GET /api/v1 : 404 ROUTE_NOT_FOUND', async () => {
        expectErrorResponse(await request(app).get('/api/v1'), 404, 'ROUTE_NOT_FOUND', [])
    })

    it('GET /api/v1/inconnue : 404 ROUTE_NOT_FOUND', async () => {
        expectErrorResponse(await request(app).get('/api/v1/inconnue'), 404, 'ROUTE_NOT_FOUND', [])
    })
})