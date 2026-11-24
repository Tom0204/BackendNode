/* Règles des comptes et des mots de passe (AUTH-01, AUTH-03, AUTH-04). */

/** Longueur d'un mot de passe, en caractères Unicode (et non en unités UTF-16) : 15 à 128, sans règle de composition. */
export const PASSWORD_MIN_LENGTH = 15
export const PASSWORD_MAX_LENGTH = 128

/** Longueur maximale d'une adresse email (limite pratique des adresses SMTP). */
export const EMAIL_MAX_LENGTH = 254

/**
 * Paramètres Argon2id recommandés par l'OWASP : 19 Mio de mémoire, 2 passes, 1 fil.
 * Ils sont enregistrés dans chaque hash : les modifier plus tard n'invalide pas les hashs existants.
 */
export const ARGON2ID_OPTIONS = {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1
} as const
