import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCOUNT_USAGE, EXIT_FAILURE, EXIT_OK, EXIT_USAGE, runAccountCommand } from '../../src/cli/account-command'
import { createInMemoryUserRepository, type InMemoryUserRepository } from '../helpers/in-memory-user-repository'
import { newUser } from '../helpers/user-repository-contract'

/* Script d'administration des comptes (D8 du lot L2) : npm run account -- <action> <email>. */

let repository: InMemoryUserRepository
let messages: { info: string[]; error: string[] }
const output = {
    info: (message: string) => messages.info.push(message),
    error: (message: string) => messages.error.push(message)
}

beforeEach(async () => {
    repository = createInMemoryUserRepository()
    messages = { info: [], error: [] }
    await repository.create(newUser('Alice', 'alice@example.com'))
})

const run = (...args: string[]) => runAccountCommand(args, repository, output)
const alice = () => repository.findByEmail('alice@example.com')

describe('actions', () => {
    it('promote puis demote : rôle ADMIN puis PLAYER', async () => {
        expect(await run('promote', 'alice@example.com')).toBe(EXIT_OK)
        expect(await alice()).toMatchObject({ role: 'ADMIN' })
        expect(messages.info).toEqual(['Compte modifié : alice@example.com (rôle ADMIN, statut ACTIVE).'])

        expect(await run('demote', 'alice@example.com')).toBe(EXIT_OK)
        expect(await alice()).toMatchObject({ role: 'PLAYER' })
    })

    it('disable puis enable : statut DISABLED puis ACTIVE', async () => {
        expect(await run('disable', 'alice@example.com')).toBe(EXIT_OK)
        expect(await alice()).toMatchObject({ status: 'DISABLED' })
        expect(await run('enable', 'alice@example.com')).toBe(EXIT_OK)
        expect(await alice()).toMatchObject({ status: 'ACTIVE' })
    })

    it('email avec majuscules et espaces : normalisé comme à l’inscription', async () => {
        expect(await run('promote', '  Alice@Example.COM ')).toBe(EXIT_OK)
        expect(await alice()).toMatchObject({ role: 'ADMIN' })
    })

    it('action déjà effectuée : code 0, aucune écriture', async () => {
        const setRoleSpy = vi.spyOn(repository, 'setRole')
        expect(await run('demote', 'alice@example.com')).toBe(EXIT_OK)
        expect(setRoleSpy).not.toHaveBeenCalled()
        expect(messages.info).toEqual(['Rien à faire : alice@example.com (rôle PLAYER, statut ACTIVE).'])
    })
})

describe('adresses inexistantes et erreurs d’usage', () => {
    it('adresse inconnue : code 1, message clair, aucun compte créé ni modifié', async () => {
        const createSpy = vi.spyOn(repository, 'create')
        expect(await run('promote', 'inconnu@example.com')).toBe(EXIT_FAILURE)
        expect(messages.error).toEqual([
            "Aucun compte pour l'adresse inconnu@example.com : rien n'a été modifié (le script ne crée jamais de compte)."
        ])
        expect(createSpy).not.toHaveBeenCalled()
        expect(await repository.findAll()).toHaveLength(1)
    })

    it.each([
        { label: 'aucun argument', args: [] },
        { label: 'action inconnue', args: ['delete', 'alice@example.com'] },
        { label: 'email manquant', args: ['promote'] },
        { label: 'email vide', args: ['promote', '  '] },
        { label: 'argument en trop', args: ['promote', 'alice@example.com', 'bob@example.com'] }
    ])('$label : code 2 et aide, rien de modifié', async ({ args }) => {
        expect(await run(...args)).toBe(EXIT_USAGE)
        expect(messages.error).toEqual([ACCOUNT_USAGE])
        expect(await alice()).toMatchObject({ role: 'PLAYER', status: 'ACTIVE' })
    })

    it('compte supprimé entre la lecture et la modification : code 1', async () => {
        vi.spyOn(repository, 'setRole').mockResolvedValue(undefined)
        expect(await run('promote', 'alice@example.com')).toBe(EXIT_FAILURE)
        expect(messages.error).toEqual(["Le compte alice@example.com n'existe plus : rien n'a été modifié."])
    })
})
