/** Valeurs des cinq statistiques d'une classe (rules.md §2). */
export interface ClassStats {
    hp: number
    mana: number
    attack: number
    defense: number
    speed: number
}

/**
 * Classe jouable : donnée de référence, remplie par le seed et jamais modifiée par l'API (CHAR-01).
 * stat(niveau) = baseStats + statsPerLevel × (niveau − 1) : le calcul relève de STAT-01.
 */
export interface CharacterClass {
    /** UUID v7 : identifiant contractuel de l'API. */
    id: string
    /** Identifiant stable et lisible (warrior, mage, rogue), utilisé par le seed. */
    code: string
    name: string
    /** Statistiques au niveau 1. */
    baseStats: ClassStats
    /** Gain par niveau. */
    statsPerLevel: ClassStats
}
