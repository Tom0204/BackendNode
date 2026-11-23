import { STARTING_ZONE_CODE } from '../config/gameplay'
import type { PrismaClient } from '../generated/prisma/client'
import type { Character, NewCharacter } from '../types/character'
import {
    isPrismaError,
    PRISMA_FOREIGN_KEY_VIOLATION,
    PRISMA_RECORD_NOT_FOUND,
    PRISMA_UNIQUE_VIOLATION,
    ReferenceNotFoundError,
    UniqueConstraintError
} from './errors'

/**
 * Accès aux personnages (DB-04). Utilisé par les services de personnage à partir de CHAR-03.
 * Correspond au schéma et à data-model.md :
 * - normalized_name = lower(name) (CHECK), unique : un nom est unique sans tenir compte de la casse ;
 * - niveau 1 et XP 0 par défaut (valeurs de la base) ;
 * - zone courante obligatoire : la zone de départ (STARTING_ZONE_CODE), jamais une valeur fournie par le client.
 * Erreurs : nom déjà pris → UniqueConstraintError('name') ; utilisateur, classe ou zone de départ inexistants →
 * ReferenceNotFoundError. Le format du nom est validé avant l'appel (Zod en CHAR-03, CHECK en base).
 */
export interface CharacterRepository {
    create(data: NewCharacter): Promise<Character>
    findById(id: string): Promise<Character | undefined>
    /** Personnages d'un utilisateur, du plus ancien au plus récent (createdAt, puis id). */
    findAllByUserId(userId: string): Promise<Character[]>
    countByUserId(userId: string): Promise<number>
}

// Colonnes lues : les champs du type Character ; normalized_name reste interne à la base.
const CHARACTER_SELECT = {
    id: true,
    userId: true,
    classId: true,
    currentZoneId: true,
    name: true,
    level: true,
    experience: true,
    createdAt: true,
    updatedAt: true
} as const

const CHARACTER_ORDER = [{ createdAt: 'asc' }, { id: 'asc' }] as const

/** Forme normalisée d'un nom, identique à lower(name) de PostgreSQL pour les lettres A–Z autorisées. */
export function normalizeCharacterName(name: string): string {
    return name.toLowerCase()
}

export function createPrismaCharacterRepository(prisma: PrismaClient): CharacterRepository {
    return {
        async create({ userId, classId, name }) {
            try {
                return await prisma.character.create({
                    data: {
                        name,
                        normalizedName: normalizeCharacterName(name),
                        user: { connect: { id: userId } },
                        characterClass: { connect: { id: classId } },
                        currentZone: { connect: { code: STARTING_ZONE_CODE } }
                    },
                    select: CHARACTER_SELECT
                })
            } catch (error) {
                if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
                    throw new UniqueConstraintError('name')
                }
                if (isPrismaError(error, PRISMA_RECORD_NOT_FOUND) || isPrismaError(error, PRISMA_FOREIGN_KEY_VIOLATION)) {
                    throw new ReferenceNotFoundError('user, class or starting zone')
                }
                throw error
            }
        },

        async findById(id) {
            return (await prisma.character.findUnique({ where: { id }, select: CHARACTER_SELECT })) ?? undefined
        },

        findAllByUserId: (userId) =>
            prisma.character.findMany({ where: { userId }, select: CHARACTER_SELECT, orderBy: [...CHARACTER_ORDER] }),

        countByUserId: (userId) => prisma.character.count({ where: { userId } })
    }
}
