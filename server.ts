import { env } from './src/config/environment'
import app from './src/app'
import { describeStartupError, startServer } from './src/startup'

// .then()/.catch() plutôt qu'un await au niveau supérieur :
// le build produit un fichier CommonJS (dist/server.cjs), qui n'accepte pas await hors d'une fonction.
startServer(app, env.PORT)
    .then(() => {
        console.log(`Server is running on http://localhost:${env.PORT}`)
    })
    .catch((error: unknown) => {
        // Message clair, sans trace d'appels, puis arrêt avec le code 1 (comme les erreurs de configuration).
        for (const line of describeStartupError(error, env.PORT)) {
            console.error(line)
        }
        process.exit(1)
    })