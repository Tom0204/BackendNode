import { randomUUID } from 'node:crypto'
import type { CharacterClassRepository } from '../../src/repositories/character-class.repository'
import type { CharacterRepository } from '../../src/repositories/character.repository'
import { normalizeCharacterName } from '../../src/repositories/character.repository'
import { LimitReachedError, ReferenceNotFoundError, UniqueConstraintError } from '../../src/repositories/errors'
import type { UserRepository } from '../../src/repositories/user.repository'
import type { Character } from '../../src/types/character'

/* Personnages en mémoire, pour les tests sans base (CHAR-02 à CHAR-05).
 * Même contrat que le repository Prisma (tests/helpers/character-repository-contract.ts) :
 * limite par compte, nom unique sans tenir compte de la casse, références vérifiées, tri par création puis identifiant.
 * Les contrôles et l'insertion de createWithinLimit s'enchaînent sans attente intermédiaire après les lectures
 * de références : en JavaScript (un seul fil d'exécution), deux créations ne peuvent pas s'entrelacer.
 */

/** Identifiant fixe de la zone de départ dans les tests sans base. */
export const IN_MEMORY_STARTING_ZONE_ID = '00000000-0000-7000-8000-00000000c1ea'

interface StoredCharacter extends Character {
    normalizedName: string
}

const copy = ({ normalizedName: _normalizedName, ...character }: StoredCharacter): Character => ({
    ...character,
    createdAt: new Date(character.createdAt),
    updatedAt: new Date(character.updatedAt)
})

function compareCharacters(a: Character, b: Character): number {
    const byDate = a.createdAt.getTime() - b.createdAt.getTime()
    if (byDate !== 0) {
        return byDate
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function createInMemoryCharacterRepository(dependencies: {
    users: UserRepository
    classes: CharacterClassRepository
}): CharacterRepository {
    const characters = new Map<string, StoredCharacter>()
    const ownedBy = (userId: string) => [...characters.values()].filter((character) => character.userId === userId)

    return {
        async createWithinLimit({ userId, classId, name }, limit) {
            const [user, characterClass] = await Promise.all([
                dependencies.users.findById(userId),
                dependencies.classes.findById(classId)
            ])
            // À partir d'ici, aucune attente : contrôles et insertion sont atomiques.
            if (!user) {
                throw new ReferenceNotFoundError('user')
            }
            if (ownedBy(userId).length >= limit) {
                throw new LimitReachedError('characters', limit)
            }
            const normalizedName = normalizeCharacterName(name)
            if ([...characters.values()].some((character) => character.normalizedName === normalizedName)) {
                throw new UniqueConstraintError('name')
            }
            if (!characterClass) {
                throw new ReferenceNotFoundError('class')
            }
            const now = new Date()
            const character: StoredCharacter = {
                id: randomUUID(),
                userId,
                classId,
                currentZoneId: IN_MEMORY_STARTING_ZONE_ID,
                name,
                normalizedName,
                level: 1,
                experience: 0,
                createdAt: now,
                updatedAt: now
            }
            characters.set(character.id, character)
            return copy(character)
        },

        async findById(id) {
            const character = characters.get(id)
            // Un compte supprimé emporte ses personnages (comme la cascade de PostgreSQL).
            return character && (await dependencies.users.findById(character.userId)) ? copy(character) : undefined
        },

        async findAllByUserId(userId) {
            if (!(await dependencies.users.findById(userId))) {
                return []
            }
            return ownedBy(userId).map(copy).sort(compareCharacters)
        },

        async countByUserId(userId) {
            return (await dependencies.users.findById(userId)) ? ownedBy(userId).length : 0
        },

        async updateProgression(id, compute) {
            const owner = characters.get(id)?.userId
            if (!owner || !(await dependencies.users.findById(owner))) {
                return undefined
            }
            // À partir d'ici, aucune attente : lecture, calcul et écriture sont atomiques. Si compute échoue,
            // rien n'est modifié (comme l'annulation de la transaction PostgreSQL).
            const stored = characters.get(id)
            if (!stored) {
                return undefined
            }
            const result = compute({ level: stored.level, experience: stored.experience })
            const updated: StoredCharacter = { ...stored, level: result.level, experience: result.experience, updatedAt: new Date() }
            characters.set(id, updated)
            return { character: copy(updated), result }
        }
    }
}
