import { existsSync } from 'node:fs'
import { defineConfig } from 'prisma/config'

// Configuration de la CLI Prisma (DB-01).
// Prisma 7 ne charge pas le .env : même méthode que src/config/environment.ts, sans dotenv.
// Une variable déjà définie n'est pas écrasée : les tests base de données imposent ainsi
// DATABASE_URL = URL de la base de test (tests/database/global-setup.ts).
if (existsSync('.env')) {
    process.loadEnvFile('.env')
}

export default defineConfig({
    schema: 'prisma/schema.prisma',
    migrations: { path: 'prisma/migrations' },
    datasource: { url: process.env.DATABASE_URL }
})
