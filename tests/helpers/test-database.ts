import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'

/* Protection de la base de test (DB-01, docs/architecture/database.md section 6).
 * Les tests base de données lisent uniquement TEST_DATABASE_URL, jamais DATABASE_URL,
 * et refusent toute base autre que mmorpg_test sur un hôte local.
 */

export const TEST_DATABASE_NAME = 'mmorpg_test'

// URL.hostname écrit l'adresse IPv6 entre crochets.
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])
const POSTGRES_PROTOCOLS = new Set(['postgresql:', 'postgres:'])

/**
 * Raisons de refus de l'URL de la base de test ; un tableau vide signifie que l'URL est sûre.
 * Fonction pure. Les messages ne recopient jamais l'URL, qui contient un mot de passe.
 */
export function testDatabaseUrlProblems(nodeEnv: string | undefined, url: string | undefined): string[] {
    const problems: string[] = []
    if (nodeEnv !== 'test') {
        problems.push('NODE_ENV doit valoir « test »')
    }
    if (url === undefined || url.trim() === '') {
        return [...problems, 'TEST_DATABASE_URL est absente']
    }
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        return [...problems, "TEST_DATABASE_URL n'est pas une URL valide"]
    }
    if (!POSTGRES_PROTOCOLS.has(parsed.protocol)) {
        problems.push('le protocole doit être postgresql://')
    }
    if (!LOCAL_HOSTNAMES.has(parsed.hostname)) {
        problems.push("l'hôte doit être localhost, 127.0.0.1 ou ::1")
    }
    // Un paramètre comme ?host=... permettrait de se connecter à un autre serveur.
    if (parsed.search !== '' || parsed.hash !== '') {
        problems.push("l'URL ne doit contenir ni paramètres ni fragment")
    }
    if (parsed.pathname !== `/${TEST_DATABASE_NAME}`) {
        problems.push(`la base doit être exactement ${TEST_DATABASE_NAME}`)
    }
    return problems
}

/** TEST_DATABASE_URL depuis l'environnement, sinon depuis le .env (seule cette clé est lue). */
export function readTestDatabaseUrl(): string | undefined {
    if (process.env.TEST_DATABASE_URL !== undefined) {
        return process.env.TEST_DATABASE_URL
    }
    const envFilePath = resolve(process.cwd(), '.env')
    if (!existsSync(envFilePath)) {
        return undefined
    }
    return parseEnv(readFileSync(envFilePath, 'utf8')).TEST_DATABASE_URL
}

/** Renvoie l'URL de la base de test, ou lève une erreur listant les raisons du refus, avant toute connexion. */
export function requireSafeTestDatabaseUrl(): string {
    const url = readTestDatabaseUrl()
    const problems = testDatabaseUrlProblems(process.env.NODE_ENV, url)
    if (url === undefined || problems.length > 0) {
        throw new Error(['Tests base de données refusés :', ...problems.map((problem) => `  - ${problem}`)].join('\n'))
    }
    return url
}
