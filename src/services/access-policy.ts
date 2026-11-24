import type { AuthContext } from '../types/auth'

/* Règles d'accès aux ressources (AUTH-08). Les services les appliquent eux-mêmes : une route mal protégée
 * ne suffit pas à ouvrir un accès, et un autre transport (WebSocket) appliquera les mêmes règles.
 */

export function isAdmin(actor: AuthContext): boolean {
    return actor.role === 'ADMIN'
}

/**
 * Un compte est accessible à son propriétaire et aux administrateurs.
 * Un refus est traité comme une ressource inexistante (404, conventions §5.3) : le joueur n'apprend pas
 * si l'identifiant existe.
 */
export function canAccessUser(actor: AuthContext, userId: string): boolean {
    return isAdmin(actor) || actor.userId === userId
}
