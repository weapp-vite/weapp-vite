import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer } from 'node:http'
import { setTimeout as delay } from 'node:timers/promises'
import { URL } from 'node:url'

interface QueryServerState {
  listCompletions: Record<string, number>
  listRequests: Record<string, number>
  mutationRequests: number
  revision: number
}

export interface QueryServerHandle {
  baseUrl: string
  state: QueryServerState
  stop: () => Promise<void>
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

async function handleQueryRequest(
  request: IncomingMessage,
  response: ServerResponse,
  state: QueryServerState,
) {
  const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
  if (request.method === 'GET' && requestUrl.pathname === '/query/items') {
    const filter = requestUrl.searchParams.get('filter') ?? 'all'
    const requestNumber = (state.listRequests[filter] ?? 0) + 1
    const revision = state.revision
    state.listRequests[filter] = requestNumber
    let responseDelay = 90
    if (filter === 'slow') {
      responseDelay = 650
    }
    else if (filter === 'fast') {
      responseDelay = 30
    }
    await delay(responseDelay)
    state.listCompletions[filter] = (state.listCompletions[filter] ?? 0) + 1
    sendJson(response, 200, {
      filter,
      items: [{ id: '1', title: `item-${filter}-r${revision}` }],
      requestId: `${filter}-${requestNumber}`,
      revision,
    })
    return
  }

  const itemId = requestUrl.pathname.match(/^\/query\/items\/([^/]+)$/)?.[1]
  if (request.method === 'POST' && itemId) {
    state.mutationRequests += 1
    state.revision += 1
    sendJson(response, 200, {
      id: decodeURIComponent(itemId),
      revision: state.revision,
    })
    return
  }

  sendJson(response, 404, { error: 'not found' })
}

export async function startQueryServer(): Promise<QueryServerHandle> {
  const state: QueryServerState = {
    listCompletions: {},
    listRequests: {},
    mutationRequests: 0,
    revision: 0,
  }
  const server = createServer((request, response) => {
    void handleQueryRequest(request, response, state).catch((error) => {
      if (!response.writableEnded) {
        sendJson(response, 500, {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    await new Promise<void>(resolve => server.close(() => resolve()))
    throw new Error('Query fixture server did not expose a TCP port')
  }
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    state,
    stop: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve())
    }),
  }
}
