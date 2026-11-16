import app from './src/app'

const PORT = 4001

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`)
})