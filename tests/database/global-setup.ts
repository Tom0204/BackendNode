import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { requireSafeTestDatabaseUrl } from '../helpers/test-database'

// Avant tout test base de données (npm run test:db) : protection de la base de test,
// puis application des migrations sur mmorpg_test uniquement.
export default function setup(): void {
    const url = requireSafeTestDatabaseUrl()
    const prismaCli = resolve('node_modules/prisma/build/index.js')
    execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
        // L'URL passe par l'environnement du processus enfant, jamais par la ligne de commande.
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'inherit'
    })
}
