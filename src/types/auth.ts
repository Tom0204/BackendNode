import type { User, UserRole } from './user'

/**
 * Utilisateur authentifié, tel que les services le reçoivent (AUTH-07).
 * Construit par le serveur à partir du jeton, jamais à partir de données fournies par le client.
 * Indépendant d'Express : réutilisable par un autre transport (WebSocket).
 */
export interface AuthContext {
    userId: string
    role: UserRole
    /** Session utilisée par la requête : c'est elle que la déconnexion révoque (AUTH-10). */
    sessionId: string
}

/** Session de connexion telle que les services la manipulent (AUTH-05). Le jeton n'y figure jamais. */
export interface Session {
    id: string
    userId: string
    createdAt: Date
    expiresAt: Date
    /** Date de déconnexion, ou null tant que la session n'est pas révoquée. */
    revokedAt: Date | null
}

/** Données d'une nouvelle session : seule l'empreinte du jeton est enregistrée. */
export interface NewSession {
    userId: string
    tokenHash: string
    expiresAt: Date
}

/** Session et compte associé, lus ensemble pour authentifier une requête. */
export interface SessionWithUser {
    session: Session
    user: User
}

/** Résultat d'une connexion réussie (AUTH-06). */
export interface LoginResult {
    /** Jeton opaque, renvoyé une seule fois au client : le serveur n'en garde que l'empreinte. */
    token: string
    expiresAt: Date
    user: User
}
