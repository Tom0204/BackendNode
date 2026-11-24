import { createHash, randomBytes } from 'node:crypto'

/* Jetons de session opaques (AUTH-05, décision D1 du lot L2).
 * - 32 octets aléatoires (256 bits) issus du générateur cryptographique de Node, encodés en base64url (43 caractères).
 * - Seule l'empreinte SHA-256 est stockée : une fuite de la table sessions ne donne aucun jeton utilisable.
 *   Un hachage lent (Argon2) est inutile ici : le jeton est aléatoire, il ne peut pas être deviné par dictionnaire.
 * - Le jeton ne contient aucune donnée : ni identifiant, ni rôle, ni date.
 */

const TOKEN_BYTES = 32

/** Format exact d'un jeton émis par le serveur : tout autre format est refusé sans lecture en base. */
export const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/

export function generateSessionToken(): string {
    return randomBytes(TOKEN_BYTES).toString('base64url')
}

/** Empreinte SHA-256 en hexadécimal minuscule (64 caractères), seule forme enregistrée en base. */
export function hashSessionToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}
