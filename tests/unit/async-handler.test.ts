import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { errorHandler } from '../../src/middlewares/error.middleware'
import { asyncHandler } from '../../src/utils/async-handler'
import { notFound } from '../../src/utils/http-error'
import { expectErrorResponse } from '../helpers/http'

// Application minimale : une route asynchrone et le gestionnaire d'erreurs centralisé.
function appWith(handler: Parameters<typeof asyncHandler>[0]) {
    const app = express()
    app.get('/', asyncHandler(handler))
    app.use(errorHandler)
    return app
}

describe('asyncHandler (Express 4)', () => {
    it('laisse passer une réponse normale', async () => {
        const app = appWith(async (_req, res) => {
            await Promise.resolve()
            res.status(200).json({ ok: true })
        })
        const response = await request(app).get('/')
        expect(response.status).toBe(200)
        expect(response.body).toEqual({ ok: true })
    })

    it('transmet une HttpError asynchrone au gestionnaire d’erreurs', async () => {
        const app = appWith(async () => {
            await Promise.resolve()
            throw notFound('USER_NOT_FOUND', 'User not found')
        })
        expectErrorResponse(await request(app).get('/'), 404, 'USER_NOT_FOUND', [])
    })

    it('transforme une erreur inattendue en 500 sans détail interne', async () => {
        const app = appWith(async () => {
            await Promise.resolve()
            throw new Error('détail interne à ne pas exposer')
        })
        const response = await request(app).get('/')
        expectErrorResponse(response, 500, 'INTERNAL_ERROR', [])
        expect(JSON.stringify(response.body)).not.toContain('détail interne')
    })
})
