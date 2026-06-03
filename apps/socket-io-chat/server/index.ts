import http from 'node:http'
import { Server } from 'socket.io'
import {
  contactProfile,
  conversationInsight,
  historyLimit,
  messages,
  moments,
  roomName,
  type ChatMessage,
} from './data.js'

const port = Number.parseInt(process.env.PORT ?? '3001', 10)

const server = http.createServer((request, response) => {
  void handleHttpRequest(request, response)
})
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true,
  },
})

io.on('connection', (socket) => {
  socket.on('join', (payload: { room?: string; userName?: string } = {}) => {
    const room = normalizeRoom(payload.room)
    socket.join(room)
    socket.data.room = room
    socket.data.userName = payload.userName?.trim() || '访客'
    socket.emit('history', messages.filter(message => message.room === room).slice(-historyLimit))
    socket.to(room).emit('presence', {
      type: 'join',
      userName: socket.data.userName,
      at: Date.now(),
    })
  })

  socket.on('chat:send', (payload: Partial<ChatMessage> = {}) => {
    const room = normalizeRoom(payload.room ?? socket.data.room)
    const text = payload.text?.trim()
    if (!text) {
      return
    }

    const message: ChatMessage = {
      id: `${Date.now()}-${socket.id}`,
      room,
      userId: payload.userId || socket.id,
      userName: payload.userName?.trim() || socket.data.userName || '访客',
      text,
      platform: payload.platform === 'mini' ? 'mini' : 'web',
      createdAt: Date.now(),
    }

    messages.push(message)
    if (messages.length > historyLimit) {
      messages.splice(0, messages.length - historyLimit)
    }
    io.to(room).emit('chat:message', message)
  })

  socket.on('disconnect', () => {
    const room = socket.data.room
    if (!room) {
      return
    }
    socket.to(room).emit('presence', {
      type: 'leave',
      userName: socket.data.userName || '访客',
      at: Date.now(),
    })
  })
})

server.listen(port, '0.0.0.0', () => {
  console.log(`[socket-io-chat] listening on http://127.0.0.1:${port}`)
})

async function handleHttpRequest(request: http.IncomingMessage, response: http.ServerResponse) {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`)

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, null)
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/contact') {
    sendJson(response, 200, contactProfile)
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/moments') {
    sendJson(response, 200, {
      items: moments,
      refreshedAt: Date.now(),
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/graphql') {
    const body = await readRequestBody(request)
    const payload = parseJsonBody(body)
    const query = typeof payload?.query === 'string' ? payload.query : ''
    if (!query.includes('conversationInsight')) {
      sendJson(response, 400, {
        errors: [
          {
            message: 'Only conversationInsight is available in this demo.',
          },
        ],
      })
      return
    }

    sendJson(response, 200, {
      data: {
        conversationInsight,
      },
    })
    return
  }

  sendJson(response, 404, {
    message: 'Not found',
  })
}

function sendJson(response: http.ServerResponse, statusCode: number, payload: unknown) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  })
  if (statusCode === 204) {
    response.end()
    return
  }
  response.end(JSON.stringify(payload))
}

function readRequestBody(request: http.IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })
    request.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf8'))
    })
    request.on('error', reject)
  })
}

function parseJsonBody(body: string) {
  try {
    return JSON.parse(body) as { query?: unknown } | undefined
  }
  catch {
    return undefined
  }
}

function normalizeRoom(room: unknown) {
  return typeof room === 'string' && room.trim() ? room.trim() : roomName
}
