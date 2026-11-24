import type { CharacterClassRepository } from '../repositories/character-class.repository'
import type { CharacterClass } from '../types/character-class'
import { notFound } from '../utils/http-error'

/** Classe inconnue désignée dans l'URL (404). Le même code est renvoyé en 422 quand la classe est citée dans un corps. */
export const classNotFoundInUrl = () => notFound('CLASS_NOT_FOUND', 'Class not found')

/** Catalogue public des classes (CHAR-01) : lecture seule, données de référence. */
export function createCharacterClassService(repository: CharacterClassRepository) {
    return {
        getAll: (): Promise<CharacterClass[]> => repository.findAll(),

        async getById(id: string): Promise<CharacterClass> {
            const characterClass = await repository.findById(id)
            if (!characterClass) {
                throw classNotFoundInUrl()
            }
            return characterClass
        }
    }
}

export type CharacterClassService = ReturnType<typeof createCharacterClassService>
