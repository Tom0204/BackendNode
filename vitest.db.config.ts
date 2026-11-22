import { defineConfig } from 'vitest/config'

// Tests base de données (npm run test:db), séparés de npm test qui reste sans base.
// Nécessitent PostgreSQL démarré (npm run db:up) et TEST_DATABASE_URL (environnement ou .env).
export default defineConfig({
    test: {
        include: ['tests/database/**/*.test.ts'],
        environment: 'node',
        env: {
            NODE_ENV: 'test',
            LOG_LEVEL: 'silent'
        },
        // Protection de la base de test et migrations, avant tout test.
        globalSetup: ['tests/database/global-setup.ts'],
        // Une seule base partagée : les fichiers de test s'exécutent l'un après l'autre.
        fileParallelism: false,
        unstubEnvs: true,
        restoreMocks: true
    }
})
