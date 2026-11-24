import { describe, expect, it } from 'vitest'
import { generateSessionToken, hashSessionToken, SESSION_TOKEN_PATTERN } from '../../src/services/session-token'

/* Jetons de session opaques (AUTH-05). */

describe('generateSessionToken', () => {
    it('produit 43 caractères base64url (256 bits), au format attendu par le serveur', () => {
        const token = generateSessionToken()
        expect(token).toMatch(SESSION_TOKEN_PATTERN)
        expect(Buffer.from(token, 'base64url')).toHaveLength(32)
    })

    it('ne produit jamais deux fois le même jeton', () => {
        const tokens = new Set(Array.from({ length: 1000 }, generateSessionToken))
        expect(tokens.size).toBe(1000)
    })
})

describe('hashSessionToken', () => {
    it('empreinte SHA-256 hexadécimale (64 caractères), stable, différente du jeton', () => {
        const token = generateSessionToken()
        const hash = hashSessionToken(token)
        expect(hash).toMatch(/^[0-9a-f]{64}$/)
        expect(hashSessionToken(token)).toBe(hash)
        expect(hash).not.toContain(token)
        expect(hashSessionToken(generateSessionToken())).not.toBe(hash)
    })
})

describe('SESSION_TOKEN_PATTERN', () => {
    it.each(['', 'abc', 'a'.repeat(42), 'a'.repeat(44), `${'a'.repeat(42)}=`, `${'a'.repeat(42)}+`, `${'a'.repeat(42)} `])(
        'refuse %j',
        (value) => {
            expect(SESSION_TOKEN_PATTERN.test(value)).toBe(false)
        }
    )
})
