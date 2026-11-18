import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

/* Configuration centralisée de l'application
 * Seul endroit du projet qui lit les variables d'environnement
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

/** Variables d'environnement à valider (process.env ou un objet construit, par exemple dans un test). */
export type EnvironmentSource = Record<string, string | undefined>

/** Résultat de la validation : la configuration, ou la liste des problèmes détectés. */
export type ParseEnvironmentResult =
    | { success: true; env: Env }
    | { success: false; problems: string[] }

/**
 * Valide un ensemble de variables d'environnement.
 * Fonction pure : elle ne lit pas process.env, ne charge aucun fichier et n'arrête pas le processus.
 * Elle peut donc être testée en lui passant un simple objet.
 */
export function parseEnvironment(source: EnvironmentSource): ParseEnvironmentResult {
    const result = envSchema.safeParse(source)
    if (!result.success) {
        // Seuls le nom de la variable et la raison sont conservés, jamais les valeurs.
        const problems = result.error.issues.map(
            (issue) => `${issue.path.map(String).join('.')} : ${issue.message}`
        )
        return { success: false, problems }
    }
    return { success: true, env: result.data }
}

// Affiche un message d'erreur puis arrête le processus
function fail(problems: string[]): never {
    console.error('Configuration invalide : le serveur ne peut pas démarrer.')
    for (const problem of problems) {
        console.error(`  - ${problem}`)
    }
    console.error("Corrigez les variables d'environnement ou le fichier .env (voir .env.example).")
    process.exit(1)
}

// Charge .env uniquement s'il existe (son absence n'est pas une erreur).
// Les variables déjà définies dans l'environnement du système ne sont pas écrasées par le .env (natif de Node).
// En test (NODE_ENV=test), le .env local n'est jamais chargé : les tests ne dépendent pas de la machine.
function loadDotEnvIfPresent(): void {
    if (process.env.NODE_ENV === 'test') {
        return
    }
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

    const result = parseEnvironment(process.env)
    if (!result.success) {
        return fail(result.problems)
    }
    return result.env
}

export const env: Env = loadEnvironment()