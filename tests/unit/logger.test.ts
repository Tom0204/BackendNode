import { describe, expect, it } from 'vitest'
import { createLogCapture, LOG_LEVELS } from '../helpers/log-capture'

describe('logger : masquage des données sensibles', () => {
    it.each(['authorization', 'cookie', 'set-cookie', 'password', 'token', 'accessToken', 'refreshToken', 'secret'])(
        'masque la clé %s à la racine et un niveau plus bas',
        (key) => {
            const capture = createLogCapture()

            capture.logger.info({ [key]: 'valeur-sensible', nested: { [key]: 'valeur-sensible' } }, 'test')

            expect(capture.text()).not.toContain('valeur-sensible')
            expect(capture.entries[0]).toMatchObject({ [key]: '[REDACTED]', nested: { [key]: '[REDACTED]' } })
        }
    )

    it('laisse les autres données intactes', () => {
        const capture = createLogCapture()

        capture.logger.info({ userId: 42, name: 'Arthas' }, 'test')

        expect(capture.entries[0]).toMatchObject({ userId: 42, name: 'Arthas', msg: 'test' })
    })
})

describe('logger : niveau minimal', () => {
    it("n'écrit pas les messages sous le niveau configuré", () => {
        const capture = createLogCapture('warn')

        capture.logger.info('ignoré')
        capture.logger.warn('écrit')

        expect(capture.entries).toHaveLength(1)
        expect(capture.entries[0]).toMatchObject({ level: LOG_LEVELS.warn, msg: 'écrit' })
    })
})