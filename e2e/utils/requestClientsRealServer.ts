import type { IncomingHttpHeaders, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { Readable } from 'node:stream'
import { Hono } from 'hono'
import { Server as SocketIOServer } from 'socket.io'
import { WebSocketServer } from 'ws'

const REALTIME_RANDOM_PUSH_INTERVAL_MS = 5_000
const FORM_DATA_BINARY_FIXTURE = Buffer.from([
  0x00,
  0x01,
  0x02,
  0x03,
  ...Buffer.from('issue-448-formdata-upload'),
  0xF0,
  0x9F,
  0x94,
  0xA5,
  0xFF,
])
const FORM_DATA_BINARY_FIXTURE_SHA256 = createHash('sha256').update(FORM_DATA_BINARY_FIXTURE).digest('hex')

export interface RequestClientsRealServerState {
  axios: number
  fetch: number
  formDataUpload: number
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

export interface StartRequestClientsRealServerOptions {
  port?: number
}

function createRealtimeRandomPayload(path: '/socket.io' | '/ws', sequence: number) {
  return {
    event: 'server-random',
    message: Math.random().toString(36).slice(2, 10),
    path,
    requestCount: sequence,
    sentAt: new Date().toISOString(),
  }
}

function createRequestCounts(): RequestClientsRealServerState {
  return {
    axios: 0,
    fetch: 0,
    formDataUpload: 0,
    graphql: 0,
    socketIo: 0,
    vueQuery: 0,
    websocket: 0,
  }
}

function parseMultipartBoundary(contentType: string | null) {
  const match = contentType?.match(/(?:^|;\s*)boundary=([^;]+)/i)
  return match?.[1]?.replace(/^"|"$/g, '') ?? ''
}

async function readRequestBuffer(request: Request) {
  const buffer = await request.arrayBuffer()
  return Buffer.from(buffer)
}

function parseMultipartParts(body: Buffer, boundary: string) {
  const rawBody = body.toString('binary')
  const delimiter = `--${boundary}`
  const parts: Array<{
    content: Buffer
    headers: Record<string, string>
    name: string
    filename: string | null
  }> = []

  for (const rawPart of rawBody.split(delimiter)) {
    if (!rawPart || rawPart === '--\r\n' || rawPart === '--') {
      continue
    }

    const normalized = rawPart.replace(/^\r\n/, '').replace(/\r\n$/, '').replace(/--$/, '')
    const headerEnd = normalized.indexOf('\r\n\r\n')
    if (headerEnd < 0) {
      continue
    }

    const headerBlock = normalized.slice(0, headerEnd)
    const contentBinary = normalized.slice(headerEnd + 4)
    const headers: Record<string, string> = {}
    for (const line of headerBlock.split('\r\n')) {
      const separatorIndex = line.indexOf(':')
      if (separatorIndex < 0) {
        continue
      }
      headers[line.slice(0, separatorIndex).trim().toLowerCase()] = line.slice(separatorIndex + 1).trim()
    }

    const disposition = headers['content-disposition'] ?? ''
    const name = disposition.match(/(?:^|;\s*)name="([^"]*)"/)?.[1] ?? ''
    const filename = disposition.match(/(?:^|;\s*)filename="([^"]*)"/)?.[1] ?? null
    parts.push({
      content: Buffer.from(contentBinary, 'binary'),
      filename,
      headers,
      name,
    })
  }

  return parts
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

export async function startRequestClientsRealServer(
  options: StartRequestClientsRealServerOptions = {},
): Promise<RequestClientsRealServerHandle> {
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

  app.get('/issue-448/download.bin', (_c) => {
    return new Response(FORM_DATA_BINARY_FIXTURE, {
      headers: {
        'content-type': 'application/octet-stream',
        'x-issue-448-sha256': FORM_DATA_BINARY_FIXTURE_SHA256,
      },
    })
  })

  app.post('/issue-448/upload', async (c) => {
    requestCounts.formDataUpload += 1
    const contentType = c.req.header('content-type') ?? ''
    const boundary = parseMultipartBoundary(contentType)
    const body = await readRequestBuffer(c.req.raw)
    const parts = boundary ? parseMultipartParts(body, boundary) : []
    const files = parts
      .filter(part => part.filename)
      .map(part => ({
        contentType: part.headers['content-type'] ?? '',
        filename: part.filename,
        name: part.name,
        sha256: createHash('sha256').update(part.content).digest('hex'),
        size: part.content.byteLength,
      }))

    return c.json({
      contentType,
      expectedSha256: FORM_DATA_BINARY_FIXTURE_SHA256,
      files,
      method: c.req.method,
      path: '/issue-448/upload',
      requestCount: requestCounts.formDataUpload,
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
    const pushTimer = setInterval(() => {
      requestCounts.socketIo += 1
      socket.emit('server-random', createRealtimeRandomPayload('/socket.io', requestCounts.socketIo))
    }, REALTIME_RANDOM_PUSH_INTERVAL_MS)

    socket.on('disconnect', () => {
      clearInterval(pushTimer)
    })

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

    const pushTimer = setInterval(() => {
      requestCounts.websocket += 1
      client.send(JSON.stringify({
        ...createRealtimeRandomPayload('/ws', requestCounts.websocket),
        client: 'native-websocket',
        stage: 'tick',
        transport: 'websocket',
      }))
    }, REALTIME_RANDOM_PUSH_INTERVAL_MS)

    client.on('close', () => {
      clearInterval(pushTimer)
    })

    client.on('error', () => {
      clearInterval(pushTimer)
    })

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
    server.listen(options.port ?? 0, '127.0.0.1')
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
