import { createServer, type Server } from 'node:http'
import express from 'express'
import { afterEach, describe, expect, it } from 'vitest'
import { startServer } from '../../src/startup'
import { loadFreshApp } from '../helpers/fresh-modules'

// Tous les serveurs ouverts par un test sont fermés après lui : sinon Vitest ne pourrait pas se terminer.
const openServers: Server[] = []

function track(server: Server): Server {
    openServers.push(server)
    return server
}

function closeServer(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!server.listening) {
            resolve()
            return
        }
        // Ferme aussi les connexions maintenues ouvertes (keep-alive), par exemple après un fetch.
        server.closeAllConnections()
        server.close((error) => (error ? reject(error) : resolve()))
    })
}

afterEach(async () => {
    await Promise.all(openServers.splice(0).map(closeServer))
})

// Port réellement attribué à un serveur qui écoute en TCP.
function portOf(server: Server): number {
    const address = server.address()
    if (address === null || typeof address === 'string') {
        throw new Error('Adresse TCP attendue')
    }
    return address.port
}

// Ouvre un serveur de test sur un port libre choisi par le système (port 0) et renvoie ce port.
function occupyFreePort(): Promise<number> {
    const blocker = track(createServer())
    return new Promise((resolve, reject) => {
        blocker.once('error', reject)
        blocker.listen(0, () => resolve(portOf(blocker)))
    })
}

describe('startServer', () => {
    it('se résout avec un serveur qui écoute réellement', async () => {
        const server = track(await startServer(express(), 0))

        expect(server.listening).toBe(true)
        expect(portOf(server)).toBeGreaterThan(0)
    })

    it('retire ses écouteurs temporaires après le démarrage', async () => {
        // Node attache lui-même des écouteurs internes à tout serveur HTTP (par exemple sur « listening »).
        // On compare donc avec un serveur de référence jamais passé par startServer.
        const reference = createServer()
        const server = track(await startServer(express(), 0))

        expect(server.listenerCount('error')).toBe(reference.listenerCount('error'))
        expect(server.listenerCount('listening')).toBe(reference.listenerCount('listening'))
    })

    it("est rejeté avec l'erreur système EADDRINUSE quand le port est occupé", async () => {
        const occupiedPort = await occupyFreePort()

        await expect(startServer(express(), occupiedPort)).rejects.toMatchObject({
            code: 'EADDRINUSE',
            syscall: 'listen'
        })
    })

    it("sert la vraie application une fois démarré (GET /health)", async () => {
        const { app } = await loadFreshApp()
        const server = track(await startServer(app, 0))

        const response = await fetch(`http://localhost:${portOf(server)}/health`)

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
            success: true,
            message: 'Service is healthy',
            data: { status: 'OK' }
        })
    })
})