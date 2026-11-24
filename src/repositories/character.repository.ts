import { STARTING_ZONE_CODE } from '../config/gameplay'
import type { PrismaClient } from '../generated/prisma/client'
import type { Character, NewCharacter } from '../types/character'
import {
    isPrismaError,
    LimitReachedError,
    PRISMA_FOREIGN_KEY_VIOLATION,
    PRISMA_UNIQUE_VIOLATION,
    ReferenceNotFoundError,
    UniqueConstraintError
} from './errors'

/**
 * Accès aux personnages (DB-04, CHAR-02 à CHAR-05).
 * Correspond au schéma et à data-model.md :
 * - normalized_name = lower(name) (CHECK), unique : un nom est unique sans tenir compte de la casse ;
 * - niveau 1 et XP 0 par défaut (valeurs de la base) ;
 * - zone courante obligatoire : la zone de départ (STARTING_ZONE_CODE), jamais une valeur fournie par le client.
 *
 * La création n'existe que sous une forme : createWithinLimit, qui respecte la limite de personnages par compte
 * de façon atomique. Aucune autre méthode d'écriture ne permet de la contourner.
 */
export interface CharacterRepository {
    /**
     * Crée un personnage si le compte en possède moins de `limit`, dans une seule transaction :
     * verrou sur la ligne du compte, comptage, puis insertion. Deux créations simultanées pour un même compte
     * s'exécutent donc l'une après l'autre ; un échec annule tout (aucun personnage partiel).
     * Erreurs : LimitReachedError ; nom déjà pris → UniqueConstraintError('name') ;
     * compte ou classe inexistants → ReferenceNotFoundError('user' | 'class').
     */
    createWithinLimit(data: NewCharacter, limit: number): Promise<Character>
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
        createWithinLimit({ userId, classId, name }, limit) {
            return prisma.$transaction(async (tx) => {
                // Verrou sur la ligne du compte jusqu'à la fin de la transaction : les créations concurrentes
                // d'un même compte attendent ici, puis comptent les personnages déjà validés.
                const owner = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`
                if (owner.length === 0) {
                    throw new ReferenceNotFoundError('user')
                }
                if ((await tx.character.count({ where: { userId } })) >= limit) {
                    throw new LimitReachedError('characters', limit)
                }
                const startingZone = await tx.zone.findUnique({ where: { code: STARTING_ZONE_CODE }, select: { id: true } })
                if (!startingZone) {
                    // Donnée de référence absente (seed non exécuté) : erreur de configuration, 500.
                    throw new Error(`Zone de départ « ${STARTING_ZONE_CODE} » absente : lancer npm run db:seed`)
                }
                try {
                    return await tx.character.create({
                        data: {
                            userId,
                            classId,
                            currentZoneId: startingZone.id,
                            name,
                            normalizedName: normalizeCharacterName(name)
                        },
                        select: CHARACTER_SELECT
                    })
                } catch (error) {
                    if (isPrismaError(error, PRISMA_UNIQUE_VIOLATION)) {
                        throw new UniqueConstraintError('name')
                    }
                    if (isPrismaError(error, PRISMA_FOREIGN_KEY_VIOLATION)) {
                        throw new ReferenceNotFoundError('class')
                    }
                    throw error
                }
            })
        },

        async findById(id) {
            return (await prisma.character.findUnique({ where: { id }, select: CHARACTER_SELECT })) ?? undefined
        },

        findAllByUserId: (userId) =>
            prisma.character.findMany({ where: { userId }, select: CHARACTER_SELECT, orderBy: [...CHARACTER_ORDER] }),

        countByUserId: (userId) => prisma.character.count({ where: { userId } })
    }
}
