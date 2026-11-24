import type { Character, CharacterResources, CharacterStats } from '../types/character'
import type { CharacterClass, ClassStats } from '../types/character-class'

/* Formes publiques des classes, des personnages et de leurs statistiques (CHAR-01, CHAR-04, CHAR-05, STAT-02) :
 * listes blanches de champs. */

/** Classe telle que renvoyée par l'API (D1 du lot L3), sans dates. */
export interface CharacterClassResponse {
    id: string
    code: string
    name: string
    baseStats: ClassStats
    statsPerLevel: ClassStats
}

export function toCharacterClassResponse(characterClass: CharacterClass): CharacterClassResponse {
    return {
        id: characterClass.id,
        code: characterClass.code,
        name: characterClass.name,
        baseStats: { ...characterClass.baseStats },
        statsPerLevel: { ...characterClass.statsPerLevel }
    }
}

/**
 * Personnage tel que renvoyé par l'API, identique en liste et en détail (D3 du lot L3).
 * Ni propriétaire (userId), ni nom normalisé, ni date de modification.
 */
export interface CharacterResponse {
    id: string
    name: string
    classId: string
    level: number
    experience: number
    currentZoneId: string
    /** Date ISO 8601 en UTC (conventions §10). */
    createdAt: string
}

export function toCharacterResponse(character: Character): CharacterResponse {
    return {
        id: character.id,
        name: character.name,
        classId: character.classId,
        level: character.level,
        experience: character.experience,
        currentZoneId: character.currentZoneId,
        createdAt: character.createdAt.toISOString()
    }
}

/**
 * Statistiques d'un personnage (STAT-02, décision D3 du lot L4) : statistiques de la classe au niveau 1,
 * statistiques au niveau actuel et ressources courantes, clairement séparées.
 */
export interface CharacterStatsResponse {
    characterId: string
    level: number
    baseStats: ClassStats
    stats: ClassStats
    resources: CharacterResources
}

export function toCharacterStatsResponse(characterStats: CharacterStats): CharacterStatsResponse {
    return {
        characterId: characterStats.characterId,
        level: characterStats.level,
        baseStats: { ...characterStats.baseStats },
        stats: { ...characterStats.stats },
        resources: { hp: characterStats.resources.hp, mana: characterStats.resources.mana }
    }
}
