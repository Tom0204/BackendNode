import type { AuthContext } from './auth'

/* Contexte d'authentification ajouté à la requête Express par requireAuth (AUTH-07).
 * Absent sur les routes publiques ; les controllers des routes protégées le lisent avec getAuth().
 */
declare module 'express-serve-static-core' {
    interface Request {
        auth?: AuthContext
    }
}

export {}
