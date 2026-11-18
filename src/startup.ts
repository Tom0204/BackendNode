import { createServer, type RequestListener, type Server } from 'node:http'

/** Première ligne de tout message d'échec du démarrage (même forme que les erreurs de configuration de FND-02). */
const STARTUP_FAILURE_TITLE = 'Le serveur ne peut pas démarrer.'

/**
 * Démarre le serveur HTTP sur le port demandé.
 * - La promesse est résolue uniquement quand le port est réellement ouvert (événement « listening »).
 * - Elle est rejetée avec l'erreur système d'origine (code EADDRINUSE, EACCES...) si l'ouverture échoue.
 * - Les deux écouteurs temporaires sont retirés dès que l'un d'eux se déclenche : après le démarrage,
 *   réussi ou non, aucun écouteur ajouté par cette fonction ne reste attaché au serveur.
 * Aucun affichage ni arrêt du processus ici : c'est le rôle de server.ts. La fonction reste donc testable.
 */
export function startServer(app: RequestListener, port: number): Promise<Server> {
    return new Promise((resolve, reject) => {
        const server = createServer(app)

        const onListening = (): void => {
            server.removeListener('error', onError)
            resolve(server)
        }

        const onError = (error: Error): void => {
            server.removeListener('listening', onListening)
            reject(error)
        }

        // Écouteurs attachés AVANT listen() : aucun événement ne peut être manqué.
        server.once('listening', onListening)
        server.once('error', onError)
        server.listen(port)
    })
}

// Lit le code d'une erreur système (EADDRINUSE, EACCES...) sans supposer le type de la valeur reçue.
function systemErrorCode(error: unknown): string | undefined {
    if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
        return error.code
    }
    return undefined
}

/**
 * Construit les lignes du message affiché quand le démarrage échoue.
 * Fonction pure : elle n'affiche rien. Elle ne reprend jamais la trace d'appels (stack),
 * seulement le code et le message système pour une erreur inattendue.
 */
export function describeStartupError(error: unknown, port: number): string[] {
    const code = systemErrorCode(error)

    if (code === 'EADDRINUSE') {
        return [
            STARTUP_FAILURE_TITLE,
            `  - Le port ${port} est déjà utilisé par un autre processus.`,
            'Arrêtez ce processus ou choisissez un autre port avec la variable PORT (voir .env.example).'
        ]
    }

    if (code === 'EACCES') {
        return [
            STARTUP_FAILURE_TITLE,
            `  - Accès refusé au port ${port} (port réservé par le système ou nécessitant des droits administrateur).`,
            'Choisissez un autre port avec la variable PORT, en évitant les ports réservés par le système (voir .env.example).'
        ]
    }

    const systemMessage = error instanceof Error ? error.message : undefined
    const details = [code, systemMessage].filter((part) => part !== undefined && part !== '').join(' ')

    return [
        STARTUP_FAILURE_TITLE,
        `  - Erreur inattendue lors de l'ouverture du port ${port}${details === '' ? '' : ` : ${details}`}`,
        'Vérifiez la configuration réseau et la variable PORT (voir .env.example).'
    ]
}