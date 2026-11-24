import type { CharacterRepository } from '../repositories/character.repository'
import type { Character } from '../types/character'
import { notFound } from '../utils/http-error'
import { applyExperienceGain, assertValidExperienceGain } from './experience'

/* Attribution d'expérience (STAT-04). Fonction métier interne : aucune route publique ou protégée ne l'expose,
 * le client ne peut jamais fixer ni augmenter lui-même son niveau ou son XP. Elle sera appelée par les récompenses
 * calculées par le serveur (REWARD-02), qui pourra l'intégrer à sa propre transaction en réutilisant
 * applyExperienceGain (décision D7 du lot L4). Indépendante d'Express.
 */

/** Résultat d'une attribution : le personnage enregistré et le nombre de niveaux gagnés. */
export interface ExperienceGrant {
    character: Character
    levelsGained: number
}

export interface ProgressionServiceDependencies {
    characterRepository: CharacterRepository
}

export function createProgressionService({ characterRepository }: ProgressionServiceDependencies) {
    return {
        /**
         * Ajoute `amount` points d'XP à un personnage, de façon atomique (verrou, calcul et écriture dans une seule
         * transaction) : plusieurs niveaux peuvent être gagnés ; au niveau maximal, le gain est ignoré.
         * Les statistiques suivent automatiquement : elles sont recalculées à partir du niveau à chaque lecture.
         * Gain invalide (non entier, non sûr, < 1) : RangeError, erreur de programmation (500), jamais une erreur client.
         * Personnage inexistant : 404 CHARACTER_NOT_FOUND.
         */
        async grantExperience(characterId: string, amount: number): Promise<ExperienceGrant> {
            // Vérifié avant d'ouvrir une transaction ; applyExperienceGain le vérifie aussi.
            assertValidExperienceGain(amount)
            const update = await characterRepository.updateProgression(characterId, (current) => applyExperienceGain(current, amount))
            if (!update) {
                throw notFound('CHARACTER_NOT_FOUND', 'Character not found')
            }
            return { character: update.character, levelsGained: update.result.levelsGained }
        }
    }
}

export type ProgressionService = ReturnType<typeof createProgressionService>
