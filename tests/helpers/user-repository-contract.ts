import { beforeEach, describe, expect, it } from 'vitest'
import { isUniqueConstraintError } from '../../src/repositories/errors'
import type { UserRepository } from '../../src/repositories/user.repository'
import type { NewUser } from '../../src/types/user'

/* Contrat d'un repository utilisateur (DB-04).
 * La même suite est exécutée sur le repository en mémoire (npm test) et sur le repository Prisma
 * (npm run test:db) : le repository contrôlé des tests se comporte comme le vrai.
 */

/** UUID valide qui n'existe dans aucune base. */
export const UNKNOWN_USER_ID = '00000000-0000-7000-8000-000000000000'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Hash fictif : le repository enregistre ce qu'il reçoit, le hachage relève du service (AUTH-03). */
export const CONTRACT_PASSWORD_HASH = 'contract-password-hash'

/** Données d'un nouveau compte pour les tests de repository. */
export const newUser = (name: string, email: string): NewUser => ({ name, email, passwordHash: CONTRACT_PASSWORD_HASH })

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

        it('create : renvoie l’utilisateur avec un UUID, le rôle PLAYER et ses dates, jamais le hash', async () => {
            const user = await repository.create(newUser('Alice', 'alice@test.local'))
            expect(user).toMatchObject({ name: 'Alice', email: 'alice@test.local', role: 'PLAYER' })
            expect(user.id).toMatch(UUID_PATTERN)
            expect(user.createdAt).toBeInstanceOf(Date)
            expect(user.updatedAt).toBeInstanceOf(Date)
            expect(Object.keys(user).sort()).toEqual(['createdAt', 'email', 'id', 'name', 'role', 'status', 'updatedAt'])
            expect(JSON.stringify(await repository.findAll())).not.toContain(CONTRACT_PASSWORD_HASH)
        })

        it('create : un email déjà utilisé lève UniqueConstraintError("email")', async () => {
            await repository.create(newUser('Alice', 'same@test.local'))
            const error = await repository.create(newUser('Bob', 'same@test.local')).catch((e: unknown) => e)
            expect(isUniqueConstraintError(error)).toBe(true)
            expect(error).toMatchObject({ field: 'email' })
            expect(await repository.findAll()).toHaveLength(1)
        })

        it('findById : renvoie l’utilisateur, ou undefined s’il est inconnu', async () => {
            const created = await repository.create(newUser('Alice', 'alice@test.local'))
            expect(await repository.findById(created.id)).toEqual(created)
            expect(await repository.findById(UNKNOWN_USER_ID)).toBeUndefined()
        })

        it('findAll : vide au départ, puis trié par date de création, puis identifiant (ordre stable)', async () => {
            expect(await repository.findAll()).toEqual([])
            for (const name of ['Un', 'Deux', 'Trois', 'Quatre']) {
                await repository.create(newUser(name, `${name.toLowerCase()}@test.local`))
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
            const created = await repository.create(newUser('Alice', 'alice@test.local'))
            const updated = await repository.update(created.id, { name: 'Alicia' })
            expect(updated).toMatchObject({ id: created.id, name: 'Alicia', email: 'alice@test.local' })
            expect(updated?.createdAt).toEqual(created.createdAt)
        })

        it('update : accepte de conserver son propre email', async () => {
            const created = await repository.create(newUser('Alice', 'alice@test.local'))
            await expect(repository.update(created.id, { email: 'alice@test.local' })).resolves.toMatchObject({ id: created.id })
        })

        it("update : l'email d'un autre utilisateur lève UniqueConstraintError, sans rien modifier", async () => {
            await repository.create(newUser('Alice', 'alice@test.local'))
            const bob = await repository.create(newUser('Bob', 'bob@test.local'))
            const error = await repository.update(bob.id, { name: 'Robert', email: 'alice@test.local' }).catch((e: unknown) => e)
            expect(isUniqueConstraintError(error)).toBe(true)
            expect(await repository.findById(bob.id)).toMatchObject({ name: 'Bob', email: 'bob@test.local' })
        })

        it('update : renvoie undefined pour un utilisateur inconnu', async () => {
            expect(await repository.update(UNKNOWN_USER_ID, { name: 'X' })).toBeUndefined()
        })

        it('create : statut ACTIVE par défaut', async () => {
            expect(await repository.create(newUser('Alice', 'alice@test.local'))).toMatchObject({ status: 'ACTIVE' })
        })

        it('findByEmail : renvoie le compte, ou undefined', async () => {
            const created = await repository.create(newUser('Alice', 'alice@test.local'))
            expect(await repository.findByEmail('alice@test.local')).toEqual(created)
            expect(await repository.findByEmail('inconnu@test.local')).toBeUndefined()
        })

        it('findCredentialsByEmail : renvoie le compte et son hash, ou undefined', async () => {
            const created = await repository.create(newUser('Alice', 'alice@test.local'))
            expect(await repository.findCredentialsByEmail('alice@test.local')).toEqual({
                user: created,
                passwordHash: CONTRACT_PASSWORD_HASH
            })
            expect(await repository.findCredentialsByEmail('inconnu@test.local')).toBeUndefined()
        })

        it('findPage : page demandée dans l’ordre de findAll, avec le nombre total', async () => {
            for (const name of ['Un', 'Deux', 'Trois', 'Quatre', 'Cinq']) {
                await repository.create(newUser(name, `${name.toLowerCase()}@test.local`))
            }
            const all = await repository.findAll()
            expect(await repository.findPage({ skip: 0, take: 2 })).toEqual({ users: all.slice(0, 2), totalItems: 5 })
            expect(await repository.findPage({ skip: 4, take: 2 })).toEqual({ users: all.slice(4), totalItems: 5 })
            expect(await repository.findPage({ skip: 10, take: 2 })).toEqual({ users: [], totalItems: 5 })
        })

        it('setRole et setStatus : modifient le compte, undefined pour un compte inconnu', async () => {
            const created = await repository.create(newUser('Alice', 'alice@test.local'))
            expect(await repository.setRole(created.id, 'ADMIN')).toMatchObject({ id: created.id, role: 'ADMIN', status: 'ACTIVE' })
            expect(await repository.setStatus(created.id, 'DISABLED')).toMatchObject({ role: 'ADMIN', status: 'DISABLED' })
            expect(await repository.findById(created.id)).toMatchObject({ role: 'ADMIN', status: 'DISABLED' })
            expect(await repository.setRole(UNKNOWN_USER_ID, 'ADMIN')).toBeUndefined()
            expect(await repository.setStatus(UNKNOWN_USER_ID, 'DISABLED')).toBeUndefined()
        })

        it('delete : renvoie true puis l’utilisateur n’existe plus ; false s’il est inconnu', async () => {
            const created = await repository.create(newUser('Alice', 'alice@test.local'))
            expect(await repository.delete(created.id)).toBe(true)
            expect(await repository.findById(created.id)).toBeUndefined()
            expect(await repository.delete(created.id)).toBe(false)
        })
    })
}
