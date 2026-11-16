import express, {NextFunction, Request, Response} from 'express'
import cors from 'cors'
import routes from './routes'
import { HttpError } from './utils/http-error'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
    res.status(200).json({ message: 'Server is working' })
})

app.use(routes)

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message })
    }
    console.error(err)
    res.status(500).json({ error: 'Internal Server Error' })
})

export default app