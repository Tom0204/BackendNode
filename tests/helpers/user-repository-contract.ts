import { beforeEach, describe, expect, it } from 'vitest'
import { isUniqueConstraintError } from '../../src/repositories/errors'
import type { UserRepository } from '../../src/repositories/user.repository'

/* Contrat d'un repository utilisateur (DB-04).
 * La même suite est exécutée sur le repository en mémoire (npm test) et sur le repository Prisma
 * (npm run test:db) : le repository contrôlé des tests se comporte comme le vrai.
 */

/** UUID valide qui n'existe dans aucune base. */
export const UNKNOWN_USER_ID = '00000000-0000-7000-8000-000000000000'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * Déclare la suite de contrat.
 * `getRepository` renvoie un repository vide au début de chaque test (le nettoyage est fait par l'appelant).
 */
export function describeUserRepositoryContract(label: string, getRepository: () => UserRepository): void {
    describe(`Contrat UserRepository : ${label}`, () => {
        let repository: UserRepository

        beforeEach(() => {
            repository = getRepository()
        })

        it('create : renvoie l’utilisateur avec un UUID et ses dates', async () => {
            const user = await repository.create({ name: 'Alice', email: 'alice@test.local' })
            expect(user).toMatchObject({ name: 'Alice', email: 'alice@test.local' })
            expect(user.id).toMatch(UUID_PATTERN)
            expect(user.createdAt).toBeInstanceOf(Date)
            expect(user.updatedAt).toBeInstanceOf(Date)
            expect(Object.keys(user).sort()).toEqual(['createdAt', 'email', 'id', 'name', 'updatedAt'])
        })

        it('create : un email déjà utilisé lève UniqueConstraintError("email")', async () => {
            await repository.create({ name: 'Alice', email: 'same@test.local' })
            const error = await repository.create({ name: 'Bob', email: 'same@test.local' }).catch((e: unknown) => e)
            expect(isUniqueConstraintError(error)).toBe(true)
            expect(error).toMatchObject({ field: 'email' })
            expect(await repository.findAll()).toHaveLength(1)
        })

        it('findById : renvoie l’utilisateur, ou undefined s’il est inconnu', async () => {
            const created = await repository.create({ name: 'Alice', email: 'alice@test.local' })
            expect(await repository.findById(created.id)).toEqual(created)
            expect(await repository.findById(UNKNOWN_USER_ID)).toBeUndefined()
        })

        it('findAll : vide au départ, puis trié par date de création, puis identifiant (ordre stable)', async () => {
            expect(await repository.findAll()).toEqual([])
            for (const name of ['Un', 'Deux', 'Trois', 'Quatre']) {
                await repository.create({ name, email: `${name.toLowerCase()}@test.local` })
            }
            const users = await repository.findAll()
            const expectedOrder = [...users].sort(
                (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
            )
            expect(users).toHaveLength(4)
            expect(users.map((u) => u.id)).toEqual(expectedOrder.map((u) => u.id))
            // Deux lectures successives donnent le même ordre.
            expect((await repository.findAll()).map((u) => u.id)).toEqual(users.map((u) => u.id))
        })

        it('update : modifie uniquement les champs fournis', async () => {
            const created = await repository.create({ name: 'Alice', email: 'alice@test.local' })
            const updated = await repository.update(created.id, { name: 'Alicia' })
            expect(updated).toMatchObject({ id: created.id, name: 'Alicia', email: 'alice@test.local' })
            expect(updated?.createdAt).toEqual(created.createdAt)
        })

        it('update : accepte de conserver son propre email', async () => {
            const created = await repository.create({ name: 'Alice', email: 'alice@test.local' })
            await expect(repository.update(created.id, { email: 'alice@test.local' })).resolves.toMatchObject({ id: created.id })
        })

        it("update : l'email d'un autre utilisateur lève UniqueConstraintError, sans rien modifier", async () => {
            await repository.create({ name: 'Alice', email: 'alice@test.local' })
            const bob = await repository.create({ name: 'Bob', email: 'bob@test.local' })
            const error = await repository.update(bob.id, { name: 'Robert', email: 'alice@test.local' }).catch((e: unknown) => e)
            expect(isUniqueConstraintError(error)).toBe(true)
            expect(await repository.findById(bob.id)).toMatchObject({ name: 'Bob', email: 'bob@test.local' })
        })

        it('update : renvoie undefined pour un utilisateur inconnu', async () => {
            expect(await repository.update(UNKNOWN_USER_ID, { name: 'X' })).toBeUndefined()
        })

        it('delete : renvoie true puis l’utilisateur n’existe plus ; false s’il est inconnu', async () => {
            const created = await repository.create({ name: 'Alice', email: 'alice@test.local' })
            expect(await repository.delete(created.id)).toBe(true)
            expect(await repository.findById(created.id)).toBeUndefined()
            expect(await repository.delete(created.id)).toBe(false)
        })
    })
}
