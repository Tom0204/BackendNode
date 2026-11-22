import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { z } from 'zod'

/* Configuration centralisée de l'application
 * Seul endroit du projet qui lit les variables d'environnement
 */

/**
 * Raison du refus d'une origine CORS, ou undefined si elle est acceptée (FND-08, précision 1).
 * Une origine acceptée est exactement « http(s)://hôte[:port] », sous la forme qu'envoient les navigateurs
 * dans l'en-tête Origin : protocole http ou https, sans identifiants, chemin, / final, paramètres ni fragment,
 * en minuscules et sans port par défaut. Le joker * est interdit.
 */
function corsOriginProblem(origin: string): string | undefined {
    if (origin === '') {
        return 'est vide'
    }
    if (origin.includes('*')) {
        return 'utilise le joker *, interdit'
    }
    let url: URL
    try {
        url = new URL(origin)
    } catch {
        return "n'est pas une URL valide (format attendu : http(s)://hôte[:port])"
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return 'doit utiliser le protocole http ou https'
    }
    // new URL() accepte aussi « http:hote » : on exige l'écriture complète « http://hote ».
    if (!origin.startsWith(`${url.protocol}//`)) {
        return "n'est pas une URL valide (format attendu : http(s)://hôte[:port])"
    }
    const authority = origin.slice(url.protocol.length + 2)
    if (authority.includes('@')) {
        return "ne doit pas contenir d'identifiants"
    }
    if (/[/?#]/.test(authority)) {
        return 'ne doit contenir ni chemin, ni / final, ni paramètres, ni fragment'
    }
    if (origin !== url.origin) {
        return 'doit être écrite sous sa forme normalisée (minuscules, sans port par défaut)'
    }
    return undefined
}

/**
 * CORS_ORIGINS : liste d'origines séparées par des virgules (espaces autour ignorés).
 * Valeur absente ou vide : undefined (comportement par défaut, voir src/config/http.ts).
 * Les messages désignent l'origine par sa position, sans recopier la valeur (règle de FND-02).
 */
const corsOriginsSchema = z
    .string()
    .optional()
    .transform((value, ctx): string[] | undefined => {
        if (value === undefined || value.trim() === '') {
            return undefined
        }
        const origins = value.split(',').map((origin) => origin.trim())
        origins.forEach((origin, index) => {
            const problem = corsOriginProblem(origin)
            if (problem) {
                ctx.addIssue({ code: 'custom', message: `l'origine n°${index + 1} ${problem}` })
            }
        })
        return origins
    })

const POSTGRES_PROTOCOLS = ['postgresql:', 'postgres:']

// Vrai si la valeur est une URL de connexion PostgreSQL lisible (postgresql://utilisateur:motdepasse@hôte:port/base).
function isPostgresUrl(value: string): boolean {
    try {
        return POSTGRES_PROTOCOLS.includes(new URL(value).protocol)
    } catch {
        return false
    }
}

/**
 * DATABASE_URL (DB-01) : facultative dans le schéma, obligatoire hors test (voir le superRefine plus bas).
 * Les tests unitaires et HTTP n'utilisent aucune base ; les tests base de données lisent TEST_DATABASE_URL.
 * Le message d'erreur ne recopie jamais la valeur, qui contient un mot de passe.
 */
const databaseUrlSchema = z
    .string()
    .refine(isPostgresUrl, 'doit être une URL PostgreSQL (postgresql://utilisateur:motdepasse@hôte:port/base)')
    .optional()

const envSchema = z
    .object({
        NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
        PORT: z.coerce
            .number()
            .int('doit être un entier')
            .min(1, 'doit être au moins 1')
            .max(65535, 'doit être au plus 65535')
            .default(4001),
        LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
        CORS_ORIGINS: corsOriginsSchema,
        DATABASE_URL: databaseUrlSchema
    })
    .superRefine((env, ctx) => {
        if (env.NODE_ENV !== 'test' && env.DATABASE_URL === undefined) {
            ctx.addIssue({
                code: 'custom',
                path: ['DATABASE_URL'],
                message: `obligatoire en ${env.NODE_ENV} (voir .env.example)`
            })
        }
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