import { userRepository } from '../repositories/user.repository'
import { conflict, notFound } from '../utils/http-error'
import { User } from '../types/user'

// Le format des données (champs requis, chaînes non vides, champs inconnus) est validé
// en amont par les schémas Zod des routes. Ce service applique uniquement les règles métier.

const userNotFound = () => notFound('USER_NOT_FOUND', 'User not found')
const emailTaken = () => conflict('EMAIL_ALREADY_USED', 'Email already taken')

function getById(id: number): User {
    const user = userRepository.findById(id)
    if (!user) {
        throw userNotFound()
    }
    return user
}

export const userService = {
    getAll: (): User[] => userRepository.findAll(),
    getById,

    create(input: Omit<User, 'id'>): User {
        const { name, email } = input
        if (userRepository.findByEmail(email)) {
            throw emailTaken()
        }
        return userRepository.create({ name, email })
    },

    replace(id: number, input: Omit<User, 'id'>): User {
        getById(id)
        const { name, email } = input
        const existing = userRepository.findByEmail(email)
        if (existing && existing.id !== id) {
            throw emailTaken()
        }
        return userRepository.update(id, { name, email })!
    },

    patch(id: number, input: Partial<Omit<User, 'id'>>): User {
        getById(id)
        const { name, email } = input
        if (email !== undefined) {
            const existing = userRepository.findByEmail(email)
            if (existing && existing.id !== id) {
                throw emailTaken()
            }
        }
        return userRepository.update(id, { name, email })!
    },

    remove(id: number): void {
        if (!userRepository.delete(id)) {
            throw userNotFound()
        }
    }
}