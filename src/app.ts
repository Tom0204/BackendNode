import express from 'express'
import cors from 'cors'
import routes from './routes'
import { errorHandler, notFoundHandler } from './middlewares/error.middleware'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
    res.status(200).json({ message: 'Server is working' })
})

app.use(routes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app