import { describe, expect, it, vi } from 'vitest'
import { deleteAllPlayerData } from '../helpers/player-fixtures'

/* Seconde barrière du nettoyage des tests base de données (lot L2) : avant toute suppression,
 * le serveur doit confirmer que la connexion vise mmorpg_test. Testé ici avec un faux client, sans base.
 */

function fakeClient(databaseName: string | undefined) {
    const deleted: string[] = []
    const client = {
        $queryRaw: vi.fn(async () => (databaseName === undefined ? [] : [{ name: databaseName }])),
        character: { deleteMany: vi.fn(async () => deleted.push('characters')) },
        user: { deleteMany: vi.fn(async () => deleted.push('users')) }
    }
    return { client, deleted }
}

// Le faux client n'implémente que ce dont deleteAllPlayerData a besoin.
const cleanup = (client: ReturnType<typeof fakeClient>['client']) =>
    deleteAllPlayerData(client as unknown as Parameters<typeof deleteAllPlayerData>[0])

describe('deleteAllPlayerData', () => {
    it('mmorpg_test : supprime les personnages puis les comptes', async () => {
        const { client, deleted } = fakeClient('mmorpg_test')
        await cleanup(client)
        expect(deleted).toEqual(['characters', 'users'])
    })

    it.each(['mmorpg_dev', 'postgres', 'mmorpg_test_copy', undefined])('base « %s » : refus, aucune suppression', async (name) => {
        const { client, deleted } = fakeClient(name)
        await expect(cleanup(client)).rejects.toThrow(/Nettoyage refusé/)
        expect(deleted).toEqual([])
    })
})
