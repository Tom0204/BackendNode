import { describe, expect, it } from 'vitest'
import { describeStartupError } from '../../src/startup'

const TITLE = 'Le serveur ne peut pas démarrer.'

// Construit une erreur système semblable à celles de Node (Error + propriété code).
function systemError(code: string, message = `listen ${code}: test`): NodeJS.ErrnoException {
    const error: NodeJS.ErrnoException = new Error(message)
    error.code = code
    return error
}

describe('describeStartupError', () => {
    it('EADDRINUSE : port déjà utilisé, avec le port et la solution', () => {
        expect(describeStartupError(systemError('EADDRINUSE'), 4001)).toEqual([
            TITLE,
            '  - Le port 4001 est déjà utilisé par un autre processus.',
            'Arrêtez ce processus ou choisissez un autre port avec la variable PORT (voir .env.example).'
        ])
    })

    it('EACCES : accès refusé au port, avec le port et la solution', () => {
        expect(describeStartupError(systemError('EACCES'), 80)).toEqual([
            TITLE,
            '  - Accès refusé au port 80 (port réservé par le système ou nécessitant des droits administrateur).',
            'Choisissez un autre port avec la variable PORT, en évitant les ports réservés par le système (voir .env.example).'
        ])
    })

    it('code inconnu : message générique avec le code et le message système', () => {
        expect(describeStartupError(systemError('EFOO', 'boom'), 4001)).toEqual([
            TITLE,
            "  - Erreur inattendue lors de l'ouverture du port 4001 : EFOO boom",
            'Vérifiez la configuration réseau et la variable PORT (voir .env.example).'
        ])
    })

    it('Error sans code : message générique avec le message système', () => {
        expect(describeStartupError(new Error('boom'), 4001)[1]).toBe(
            "  - Erreur inattendue lors de l'ouverture du port 4001 : boom"
        )
    })

    it.each([
        { label: 'une chaîne', value: 'texte' },
        { label: 'undefined', value: undefined },
        { label: 'null', value: null },
        { label: 'un objet sans code', value: {} }
    ])('valeur qui n’est pas une erreur système ($label) : message générique, sans plantage', ({ value }) => {
        expect(describeStartupError(value, 4001)).toEqual([
            TITLE,
            "  - Erreur inattendue lors de l'ouverture du port 4001",
            'Vérifiez la configuration réseau et la variable PORT (voir .env.example).'
        ])
    })

    it("n'affiche jamais la trace d'appels", () => {
        const known = systemError('EADDRINUSE')
        known.stack = 'Error: listen EADDRINUSE\n    at secret-file.ts:1:1'
        const unknown = systemError('EFOO', 'boom')
        unknown.stack = 'Error: boom\n    at secret-file.ts:1:1'

        for (const error of [known, unknown]) {
            const text = describeStartupError(error, 4001).join('\n')
            expect(text).not.toContain('secret-file')
            expect(text).not.toMatch(/^\s+at /m)
        }
    })

    it('reprend le port réellement demandé', () => {
        const text = describeStartupError(systemError('EADDRINUSE'), 4567).join('\n')
        expect(text).toContain('4567')
        expect(text).not.toContain('4001')
    })
})