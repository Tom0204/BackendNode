import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

/* Configuration centralisée de l'application
 * Seul endroit projet qui lit les variables d'environnement
*/

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce
        .number()
        .int('doit être un entier')
        .min(1, 'doit être au moins 1')
        .max(65535, 'doit être au plus 65535')
        .default(4001)
})

export type Env = z.infer<typeof envSchema>

// Affiche un message d'erreur puis arrête le processus
function fail(problems: string[]): never {
    console.error('Configuration invalide : le serveur ne peut pas démarrer.')
    for (const problem of problems) {
        console.error(`  - ${problem}`)
    }
    console.error("Corrigez les variables d'environnement ou le fichier .env (voir .env.example).")
    process.exit(1)
}

// Charge .env uniquement si existe (absence n'est pas une erreur)
// Variables déjà définies dans l'environnement du système sont pas écrasées par le .env (natif de Node)
function loadDotEnvIfPresent(): void {
    const envFilePath = resolve(process.cwd(), '.env')
    if (!existsSync(envFilePath)) {
        return
    }
    try {
        process.loadEnvFile(envFilePath)
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        fail([`.env : lecture impossible (${reason})`])
    }
}

function loadEnvironment(): Env {
    loadDotEnvIfPresent()

    const result = envSchema.safeParse(process.env)
    if (!result.success) {
        // Seuls le nom de la variable et la raison sont affichés, jamais les valeurs.
        return fail(
            result.error.issues.map((issue) => `${issue.path.map(String).join('.')} : ${issue.message}`)
        )
    }
    return result.data
}

export const env: Env = loadEnvironment()