import type { IncomingHttpHeaders, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { Hono } from 'hono'
import { Server as SocketIOServer } from 'socket.io'
import { WebSocketServer } from 'ws'

export interface RequestClientsRealServerState {
  axios: number
  fetch: number
  graphql: number
  socketIo: number
  vueQuery: number
  websocket: number
}

export interface RequestClientsRealServerHandle {
  baseUrl: string
  requestCounts: RequestClientsRealServerState
  stop: () => Promise<void>
}

function createRequestCounts(): RequestClientsRealServerState {
  return {
    axios: 0,
    fetch: 0,
    graphql: 0,
    socketIo: 0,
    vueQuery: 0,
    websocket: 0,
  }
}

function createNodeRequest(url: string, method: string, headers: IncomingHttpHeaders, req: NodeJS.ReadableStream) {
  const body = method === 'GET' || method === 'HEAD'
    ? undefined
    : Readable.toWeb(req as Readable)

  return new Request(url, {
    body,
    duplex: body ? 'half' : undefined,
    headers: headers as HeadersInit,
    method,
  })
}

async function writeNodeResponse(response: Response, res: ServerResponse) {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })

  if (!response.body) {
    res.end()
    return
  }

  const nodeBody = Readable.fromWeb(response.body as ReadableStream)
  await new Promise<void>((resolve, reject) => {
    nodeBody.once('error', reject)
    res.once('error', reject)
    res.once('finish', resolve)
    nodeBody.pipe(res)
  })
}

export async function startRequestClientsRealServer(): Promise<RequestClientsRealServerHandle> {
  const requestCounts = createRequestCounts()
  const app = new Hono()

  app.post('/fetch', async (c) => {
    requestCounts.fetch += 1
    const body = await c.req.json().catch(() => ({}))
    return c.json({
      body,
      method: c.req.method,
      path: '/fetch',
      requestCount: requestCounts.fetch,
      transport: 'fetch',
    })
  })

  app.post('/axios', async (c) => {
    requestCounts.axios += 1
    const body = await c.req.json().catch(() => ({}))
    return c.json({
      body,
      method: c.req.method,
      path: '/axios',
      query: c.req.query(),
      requestCount: requestCounts.axios,
      transport: 'axios',
    })
  })

  app.post('/graphql', async (c) => {
    requestCounts.graphql += 1
    const body = await c.req.json().catch(() => ({}))
    return c.json({
      data: {
        transport: {
          client: 'graphql-request',
          operationName: 'TransportProbe',
          path: '/graphql',
          requestCount: requestCounts.graphql,
          run: body.variables?.run ?? null,
        },
      },
    })
  })

  app.get('/vue-query', (c) => {
    requestCounts.vueQuery += 1
    const tab = c.req.query('tab') === 'detail' ? 'detail' : 'overview'
    const seed = Number(c.req.query('seed') ?? '0')
    return c.json({
      generatedAt: new Date().toISOString(),
      label: tab === 'overview' ? 'Overview Data' : 'Detail Data',
      requestCount: requestCounts.vueQuery,
      seed,
      tab,
    })
  })

  const server = createServer(async (req, res) => {
    if ((req.url ?? '').startsWith('/socket.io')) {
      return
    }

    const host = req.headers.host ?? '127.0.0.1'
    const request = createNodeRequest(`http://${host}${req.url ?? '/'}`, req.method ?? 'GET', req.headers, req)
    const response = await app.fetch(request)
    await writeNodeResponse(response, res)
  })

  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
    },
    httpCompression: false,
    perMessageDeflate: false,
    path: '/socket.io',
    serveClient: false,
  })

  io.on('connection', (socket) => {
    socket.on('probe', (payload, ack) => {
      requestCounts.socketIo += 1
      ack?.({
        client: payload?.client ?? 'socket.io-client',
        namespace: socket.nsp.name,
        path: '/socket.io',
        requestCount: requestCounts.socketIo,
        transport: socket.conn.transport.name,
      })
    })
  })

  const websocketServer = new WebSocketServer({
    noServer: true,
  })

  server.on('upgrade', (request, socket, head) => {
    if (!(request.url ?? '').startsWith('/ws')) {
      return
    }

    websocketServer.handleUpgrade(request, socket, head, (client) => {
      websocketServer.emit('connection', client, request)
    })
  })

  websocketServer.on('connection', (client, request) => {
    requestCounts.websocket += 1
    client.send(JSON.stringify({
      client: 'native-websocket',
      path: '/ws',
      requestCount: requestCounts.websocket,
      stage: 'connected',
      url: request.url ?? '/ws',
    }))

    client.on('message', (message) => {
      let body: Record<string, unknown> = {}
      try {
        body = JSON.parse(message.toString())
      }
      catch {
        body = {
          raw: message.toString(),
        }
      }

      requestCounts.websocket += 1
      client.send(JSON.stringify({
        body,
        client: 'native-websocket',
        path: '/ws',
        requestCount: requestCounts.websocket,
        stage: 'echo',
        transport: 'websocket',
      }))
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.once('listening', resolve)
    server.listen(0, '127.0.0.1')
  })

  const address = server.address() as AddressInfo
  const baseUrl = `http://127.0.0.1:${address.port}`

  return {
    baseUrl,
    requestCounts,
    async stop() {
      await new Promise<void>((resolve) => {
        websocketServer.close(() => {
          resolve()
        })
      })
      await new Promise<void>((resolve) => {
        io.close(() => {
          resolve()
        })
      })
      if (!server.listening) {
        return
      }
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      })
    },
  }
}
