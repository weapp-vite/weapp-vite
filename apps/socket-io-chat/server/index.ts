import http from 'node:http'
import { createHttpApp } from './httpApp.js'
import { attachSocketServer } from './socketServer.js'

const port = Number.parseInt(process.env.PORT ?? '3001', 10)
const app = createHttpApp()
const server = http.createServer(app)

attachSocketServer(server)

server.listen(port, '0.0.0.0', () => {
  console.log(`[socket-io-chat] listening on http://127.0.0.1:${port}`)
})
