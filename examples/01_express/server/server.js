import express from 'express'
import { join } from 'path'

const app = express()
const router = new express.Router()

router.get('/ping', (req, res) => {
  return res.send('pong')
})

app.use('/api', router)
app.use('/', express.static(join(__dirname, '../client')))

const port = process.env.PORT || 3000
app.listen(port, () => {
  console.log(`Listening on ${port}`)
})
