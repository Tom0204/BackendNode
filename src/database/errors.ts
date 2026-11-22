import { systemErrorCode } from '../startup'

/** Première ligne de tout message d'échec de connexion à la base au démarrage. */
const DATABASE_FAILURE_TITLE = 'Le serveur ne peut pas démarrer : base de données inaccessible.'

/**
 * Construit les lignes du message affiché quand la base est inaccessible au démarrage.
 * Fonction pure : elle n'affiche rien.
 * Seul le code d'erreur est repris : jamais le message de l'erreur, la trace d'appels ni l'URL de connexion,
 * qui pourraient contenir des informations sensibles.
 */
export function describeDatabaseError(error: unknown): string[] {
    const code = systemErrorCode(error)

    switch (code) {
        case 'ECONNREFUSED':
            return [
                DATABASE_FAILURE_TITLE,
                '  - Connexion refusée : PostgreSQL ne semble pas démarré.',
                "Démarrez la base avec « npm run db:up » (Docker Desktop requis), puis vérifiez l'hôte et le port de DATABASE_URL."
            ]
        case 'ENOTFOUND':
            return [
                DATABASE_FAILURE_TITLE,
                '  - Hôte de la base introuvable.',
                "Vérifiez l'hôte de DATABASE_URL (voir .env.example)."
            ]
        case '28P01':
            return [
                DATABASE_FAILURE_TITLE,
                '  - Authentification refusée par PostgreSQL.',
                "Vérifiez l'utilisateur et le mot de passe de DATABASE_URL (identiques à POSTGRES_USER et POSTGRES_PASSWORD)."
            ]
        case '3D000':
            return [
                DATABASE_FAILURE_TITLE,
                "  - La base indiquée dans DATABASE_URL n'existe pas.",
                'Vérifiez le nom de la base (mmorpg_dev en local).'
            ]
        default:
            return [
                DATABASE_FAILURE_TITLE,
                `  - Erreur inattendue lors de la connexion à la base${code === undefined ? '' : ` (code ${code})`}.`,
                "Vérifiez DATABASE_URL et l'état de PostgreSQL (voir .env.example)."
            ]
    }
}
