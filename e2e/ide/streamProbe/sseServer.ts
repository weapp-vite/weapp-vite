import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'

interface SseRequestState {
  response: ServerResponse
  request: IncomingMessage
  body: string
  ended: boolean
  closed: boolean
}

/** 测试端逐阶段放行响应头和事件，明确区分真实增量交付与完成后读取。 */
export async function startSseServer() {
  const requests = new Map<string, SseRequestState[]>()
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    const id = url.searchParams.get('id')
    if (!id || !['/stream', '/sse/fetch', '/sse/events'].includes(url.pathname)) {
      response.writeHead(404).end()
      return
    }
    const chunks: Buffer[] = []
    request.on('data', chunk => chunks.push(Buffer.from(chunk)))
    request.on('end', () => {
      const state: SseRequestState = { response, request, body: Buffer.concat(chunks).toString('utf8'), ended: false, closed: false }
      requests.set(id, [...(requests.get(id) ?? []), state])
      response.on('close', () => {
        state.closed = true
      })
      response.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
      response.setHeader('Cache-Control', 'no-store')
      response.setHeader('Access-Control-Allow-Origin', '*')
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const select = (id: string, index: number) => {
    const state = requests.get(id)?.[index]
    if (!state) {
      throw new Error(`No registered SSE request ${id}/${index}`)
    }
    return state
  }
  return {
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    requests,
    headers(id: string, index = 0, status = 200) {
      const state = select(id, index)
      state.response.statusCode = status
      state.response.flushHeaders()
    },
    write(id: string, text: string, index = 0) {
      select(id, index).response.write(text)
    },
    finish(id: string, index = 0) {
      const state = select(id, index)
      state.ended = true
      state.response.end()
    },
    disconnect(id: string, index = 0) {
      select(id, index).response.destroy()
    },
    async stop() {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    },
  }
}
