import express from 'express'
import cors from 'cors'

const app = express()
const PORT = 4001

app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
    console.log('server working')
})

app.get('/users', (req, res) => {
    res.send([])
})


app.listen(PORT), () => {
    console.log('server running on http://localhost:4001')
}