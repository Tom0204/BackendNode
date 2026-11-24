/* Constantes de jeu utilisées par le code applicatif (docs/gameplay/rules.md).
 * Les données de référence (classes, zones, monstres) sont en base, remplies par le seed (prisma/seed).
 */

/** Code de la zone de départ (rules.md §8), attribuée à tout nouveau personnage. */
export const STARTING_ZONE_CODE = 'clearing'

/** Nombre maximal de personnages par compte (rules.md §3, CHAR-02). */
export const MAX_CHARACTERS_PER_ACCOUNT = 5

/**
 * Format d'un nom de personnage (rules.md §3, CHAR-02) : 3 à 16 lettres ASCII, sans accent, espace ni chiffre.
 * Identique, caractère pour caractère, à la contrainte SQL characters_name_format_check (migration init) ;
 * un test PostgreSQL vérifie que l'API et la base acceptent et refusent exactement les mêmes noms.
 */
export const CHARACTER_NAME_PATTERN = /^[A-Za-z]{3,16}$/

/** Niveau maximal d'un personnage (rules.md §4 et §9), identique à la contrainte SQL characters_level_check (1 à 10). */
export const MAX_LEVEL = 10

/** Courbe d'expérience (rules.md §4 et §9) : xpRequise(n) = arrondi(XP_CURVE_BASE × n ^ XP_CURVE_EXPONENT). */
export const XP_CURVE_BASE = 100
export const XP_CURVE_EXPONENT = 1.5
