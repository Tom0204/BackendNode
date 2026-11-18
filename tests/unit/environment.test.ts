import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseEnvironment } from '../../src/config/environment'

// Restaure les variables modifiées avec vi.stubEnv. L'option unstubEnvs de vitest.config.ts
// le fait déjà ; l'appel explicite rend la règle visible dans ce fichier.
afterEach(() => {
    vi.unstubAllEnvs()
})

const DEFAULT_ENV = { NODE_ENV: 'development', PORT: 4001, LOG_LEVEL: 'info' }

describe('parseEnvironment', () => {
    it("applique les valeurs par défaut quand aucune variable n'est définie", () => {
        expect(parseEnvironment({})).toEqual({ success: true, env: DEFAULT_ENV })
    })

    it('convertit PORT en nombre et accepte un NODE_ENV valide', () => {
        expect(parseEnvironment({ NODE_ENV: 'production', PORT: '4002' })).toEqual({
            success: true,
            env: { NODE_ENV: 'production', PORT: 4002, LOG_LEVEL: 'info' }
        })
    })


    it.each(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])('accepte LOG_LEVEL=%s', (level) => {
        expect(parseEnvironment({ LOG_LEVEL: level })).toEqual({
            success: true,
            env: { NODE_ENV: 'development', PORT: 4001, LOG_LEVEL: level }
        })
    })

    it.each([
        { label: 'PORT non numérique', source: { PORT: 'abc' }, problem: expect.stringMatching(/^PORT : /) },
        { label: 'PORT nul', source: { PORT: '0' }, problem: 'PORT : doit être au moins 1' },
        { label: 'PORT trop grand', source: { PORT: '70000' }, problem: 'PORT : doit être au plus 65535' },
        { label: 'PORT décimal', source: { PORT: '4001.5' }, problem: 'PORT : doit être un entier' },
        { label: 'PORT vide', source: { PORT: '' }, problem: 'PORT : doit être au moins 1' },
        { label: 'NODE_ENV inconnu', source: { NODE_ENV: 'prod' }, problem: expect.stringMatching(/^NODE_ENV : /) },
        { label: 'LOG_LEVEL inconnu', source: { LOG_LEVEL: 'verbose' }, problem: expect.stringMatching(/^LOG_LEVEL : /) }
    ])('refuse : $label', ({ source, problem }) => {
        expect(parseEnvironment(source)).toEqual({ success: false, problems: [problem] })
    })

    it('signale tous les problèmes à la fois', () => {
        const result = parseEnvironment({ NODE_ENV: 'prod', PORT: '70000' })

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.problems).toHaveLength(2)
            expect(result.problems).toEqual(
                expect.arrayContaining([
                    expect.stringMatching(/^NODE_ENV : /),
                    'PORT : doit être au plus 65535'
                ])
            )
        }
    })

    it("ignore les variables qui ne concernent pas l'application", () => {
        expect(parseEnvironment({ PATH: '/usr/bin', OTHER_VARIABLE: 'x' })).toEqual({
            success: true,
            env: DEFAULT_ENV
        })
    })

    it('ne lit pas process.env : seule la source passée en paramètre compte', () => {
        vi.stubEnv('PORT', 'abc')
        vi.stubEnv('NODE_ENV', 'production')

        expect(parseEnvironment({})).toEqual({ success: true, env: DEFAULT_ENV })
    })

    it('ne modifie pas la source reçue', () => {
        const source = { PORT: '4002' }
        parseEnvironment(source)
        expect(source).toEqual({ PORT: '4002' })
    })
})