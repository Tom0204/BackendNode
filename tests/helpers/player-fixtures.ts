import type { PrismaClient } from '../../src/generated/prisma/client'
import { STARTING_ZONE_CODE } from '../../prisma/seed/reference-data'

/* Données de joueurs pour les tests base de données (DB-03).
 * Séparées des données de référence (prisma/seed) : elles sont créées par les tests eux-mêmes
 * et supprimées après chaque test. Ne s'utilisent qu'avec la base mmorpg_test (tests/database/).
 */

/** Client ou transaction Prisma : les helpers fonctionnent dans les deux cas. */
type Db = Pick<PrismaClient, 'user' | 'character' | 'characterClass' | 'zone'>

let sequence = 0

/** Crée un utilisateur avec un email unique, en minuscules. */
export async function createTestUser(db: Db, email = `player${++sequence}@test.local`) {
    return db.user.create({ data: { name: 'Test player', email } })
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

/** Supprime toutes les données de joueurs ; les données de référence restent en place. */
export async function deleteAllPlayerData(db: Db): Promise<void> {
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
