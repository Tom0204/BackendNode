import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { seedReferenceData } from '../../prisma/seed/seed'
import { closeDatabase, createDatabase } from '../../src/database/client'
import { requireSafeTestDatabaseUrl } from '../helpers/test-database'

// Avant tout test base de données (npm run test:db) : protection de la base de test,
// application des migrations, puis seed des données de référence, sur mmorpg_test uniquement.
export default async function setup(): Promise<void> {
    const url = requireSafeTestDatabaseUrl()
    const prismaCli = resolve('node_modules/prisma/build/index.js')
    execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
        // L'URL passe par l'environnement du processus enfant, jamais par la ligne de commande.
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'inherit'
    })

    // Seed idempotent : les données de référence sont présentes pour tous les tests.
    const database = createDatabase(url)
    try {
        await seedReferenceData(database.prisma)
    } finally {
        await closeDatabase(database)
    }
}
