import { User } from '../types/user'

//BDD perdue à chaque redémarrage du serveur
const users: User[] = [
    { id: 1, name: 'Théophan', email: 'theophan@prenombizarreamonavis.com' },
    { id: 2, name: 'Bob', email: 'bob@nombasicpouruntest.com' }
]
let nextId = 3
 
export const userRepository = {
    findAll: (): User[] => users,
 
    findById: (id: number): User | undefined => users.find((u) => u.id === id),
 
    findByEmail: (email: string): User | undefined => users.find((u) => u.email === email),
 
    create(data: Omit<User, 'id'>): User {
        const user: User = { id: nextId++, ...data }
        users.push(user)
        return user
    },
 
    update(id: number, data: Partial<Omit<User, 'id'>>): User | undefined {
        const user = users.find((u) => u.id === id)
        if (!user) return undefined
        if (data.name !== undefined) user.name = data.name
        if (data.email !== undefined) user.email = data.email
        return user
    },
 
    delete(id: number): boolean {
        const index = users.findIndex((u) => u.id === id)
        if (index === -1) return false
        users.splice(index, 1)
        return true
    }
}