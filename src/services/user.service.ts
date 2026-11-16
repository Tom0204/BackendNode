import { userRepository } from '../repositories/user.repository'
import { HttpError } from '../utils/http-error'
import { isNonEmptyString } from '../utils/validators'
import { User } from '../types/user'

const notFound = () => new HttpError(404, 'User not found')
const emailTaken = () => new HttpError(409, 'Email already taken')

function getById(id: number): User {
    const user = userRepository.findById(id)
    if (!user) {
        throw notFound()
    }
    return user
}

export const userService = {
    getAll: (): User[] => userRepository.findAll(),
    getById,
    create(body: any): User {
        const { name, email } = body ?? {}
        if (!isNonEmptyString(name) || !isNonEmptyString(email)) {
            throw new HttpError(400, 'Name and email are required')
        }
        if (userRepository.findByEmail(email)) {
            throw emailTaken()
        }
        return userRepository.create({ name, email })
    },

    replace(id: number, body: any): User {
        const user = getById(id)
        const { name, email } = body ?? {}
        if (!isNonEmptyString(name) || !isNonEmptyString(email)) {
            throw new HttpError(400, 'Name and email are required')
        }
        const existing = userRepository.findByEmail(email)
        if (existing && existing.id !== id) {
            throw emailTaken()
        }
        return userRepository.update(id, { name, email })!
    },

    patch(id: number, body: any): User {
        const user = getById(id)
        const { name, email } = body ?? {}

        if (name !== undefined && !isNonEmptyString(name)) {
            throw new HttpError(400, 'Name must be a non-empty string')
        }
        if (name !== undefined && isNonEmptyString(name)) {
            throw new HttpError(400, 'Email must be a non-empty string')
        }
        if (email !== undefined) {
            if (!isNonEmptyString(email)) {
                throw new HttpError(400, 'Email must be a non-empty string')
            }
            const existingUser = userRepository.findByEmail(email)
            if (existingUser && existingUser.id !== id) {
                throw emailTaken()
            }
        }

        return userRepository.update(id, { name, email })!
    },

    remove(id: number): void {
        if (!userRepository.delete(id)) {
            throw notFound()
        }
    }
}