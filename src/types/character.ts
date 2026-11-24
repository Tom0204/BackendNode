import type { ClassStats } from './character-class'

/**
 * Personnage d'un joueur, tel que les services le manipulent (indépendant de Prisma et d'Express).
 * Les statistiques ne sont pas stockées : elles se calculent à partir de la classe et du niveau (STAT-01).
 */
export interface Character {
    /** UUID v7 généré par PostgreSQL. */
    id: string
    /** Propriétaire : toujours le compte authentifié qui l'a créé, jamais une valeur fournie par le client. */
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
    /** Nom déjà validé (CHARACTER_NAME_PATTERN, identique à la contrainte CHECK de la base). */
    name: string
}

/** Progression d'un personnage (rules.md §4) : niveau et XP acquise dans ce niveau. */
export interface CharacterProgression {
    level: number
    experience: number
}

/** Ressources courantes d'un personnage (STAT-02). */
export interface CharacterResources {
    hp: number
    mana: number
}

/**
 * Statistiques d'un personnage (STAT-01, STAT-02), toujours recalculées à partir de sa classe et de son niveau :
 * rien n'est stocké. Pas de bonus d'équipement au MVP (ITEM-05).
 */
export interface CharacterStats {
    characterId: string
    level: number
    /** Statistiques de la classe au niveau 1. */
    baseStats: ClassStats
    /** Statistiques au niveau actuel : base + gain × (niveau − 1). */
    stats: ClassStats
    /**
     * PV et mana courants. Hors combat, ils valent toujours le maximum actuel : remis au maximum après chaque combat,
     * sans régénération ni persistance au MVP (rules.md §6, STAT-05 hors MVP).
     */
    resources: CharacterResources
}
