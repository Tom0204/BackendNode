/** Compte joueur, tel que les services le manipulent (indépendant de Prisma et d'Express). */
export interface User {
    /** UUID v7 généré par PostgreSQL. */
    id: string
    name: string
    /** Toujours en minuscules (normalisé par le service, imposé par la base). */
    email: string
    createdAt: Date
    updatedAt: Date
}

/** Champs d'un utilisateur fournis à la création ou à la modification. */
export interface UserData {
    name: string
    email: string
}
