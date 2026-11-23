/**
 * Personnage d'un joueur, tel que les services le manipulent (indépendant de Prisma et d'Express).
 * Les statistiques ne sont pas stockées : elles se calculent à partir de la classe et du niveau (STAT-01).
 */
export interface Character {
    /** UUID v7 généré par PostgreSQL. */
    id: string
    userId: string
    classId: string
    currentZoneId: string
    name: string
    level: number
    /** XP acquise dans le niveau courant. */
    experience: number
    createdAt: Date
    updatedAt: Date
}

/** Données fournies pour créer un personnage : le reste (niveau, XP, zone de départ) est fixé côté serveur. */
export interface NewCharacter {
    userId: string
    classId: string
    /** Nom déjà validé (3 à 16 lettres A–Z ou a–z, contrainte CHECK de la base). */
    name: string
}
