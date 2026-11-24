import { createHash, randomUUID } from 'node:crypto'
import type { PasswordHasher } from '../../src/services/password-hasher'

/* Hachage rapide pour les tests sans base (AUTH-03).
 * Réservé aux tests : il évite le coût volontaire d'Argon2id (19 Mio, environ 50 ms par hash) dans les centaines
 * de requêtes des tests HTTP. Comme Argon2id, il sale chaque hash et ne contient jamais le mot de passe en clair.
 * Le vrai hachage est testé à part (tests/unit/password-hasher.test.ts, tests/database/auth-api.test.ts).
 */

const PREFIX = 'fake-sha256'

const digest = (salt: string, password: string): string => createHash('sha256').update(`${salt}:${password}`).digest('hex')

export function createFakePasswordHasher(): PasswordHasher {
    return {
        async hash(password) {
            const salt = randomUUID()
            return `${PREFIX}$${salt}$${digest(salt, password)}`
        },
        async verify(passwordHash, password) {
            const [prefix, salt, expected] = passwordHash.split('$')
            return prefix === PREFIX && salt !== undefined && expected === digest(salt, password)
        }
    }
}
