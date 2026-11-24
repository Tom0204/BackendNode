import type { PrismaClient } from '../../src/generated/prisma/client'
import { STARTING_ZONE_CODE } from '../../prisma/seed/reference-data'
import { TEST_DATABASE_NAME } from './test-database'

/* Données de joueurs pour les tests base de données (DB-03).
 * Séparées des données de référence (prisma/seed) : elles sont créées par les tests eux-mêmes
 * et supprimées après chaque test. Ne s'utilisent qu'avec la base mmorpg_test (tests/database/).
 */

/** Client ou transaction Prisma : les helpers fonctionnent dans les deux cas. */
type Db = Pick<PrismaClient, 'user' | 'character' | 'characterClass' | 'zone'>

let sequence = 0

/** Hash fictif : ces tests portent sur le schéma, le hachage est testé par AUTH-03. */
export const TEST_PASSWORD_HASH = 'test-password-hash'

/** Crée un utilisateur avec un email unique, en minuscules. */
export async function createTestUser(db: Db, email = `player${++sequence}@test.local`) {
    return db.user.create({ data: { name: 'Test player', email, passwordHash: TEST_PASSWORD_HASH } })
}

/** Crée un personnage dans la zone de départ ; la classe est désignée par son code. */
export async function createTestCharacter(
    db: Db,
    userId: string,
    name: string,
    options: { classCode?: string; level?: number; experience?: number } = {}
) {
    const characterClass = await db.characterClass.findUniqueOrThrow({ where: { code: options.classCode ?? 'warrior' } })
    const zone = await db.zone.findUniqueOrThrow({ where: { code: STARTING_ZONE_CODE } })
    return db.character.create({
        data: {
            userId,
            classId: characterClass.id,
            currentZoneId: zone.id,
            name,
            normalizedName: name.toLowerCase(),
            level: options.level,
            experience: options.experience
        }
    })
}

/** Client capable de nettoyer les données de joueurs (vérification de la base, puis suppressions). */
type CleanupDb = Pick<PrismaClient, '$queryRaw' | 'character' | 'user'>

/**
 * Vérifie, auprès du serveur lui-même, que la connexion vise bien mmorpg_test.
 * Seconde barrière après requireSafeTestDatabaseUrl (qui contrôle l'URL) : même si une URL mal configurée
 * ou un alias côté serveur menait ailleurs, aucune donnée d'une autre base ne serait supprimée.
 */
export async function assertConnectedToTestDatabase(db: Pick<PrismaClient, '$queryRaw'>): Promise<void> {
    const rows = await db.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`
    const name = rows[0]?.name
    if (name !== TEST_DATABASE_NAME) {
        throw new Error(`Nettoyage refusé : la connexion vise la base « ${name ?? 'inconnue'} », pas ${TEST_DATABASE_NAME}.`)
    }
}

/**
 * Supprime toutes les données de joueurs (comptes, puis par cascade personnages et sessions) ;
 * les données de référence restent en place. Refuse d'agir sur une autre base que mmorpg_test.
 */
export async function deleteAllPlayerData(db: CleanupDb): Promise<void> {
    await assertConnectedToTestDatabase(db)
    await db.character.deleteMany()
    await db.user.deleteMany()
}

/** Erreur de base de données remontée par Prisma 7 (adaptateur pg) : code SQLSTATE et message d'origine. */
export interface DatabaseViolation {
    sqlState: string | undefined
    message: string
}

// Lit meta.driverAdapterError.cause sans supposer le type de l'erreur.
export function databaseViolation(error: unknown): DatabaseViolation {
    const meta = typeof error === 'object' && error !== null && 'meta' in error ? error.meta : undefined
    const adapterError = typeof meta === 'object' && meta !== null && 'driverAdapterError' in meta ? meta.driverAdapterError : undefined
    const cause = typeof adapterError === 'object' && adapterError !== null && 'cause' in adapterError ? adapterError.cause : undefined
    const read = (key: string): string | undefined =>
        typeof cause === 'object' && cause !== null && key in cause ? String((cause as Record<string, unknown>)[key]) : undefined
    return { sqlState: read('originalCode'), message: read('originalMessage') ?? (error instanceof Error ? error.message : String(error)) }
}
