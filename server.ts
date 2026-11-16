import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 4001

app.use(cors())
app.use(express.json())

interface User {
    id: number,
    name: string,
    email: string
}

//BDD perdue à chaque redémarrage du serveur
let users: User[] = [
    { id: 1, name: 'Théophan', email: 'theophan@prenombizarreamonavis.com' },
    { id: 2, name: 'Bob', email: 'bob@nombasicpouruntest.com' }
]
let nextId = 3

const isNonEmptyString = (v: unknown): v is string =>
    typeof v === 'string' && v.trim().length > 0

app.get('/', (req, res) => {
    console.log('server working')
})

app.get('/users', (req, res) => {
    res.status(200).json(users)
})

app.get('/users/:id', (req, res) => {
    const user = users.find((u) => u.id === Number(req.params.id))
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })
    res.status(200).json(user)
})

app.post('/users', (req, res) => {
    const { name, email } = req.body ?? {}

    if (!isNonEmptyString(name) || !isNonEmptyString(email)) {
        return res.status(400).json({ error: 'name et email obligatoires' })
    }

    if (users.some((u) => u.email === email)) {
        return res.status(409).json({ error: 'Cet email existe déjà' })
    }

    const newUser: User = {
        id: nextId++,
        name,
        email
    }

    users.push(newUser)
    res.status(201).json(newUser)
})

app.put('/users/:id', (req, res) => {
    const index = users.findIndex((u) => u.id === Number(req.params.id))
    if (index === -1) return res.status(404).json({ error: 'Utilisateur non trouvé' })

    const { name, email } = req.body ?? {}
    if (!isNonEmptyString(name) || !isNonEmptyString(email)) {
        return res.status(400).json({ error: 'name et email obligatoires' })
    }
    if (users.some((u) => u.email === email && u.id !== users[index].id)) {
        return res.status(409).json({ error: 'Cet email existe déjà' })
    }

    users[index] = { id: users[index].id, name, email }
    res.status(200).json(users[index])
})


app.patch('/users/:id', (req, res) => {
    const user = users.find((u) => u.id === Number(req.params.id))
    if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' })

    const { name, email } = req.body ?? {}
    if (name === undefined && email === undefined) {
        return res.status(400).json({ error: 'Fournis au moins un name ou un email' })
    }
    if (name !== undefined && !isNonEmptyString(name)) {
        return res.status(400).json({ error: 'name invalide' })
    }
    if (email !== undefined) {
        if (!isNonEmptyString(email)) {
            return res.status(400).json({ error: 'email invalide' })
        }
        if (users.some((u) => u.email === email && u.id !== user.id)) {
            return res.status(409).json({ error: 'Cet email existe déjà' })
        }
    }

    if (name !== undefined) user.name = name
    if (email !== undefined) user.email = email

    res.status(200).json(user)
})


app.delete('/users/:id', (req, res) => {
    const index = users.findIndex((u) => u.id === Number(req.params.id))
    if (index === -1) return res.status(404).json({ error: 'Utilisateur introuvable' })
    
    users.splice(index, 1)
    res.status(204).send()
})

app.listen(PORT), () => {
    console.log('server running on http://localhost:4001')
}