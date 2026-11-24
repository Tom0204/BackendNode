import { env } from '../config/environment'
import { closeDatabase, createDatabase } from '../database/client'
import { createPrismaUserRepository } from '../repositories/user.repository'
import { EXIT_FAILURE, runAccountCommand } from './account-command'

// Point d'entrée de « npm run account -- <action> <email> » (D8 du lot L2).
// Base visée : DATABASE_URL (validée par environment.ts). Aucune URL ni aucun message d'erreur brut n'est affiché.
// Fonction async appelée avec .then() : même raison que server.ts (pas d'await au niveau supérieur).
async function main(): Promise<number> {
    if (env.DATABASE_URL === undefined) {
        console.error('DATABASE_URL non définie (voir .env.example).')
        return EXIT_FAILURE
    }
    const database = createDatabase(env.DATABASE_URL)
    try {
        return await runAccountCommand(process.argv.slice(2), createPrismaUserRepository(database.prisma), {
            info: (message) => console.info(message),
            error: (message) => console.error(message)
        })
    } finally {
        await closeDatabase(database)
    }
}

main().then(
    (code) => {
        process.exitCode = code
    },
    (error: unknown) => {
        // Seul le code d'erreur est affiché : le message pourrait contenir des informations de connexion.
        const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : undefined
        console.error(`Échec de la commande de compte${code === undefined ? '' : ` (code ${code})`}.`)
        process.exitCode = EXIT_FAILURE
    }
)
