import { describe, expect, it } from 'vitest'
import { describeDatabaseError } from '../../src/database/errors'

const TITLE = 'Le serveur ne peut pas démarrer : base de données inaccessible.'

// Message volontairement sensible : il ne doit jamais apparaître dans le résultat.
const SENSITIVE_MESSAGE = 'connexion à postgresql://mmorpg:secret@localhost:5432/mmorpg_dev impossible'

// Construit une erreur semblable à celles de pg et de Node (Error + propriété code).
function codedError(code: string, message = SENSITIVE_MESSAGE): NodeJS.ErrnoException {
    const error: NodeJS.ErrnoException = new Error(message)
    error.code = code
    return error
}

describe('describeDatabaseError (DB-01)', () => {
    it('ECONNREFUSED : base non démarrée, avec la solution', () => {
        expect(describeDatabaseError(codedError('ECONNREFUSED'))).toEqual([
            TITLE,
            '  - Connexion refusée : PostgreSQL ne semble pas démarré.',
            "Démarrez la base avec « npm run db:up » (Docker Desktop requis), puis vérifiez l'hôte et le port de DATABASE_URL."
        ])
    })

    it('ENOTFOUND : hôte introuvable', () => {
        expect(describeDatabaseError(codedError('ENOTFOUND'))[1]).toBe('  - Hôte de la base introuvable.')
    })

    it('28P01 : authentification refusée', () => {
        expect(describeDatabaseError(codedError('28P01'))[1]).toBe('  - Authentification refusée par PostgreSQL.')
    })

    it('3D000 : base inexistante', () => {
        expect(describeDatabaseError(codedError('3D000'))[1]).toBe("  - La base indiquée dans DATABASE_URL n'existe pas.")
    })

    it('code inconnu : message générique avec le code uniquement', () => {
        expect(describeDatabaseError(codedError('XX000'))).toEqual([
            TITLE,
            '  - Erreur inattendue lors de la connexion à la base (code XX000).',
            "Vérifiez DATABASE_URL et l'état de PostgreSQL (voir .env.example)."
        ])
    })

    it('erreur sans code ou valeur quelconque : message générique sans code', () => {
        const expected = '  - Erreur inattendue lors de la connexion à la base.'
        expect(describeDatabaseError(new Error(SENSITIVE_MESSAGE))[1]).toBe(expected)
        expect(describeDatabaseError(SENSITIVE_MESSAGE)[1]).toBe(expected)
        expect(describeDatabaseError(undefined)[1]).toBe(expected)
    })

    it.each(['ECONNREFUSED', 'ENOTFOUND', '28P01', '3D000', 'XX000'])(
        "%s : ne reprend jamais le message de l'erreur ni la trace d'appels",
        (code) => {
            const error = codedError(code)
            const output = describeDatabaseError(error).join('\n')
            expect(output).not.toContain('secret')
            expect(output).not.toContain('postgresql://')
            expect(output).not.toContain(error.stack ?? 'stack absente')
        }
    )
})
