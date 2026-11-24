import { MAX_CHARACTERS_PER_ACCOUNT } from '../config/gameplay'
import type { CharacterClassRepository } from '../repositories/character-class.repository'
import type { CharacterRepository } from '../repositories/character.repository'
import { isLimitReachedError, isReferenceNotFoundError, isUniqueConstraintError } from '../repositories/errors'
import type { AuthContext } from '../types/auth'
import type { Character } from '../types/character'
import { businessRuleViolation, conflict, notFound, unauthenticated } from '../utils/http-error'

/* Personnages des joueurs (CHAR-02 à CHAR-05). Indépendant d'Express : réutilisable par un autre transport.
 * Règles de propriété :
 * - le propriétaire est toujours l'utilisateur authentifié (actor.userId), jamais une valeur fournie par le client ;
 * - un personnage n'est visible que par son propriétaire, sans exception pour les administrateurs (D2 du lot L3) ;
 * - un personnage inexistant et celui d'un autre joueur donnent la même réponse : 404 CHARACTER_NOT_FOUND.
 */

const characterNotFound = () => notFound('CHARACTER_NOT_FOUND', 'Character not found')
// Classe citée dans le corps de la requête : 422 (conventions §5.2), et non 404.
const classNotFoundInBody = () => businessRuleViolation('CLASS_NOT_FOUND', 'Class not found')
const characterLimitReached = () => conflict('CHARACTER_LIMIT_REACHED', 'Character limit reached')
const characterNameTaken = () => conflict('CHARACTER_NAME_TAKEN', 'Character name already taken')

/** Données de création, déjà validées par le schéma de la route (nom, format de classId). */
export interface CreateCharacterInput {
    name: string
    classId: string
}

export interface CharacterServiceDependencies {
    characterRepository: CharacterRepository
    characterClassRepository: CharacterClassRepository
}

export function createCharacterService({ characterRepository, characterClassRepository }: CharacterServiceDependencies) {
    return {
        /**
         * Crée un personnage pour l'utilisateur authentifié (CHAR-03).
         * Ordre des contrôles : classe existante (422), puis limite par compte (409), puis nom disponible (409).
         * Niveau 1, XP 0 et zone de départ sont fixés par le serveur ; la création passe obligatoirement par
         * createWithinLimit, qui applique la limite dans une transaction.
         */
        async create(actor: AuthContext, input: CreateCharacterInput): Promise<Character> {
            if (!(await characterClassRepository.findById(input.classId))) {
                throw classNotFoundInBody()
            }
            try {
                return await characterRepository.createWithinLimit(
                    { userId: actor.userId, classId: input.classId, name: input.name },
                    MAX_CHARACTERS_PER_ACCOUNT
                )
            } catch (error) {
                if (isLimitReachedError(error)) {
                    throw characterLimitReached()
                }
                if (isUniqueConstraintError(error)) {
                    throw characterNameTaken()
                }
                if (isReferenceNotFoundError(error)) {
                    // Classe supprimée entre le contrôle et l'insertion, ou compte supprimé pendant la requête.
                    throw error.reference === 'class' ? classNotFoundInBody() : unauthenticated()
                }
                throw error
            }
        },

        /** Personnages de l'utilisateur authentifié uniquement (CHAR-04) ; tableau vide s'il n'en a aucun. */
        listMine: (actor: AuthContext): Promise<Character[]> => characterRepository.findAllByUserId(actor.userId),

        /** Détail d'un personnage (CHAR-05) : son propriétaire seulement, sinon 404 comme s'il n'existait pas. */
        async getById(actor: AuthContext, id: string): Promise<Character> {
            const character = await characterRepository.findById(id)
            if (!character || character.userId !== actor.userId) {
                throw characterNotFound()
            }
            return character
        }
    }
}

export type CharacterService = ReturnType<typeof createCharacterService>
