import { describe, expect, it } from 'vitest'
import { createArgon2PasswordHasher } from '../../src/services/password-hasher'

/* Hachage Argon2id réel (AUTH-03) : bibliothèque argon2, paramètres de src/config/auth.ts. */

const hasher = createArgon2PasswordHasher()
const PASSWORD = 'correct horse battery staple'

describe('createArgon2PasswordHasher', () => {
    it('produit un hash Argon2id avec les paramètres retenus (19 Mio, 2 passes, 1 fil)', async () => {
        const hash = await hasher.hash(PASSWORD)
        expect(hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
        expect(hash).not.toContain(PASSWORD)
    })

    it('le même mot de passe donne deux hashs différents (sel aléatoire)', async () => {
        const [first, second] = await Promise.all([hasher.hash(PASSWORD), hasher.hash(PASSWORD)])
        expect(first).not.toBe(second)
    })

    it('verify : vrai pour le bon mot de passe, faux pour un autre (même casse près)', async () => {
        const hash = await hasher.hash(PASSWORD)
        expect(await hasher.verify(hash, PASSWORD)).toBe(true)
        expect(await hasher.verify(hash, 'wrong horse battery staple')).toBe(false)
        expect(await hasher.verify(hash, PASSWORD.toUpperCase())).toBe(false)
        expect(await hasher.verify(hash, `${PASSWORD} `)).toBe(false)
    })

    it('accepte un mot de passe Unicode de 128 caractères', async () => {
        const password = 'é🐉'.repeat(64)
        expect(await hasher.verify(await hasher.hash(password), password)).toBe(true)
    })
})
