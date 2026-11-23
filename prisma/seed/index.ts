import { env } from '../../src/config/environment'
import { closeDatabase, createDatabase } from '../../src/database/client'
import { seedReferenceData } from './seed'

// Point d'entrée de « npm run db:seed » (prisma db seed, déclaré dans prisma.config.ts).
// Base visée : DATABASE_URL (validée par environment.ts). Aucune URL n'est affichée.
// Fonction async appelée avec .then() : même raison que server.ts (pas d'await au niveau supérieur).
async function main(): Promise<void> {
    if (env.DATABASE_URL === undefined) {
        throw new Error('DATABASE_URL non définie (voir .env.example).')
    }
    const database = createDatabase(env.DATABASE_URL)
    try {
        const summary = await seedReferenceData(database.prisma)
        console.info(
            `Données de référence à jour : ${summary.classes} classes, ${summary.zones} zone(s), ` +
                `${summary.monsters} monstres (${summary.zoneMonsters} affectations de zone), ` +
                `${summary.items} objets, ${summary.lootEntries} entrées de butin.`
        )
    } finally {
        await closeDatabase(database)
    }
}

main().catch((error: unknown) => {
    // Seul le code d'erreur est affiché : le message pourrait contenir des informations de connexion.
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined
    const reason = error instanceof Error && error.message.startsWith('Données de référence incohérentes') ? error.message : undefined
    console.error(`Échec du seed des données de référence${code === undefined ? '' : ` (code ${code})`}.`)
    if (reason !== undefined) {
        console.error(`  - ${reason}`)
    }
    process.exitCode = 1
})
