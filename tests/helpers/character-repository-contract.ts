import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAX_CHARACTERS_PER_ACCOUNT } from '../../src/config/gameplay'
import type { CharacterClassRepository } from '../../src/repositories/character-class.repository'
import type { CharacterRepository } from '../../src/repositories/character.repository'
import { isLimitReachedError, isReferenceNotFoundError, isUniqueConstraintError } from '../../src/repositories/errors'
import type { UserRepository } from '../../src/repositories/user.repository'
import type { User } from '../../src/types/user'
import { newUser, UNKNOWN_USER_ID } from './user-repository-contract'

/* Contrat d'un repository de personnages (CHAR-02 à CHAR-05).
 * Même suite sur le repository en mémoire (npm test) et sur le repository Prisma (npm run test:db).
 */

/** UUID valide qui ne désigne aucun personnage ni aucune classe. */
export const UNKNOWN_ID = '00000000-0000-7000-8000-0000000000ff'

const NAMES = ['Arthas', 'Jaina', 'Thrall', 'Sylvanas', 'Uther', 'Varian', 'Anduin']

export interface CharacterRepositories {
    characters: CharacterRepository
    users: UserRepository
    classes: CharacterClassRepository
    /** Identifiant de la zone de départ attendu pour tout nouveau personnage. */
    startingZoneId: () => Promise<string>
}

export function describeCharacterRepositoryContract(label: string, getRepositories: () => CharacterRepositories): void {
    describe(`Contrat CharacterRepository : ${label}`, () => {
        let repositories: CharacterRepositories
        let owner: User
        let classId: string

        beforeEach(async () => {
            repositories = getRepositories()
            owner = await repositories.users.create(newUser('Owner', 'owner@test.local'))
            classId = (await repositories.classes.findAll())[0]?.id ?? ''
        })

        const create = (name: string, userId = owner.id, limit = MAX_CHARACTERS_PER_ACCOUNT) =>
            repositories.characters.createWithinLimit({ userId, classId, name }, limit)

        it('createWithinLimit : niveau 1, XP 0, zone de départ, nom tel que saisi, sans nom normalisé', async () => {
            const character = await create('Arthas')
            expect(character).toMatchObject({
                userId: owner.id,
                classId,
                name: 'Arthas',
                level: 1,
                experience: 0,
                currentZoneId: await repositories.startingZoneId()
            })
            expect(Object.keys(character).sort()).toEqual([
                'classId',
                'createdAt',
                'currentZoneId',
                'experience',
                'id',
                'level',
                'name',
                'updatedAt',
                'userId'
            ])
            expect(await repositories.characters.findById(character.id)).toEqual(character)
        })

        it('nom déjà pris, quelle que soit la casse et le compte : UniqueConstraintError("name"), rien de créé', async () => {
            const other = await repositories.users.create(newUser('Other', 'other@test.local'))
            await create('Arthas')
            const error = await create('ARTHAS', other.id).catch((e: unknown) => e)
            expect(isUniqueConstraintError(error)).toBe(true)
            expect(error).toMatchObject({ field: 'name' })
            expect(await repositories.characters.countByUserId(other.id)).toBe(0)
        })

        it(`limite : ${MAX_CHARACTERS_PER_ACCOUNT} personnages, puis LimitReachedError sans création`, async () => {
            for (const name of NAMES.slice(0, MAX_CHARACTERS_PER_ACCOUNT)) {
                await create(name)
            }
            const error = await create('Varian').catch((e: unknown) => e)
            expect(isLimitReachedError(error)).toBe(true)
            expect(error).toMatchObject({ resource: 'characters', limit: MAX_CHARACTERS_PER_ACCOUNT })
            expect(await repositories.characters.countByUserId(owner.id)).toBe(MAX_CHARACTERS_PER_ACCOUNT)
        })

        it('la limite est comptée par compte : un autre compte peut toujours créer', async () => {
            const other = await repositories.users.create(newUser('Other', 'other@test.local'))
            await create('Arthas', owner.id, 1)
            await expect(create('Jaina', other.id, 1)).resolves.toMatchObject({ userId: other.id })
        })

        it('limite atteinte et nom pris en même temps : la limite est signalée', async () => {
            await create('Arthas', owner.id, 1)
            const error = await create('Arthas', owner.id, 1).catch((e: unknown) => e)
            expect(isLimitReachedError(error)).toBe(true)
        })

        it('compte inexistant : ReferenceNotFoundError("user") ; classe inexistante : ReferenceNotFoundError("class")', async () => {
            const noUser = await create('Arthas', UNKNOWN_USER_ID).catch((e: unknown) => e)
            expect(isReferenceNotFoundError(noUser)).toBe(true)
            expect(noUser).toMatchObject({ reference: 'user' })

            const noClass = await repositories.characters
                .createWithinLimit({ userId: owner.id, classId: UNKNOWN_ID, name: 'Arthas' }, MAX_CHARACTERS_PER_ACCOUNT)
                .catch((e: unknown) => e)
            expect(isReferenceNotFoundError(noClass)).toBe(true)
            expect(noClass).toMatchObject({ reference: 'class' })
            expect(await repositories.characters.countByUserId(owner.id)).toBe(0)
        })

        it('après un échec, une création valide aboutit (aucun verrou ni état résiduel)', async () => {
            await create('Arthas')
            await create('arthas').catch(() => undefined)
            await repositories.characters
                .createWithinLimit({ userId: owner.id, classId: UNKNOWN_ID, name: 'Jaina' }, MAX_CHARACTERS_PER_ACCOUNT)
                .catch(() => undefined)
            await expect(create('Jaina')).resolves.toMatchObject({ name: 'Jaina' })
            expect(await repositories.characters.countByUserId(owner.id)).toBe(2)
        })

        it('findAllByUserId : seulement les personnages du compte, triés par création puis identifiant ; [] sinon', async () => {
            const other = await repositories.users.create(newUser('Other', 'other@test.local'))
            for (const name of NAMES.slice(0, 3)) {
                await create(name)
            }
            await create('Varian', other.id)

            const mine = await repositories.characters.findAllByUserId(owner.id)
            const expectedOrder = [...mine].sort(
                (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
            )
            expect(mine).toHaveLength(3)
            expect(mine.every((character) => character.userId === owner.id)).toBe(true)
            expect(mine.map((character) => character.id)).toEqual(expectedOrder.map((character) => character.id))
            expect(await repositories.characters.findAllByUserId(UNKNOWN_USER_ID)).toEqual([])
        })

        it('findById : undefined pour un identifiant inconnu', async () => {
            expect(await repositories.characters.findById(UNKNOWN_ID)).toBeUndefined()
        })

        it('compte supprimé : ses personnages ne sont plus trouvés', async () => {
            const character = await create('Arthas')
            await repositories.users.delete(owner.id)
            expect(await repositories.characters.findById(character.id)).toBeUndefined()
            expect(await repositories.characters.countByUserId(owner.id)).toBe(0)
        })

        it('updateProgression : compute reçoit la progression enregistrée ; niveau et XP écrits, rien d’autre', async () => {
            const character = await create('Arthas')
            const other = await create('Jaina')
            const compute = vi.fn(() => ({ level: 3, experience: 7, levelsGained: 2 }))

            const update = await repositories.characters.updateProgression(character.id, compute)

            expect(compute).toHaveBeenCalledOnce()
            expect(compute).toHaveBeenCalledWith({ level: 1, experience: 0 })
            expect(update?.result).toEqual({ level: 3, experience: 7, levelsGained: 2 })
            expect(update?.character).toEqual({ ...character, level: 3, experience: 7, updatedAt: expect.any(Date) })
            expect(await repositories.characters.findById(character.id)).toEqual(update?.character)
            expect(await repositories.characters.findById(other.id)).toEqual(other)

            await repositories.characters.updateProgression(character.id, compute)
            expect(compute).toHaveBeenLastCalledWith({ level: 3, experience: 7 })
        })

        it('updateProgression : personnage inexistant ou compte supprimé → undefined, compute jamais appelé', async () => {
            const compute = vi.fn(() => ({ level: 2, experience: 0 }))
            expect(await repositories.characters.updateProgression(UNKNOWN_ID, compute)).toBeUndefined()

            const character = await create('Arthas')
            await repositories.users.delete(owner.id)
            expect(await repositories.characters.updateProgression(character.id, compute)).toBeUndefined()
            expect(compute).not.toHaveBeenCalled()
        })

        it('updateProgression : si compute échoue, l’erreur est propagée et rien n’est modifié', async () => {
            const character = await create('Arthas')
            const failure = new Error('calcul impossible')
            await expect(
                repositories.characters.updateProgression(character.id, () => {
                    throw failure
                })
            ).rejects.toBe(failure)
            expect(await repositories.characters.findById(character.id)).toEqual(character)

            // Aucun verrou ni état résiduel : une modification suivante aboutit.
            await expect(
                repositories.characters.updateProgression(character.id, () => ({ level: 1, experience: 50 }))
            ).resolves.toMatchObject({ character: { level: 1, experience: 50 } })
        })
    })
}

/* Contrat d'un repository de classes (CHAR-01) : les données de référence du seed. */
export function describeCharacterClassRepositoryContract(label: string, getRepository: () => CharacterClassRepository): void {
    describe(`Contrat CharacterClassRepository : ${label}`, () => {
        it('findAll : les trois classes de référence, dans l’ordre du seed, avec les valeurs de rules.md §2', async () => {
            const classes = await getRepository().findAll()
            expect(classes.map((characterClass) => characterClass.code)).toEqual(['warrior', 'mage', 'rogue'])
            expect(classes[0]).toMatchObject({
                name: 'Guerrier',
                baseStats: { hp: 120, mana: 20, attack: 12, defense: 8, speed: 8 },
                statsPerLevel: { hp: 12, mana: 2, attack: 2, defense: 2, speed: 1 }
            })
            expect(Object.keys(classes[0] ?? {}).sort()).toEqual(['baseStats', 'code', 'id', 'name', 'statsPerLevel'])
        })

        it('findById : la classe demandée, ou undefined', async () => {
            const repository = getRepository()
            const [first] = await repository.findAll()
            expect(await repository.findById(first?.id ?? '')).toEqual(first)
            expect(await repository.findById(UNKNOWN_ID)).toBeUndefined()
        })
    })
}
