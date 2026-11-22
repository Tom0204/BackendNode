import { describe, expect, it, vi } from 'vitest'
import { requireSafeTestDatabaseUrl, testDatabaseUrlProblems } from '../helpers/test-database'

// Tests sans base de données : la protection est vérifiée avant toute connexion (DB-01).
const VALID_URL = 'postgresql://mmorpg:secret@localhost:5432/mmorpg_test'

describe('testDatabaseUrlProblems (protection de la base de test)', () => {
    it.each([
        { label: 'localhost', url: VALID_URL },
        { label: '127.0.0.1', url: 'postgresql://mmorpg:secret@127.0.0.1:5432/mmorpg_test' },
        { label: '::1', url: 'postgresql://mmorpg:secret@[::1]:5432/mmorpg_test' },
        { label: 'préfixe postgres://', url: 'postgres://mmorpg:secret@localhost/mmorpg_test' }
    ])('accepte une URL sûre : $label', ({ url }) => {
        expect(testDatabaseUrlProblems('test', url)).toEqual([])
    })

    it.each(['development', 'production', undefined])('refuse NODE_ENV=%s', (nodeEnv) => {
        expect(testDatabaseUrlProblems(nodeEnv, VALID_URL)).toEqual(['NODE_ENV doit valoir « test »'])
    })

    it.each([
        { label: 'absente', url: undefined, problem: 'TEST_DATABASE_URL est absente' },
        { label: 'vide', url: '  ', problem: 'TEST_DATABASE_URL est absente' },
        { label: 'illisible', url: 'pas-une-url', problem: "TEST_DATABASE_URL n'est pas une URL valide" }
    ])('refuse une URL $label', ({ url, problem }) => {
        expect(testDatabaseUrlProblems('test', url)).toEqual([problem])
    })

    it.each([
        { label: 'base de développement', url: 'postgresql://mmorpg:secret@localhost:5432/mmorpg_dev' },
        { label: 'nom proche', url: 'postgresql://mmorpg:secret@localhost:5432/mmorpg_test2' },
        { label: 'sans base', url: 'postgresql://mmorpg:secret@localhost:5432' }
    ])('refuse une autre base : $label', ({ url }) => {
        expect(testDatabaseUrlProblems('test', url)).toEqual(['la base doit être exactement mmorpg_test'])
    })

    it('refuse un hôte distant', () => {
        expect(testDatabaseUrlProblems('test', 'postgresql://mmorpg:secret@db.example.com:5432/mmorpg_test')).toEqual([
            "l'hôte doit être localhost, 127.0.0.1 ou ::1"
        ])
    })

    it.each([
        { label: 'paramètre host', url: `${VALID_URL}?host=db.example.com` },
        { label: 'fragment', url: `${VALID_URL}#x` }
    ])('refuse une URL avec $label', ({ url }) => {
        expect(testDatabaseUrlProblems('test', url)).toEqual(["l'URL ne doit contenir ni paramètres ni fragment"])
    })

    it('refuse un autre protocole', () => {
        expect(testDatabaseUrlProblems('test', 'mysql://mmorpg:secret@localhost:3306/mmorpg_test')).toEqual([
            'le protocole doit être postgresql://'
        ])
    })

    it('signale tous les problèmes à la fois', () => {
        expect(testDatabaseUrlProblems('production', 'postgresql://u:secret@db.example.com/prod?x=1')).toHaveLength(4)
    })
})

describe('requireSafeTestDatabaseUrl', () => {
    it("renvoie l'URL quand elle est sûre", () => {
        vi.stubEnv('NODE_ENV', 'test')
        vi.stubEnv('TEST_DATABASE_URL', VALID_URL)
        expect(requireSafeTestDatabaseUrl()).toBe(VALID_URL)
    })

    it("lève une erreur listant les raisons, sans recopier l'URL ni le mot de passe", () => {
        vi.stubEnv('NODE_ENV', 'test')
        vi.stubEnv('TEST_DATABASE_URL', 'postgresql://mmorpg:secret@db.example.com:5432/mmorpg_dev')

        expect(requireSafeTestDatabaseUrl).toThrow(/^Tests base de données refusés :/)
        try {
            requireSafeTestDatabaseUrl()
        } catch (error) {
            const message = error instanceof Error ? error.message : ''
            expect(message).not.toContain('secret')
            expect(message).not.toContain('db.example.com')
        }
    })

    it('ignore DATABASE_URL : seule TEST_DATABASE_URL est lue', () => {
        vi.stubEnv('NODE_ENV', 'test')
        vi.stubEnv('TEST_DATABASE_URL', 'postgresql://mmorpg:secret@localhost:5432/mmorpg_dev')
        vi.stubEnv('DATABASE_URL', VALID_URL)
        expect(requireSafeTestDatabaseUrl).toThrow(/la base doit être exactement mmorpg_test/)
    })
})
