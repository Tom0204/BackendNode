import argon2 from 'argon2'
import { ARGON2ID_OPTIONS } from '../config/auth'

/**
 * Hachage des mots de passe (AUTH-03). Les services reçoivent cette interface :
 * Argon2id en production, une version rapide dans les tests sans base.
 * Le mot de passe n'est jamais journalisé ni renvoyé.
 */
export interface PasswordHasher {
    /** Hash avec un sel aléatoire : deux appels avec le même mot de passe donnent deux hashs différents. */
    hash(password: string): Promise<string>
    /** Vérifie un mot de passe avec la fonction de la bibliothèque (comparaison en temps constant). */
    verify(passwordHash: string, password: string): Promise<boolean>
}

export function createArgon2PasswordHasher(): PasswordHasher {
    return {
        hash: (password) => argon2.hash(password, { type: argon2.argon2id, ...ARGON2ID_OPTIONS }),
        verify: (passwordHash, password) => argon2.verify(passwordHash, password)
    }
}
