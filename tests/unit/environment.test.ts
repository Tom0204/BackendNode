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

describe('parseEnvironment : CORS_ORIGINS (FND-08)', () => {
    it.each([
        { label: 'absente', value: undefined },
        { label: 'vide', value: '' },
        { label: "composée uniquement d'espaces", value: '   ' }
    ])('$label : non définie (comportement par défaut)', ({ value }) => {
        const result = parseEnvironment({ CORS_ORIGINS: value })
        expect(result).toEqual({ success: true, env: DEFAULT_ENV })
        expect(result.success && result.env.CORS_ORIGINS).toBeUndefined()
    })

    it('découpe la liste sur les virgules et ignore les espaces autour', () => {
        const result = parseEnvironment({
            CORS_ORIGINS: ' https://jeu.example.com , http://localhost:5173,https://[::1]:8080 '
        })
        expect(result).toEqual({
            success: true,
            env: {
                ...DEFAULT_ENV,
                CORS_ORIGINS: ['https://jeu.example.com', 'http://localhost:5173', 'https://[::1]:8080']
            }
        })
    })

    // Messages attendus, sans le préfixe « CORS_ORIGINS : » ajouté par parseEnvironment.
    const INVALID_URL = "l'origine n°1 n'est pas une URL valide (format attendu : http(s)://hôte[:port])"
    const PATH_FORBIDDEN = "l'origine n°1 ne doit contenir ni chemin, ni / final, ni paramètres, ni fragment"
    const NOT_NORMALIZED = "l'origine n°1 doit être écrite sous sa forme normalisée (minuscules, sans port par défaut)"

    it.each([
        { label: 'joker seul', value: '*', problem: "l'origine n°1 utilise le joker *, interdit" },
        { label: 'joker dans un nom de domaine', value: 'https://*.example.com', problem: "l'origine n°1 utilise le joker *, interdit" },
        { label: 'protocole ftp', value: 'ftp://example.com', problem: "l'origine n°1 doit utiliser le protocole http ou https" },
        { label: 'pas une URL', value: 'example.com', problem: INVALID_URL },
        { label: 'écriture incomplète http:hote', value: 'http:example.com', problem: INVALID_URL },
        { label: 'identifiants', value: 'https://user:secret@example.com', problem: "l'origine n°1 ne doit pas contenir d'identifiants" },
        { label: 'slash final', value: 'https://example.com/', problem: PATH_FORBIDDEN },
        { label: 'chemin', value: 'https://example.com/app', problem: PATH_FORBIDDEN },
        { label: 'paramètres', value: 'https://example.com?x=1', problem: PATH_FORBIDDEN },
        { label: 'fragment', value: 'https://example.com#a', problem: PATH_FORBIDDEN },
        { label: 'majuscules', value: 'https://Example.com', problem: NOT_NORMALIZED },
        { label: 'port par défaut', value: 'https://example.com:443', problem: NOT_NORMALIZED },
        { label: 'élément vide dans la liste', value: 'https://a.example.com,,https://b.example.com', problem: "l'origine n°2 est vide" }
    ])('refuse : $label', ({ value, problem }) => {
        expect(parseEnvironment({ CORS_ORIGINS: value })).toEqual({
            success: false,
            problems: [`CORS_ORIGINS : ${problem}`]
        })
    })

    it('signale chaque origine invalide, par sa position', () => {
        const result = parseEnvironment({ CORS_ORIGINS: 'https://ok.example.com,*,https://example.com/' })

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.problems).toEqual([
                "CORS_ORIGINS : l'origine n°2 utilise le joker *, interdit",
                "CORS_ORIGINS : l'origine n°3 ne doit contenir ni chemin, ni / final, ni paramètres, ni fragment"
            ])
        }
    })

    it("ne recopie pas la valeur refusée dans le message d'erreur", () => {
        const result = parseEnvironment({ CORS_ORIGINS: 'https://user:secret@example.com' })

        expect(result.success).toBe(false)
        if (!result.success) {
            expect(result.problems.join('\n')).not.toContain('secret')
        }
    })
})