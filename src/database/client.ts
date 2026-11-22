import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../generated/prisma/client'

/* Accès à la base de données (DB-01, décisions : docs/architecture/database.md)
 * Un pool pg géré par l'application, transmis à l'adaptateur PrismaPg, et un seul PrismaClient.
 * Seuls les repositories utiliseront le client (à partir de DB-04).
 */

/** Délai maximal pour obtenir une connexion : évite un démarrage bloqué si la base ne répond pas. */
export const DATABASE_CONNECTION_TIMEOUT_MS = 5000

export interface Database {
    pool: Pool
    prisma: PrismaClient
}

/** Crée le pool pg et l'unique PrismaClient qui l'utilise. N'ouvre aucune connexion. */
export function createDatabase(connectionString: string): Database {
    const pool = new Pool({ connectionString, connectionTimeoutMillis: DATABASE_CONNECTION_TIMEOUT_MS })
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
    return { pool, prisma }
}

/**
 * Vérifie que la base répond (SELECT 1).
 * Rejette avec l'erreur d'origine de pg (code ECONNREFUSED, 28P01...), décrite par describeDatabaseError.
 */
export async function checkDatabaseConnection(pool: Pool): Promise<void> {
    const client = await pool.connect()
    try {
        await client.query('SELECT 1')
    } finally {
        client.release()
    }
}

/** Ferme le client puis le pool (utilisé par les tests ; arrêt propre du serveur : QUAL-06). */
export async function closeDatabase(database: Database): Promise<void> {
    await database.prisma.$disconnect()
    await database.pool.end()
}
