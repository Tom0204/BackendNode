import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        // Seuls les fichiers *.test.ts du dossier tests/ sont des tests.
        include: ['tests/**/*.test.ts'],

        // Les tests base de données (tests/database/) ont leur propre configuration : npm run test:db (DB-01).
        exclude: [...configDefaults.exclude, 'tests/database/**'],

        // Les tests s'exécutent dans Node : pas de navigateur simulé (API sans Front-End).
        environment: 'node',

        // Variables d'environnement des tests, fixes et versionnées.
        // Avec la modification de environment.ts (étape A4), le fichier .env local
        // n'est pas lu en test : les tests ne dépendent pas de la machine.
        env: {
            NODE_ENV: 'test',
            // Aucun log pendant les tests : la sortie reste lisible (FND-05).
            LOG_LEVEL: 'silent'
        },

        // Restaure automatiquement, après chaque test, les variables modifiées avec vi.stubEnv().
        unstubEnvs: true,

        // Restaure automatiquement, après chaque test, les fonctions espionnées avec vi.spyOn()
        restoreMocks: true
    }
})