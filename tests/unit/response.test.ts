import { describe, expect, it } from 'vitest'
import { successBody } from '../../src/utils/response'

describe('successBody', () => {
    it("construit l'enveloppe avec un objet, sans champ meta", () => {
        const data = { id: 1, name: 'Arthas' }
        const body = successBody('User retrieved successfully', data)

        expect(body).toEqual({ success: true, message: 'User retrieved successfully', data })
        expect(body).not.toHaveProperty('meta')
    })

    it('accepte un tableau, y compris vide', () => {
        expect(successBody('Users retrieved successfully', [{ id: 1 }, { id: 2 }])).toEqual({
            success: true,
            message: 'Users retrieved successfully',
            data: [{ id: 1 }, { id: 2 }]
        })
        expect(successBody('Users retrieved successfully', [])).toEqual({
            success: true,
            message: 'Users retrieved successfully',
            data: []
        })
    })

    it('ajoute meta quand il est fourni', () => {
        const meta = { pagination: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 } }

        expect(successBody('Users retrieved successfully', [], meta)).toEqual({
            success: true,
            message: 'Users retrieved successfully',
            data: [],
            meta
        })
    })

    it('ne contient jamais de champ error', () => {
        expect(successBody('Message', { id: 1 })).not.toHaveProperty('error')
        expect(successBody('Message', [], { page: 1 })).not.toHaveProperty('error')
    })

    it('ne copie ni ne modifie les données reçues', () => {
        const data = { id: 1, name: 'Arthas' }
        const body = successBody('Message', data)

        expect(body.data).toBe(data)
        expect(data).toEqual({ id: 1, name: 'Arthas' })
    })

    it("refuse à la compilation une donnée qui n'est ni un objet ni un tableau", () => {
        // @ts-expect-error data doit être un objet ou un tableau (conventions, section 3)
        const body = successBody('Message', 'texte')

        expect(body.data).toBe('texte')
    })
})