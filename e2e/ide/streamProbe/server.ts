import type { ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createServer } from 'node:http'

export const streamPayload = [0, 65, 0xE4, 0xB8, 0xAD, 0xF0, 0x9F, 0x99, 0x82, 255]
/** 每个响应由测试端显式放行，避免把定时器快慢误判为网络流式能力。 */
export async function startStreamProbeServer() {
  const requests = new Map<string, { response: ServerResponse, ended: boolean, closed: boolean }>()
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const id = url.searchParams.get('id')
    if (url.pathname !== '/stream' || !id || requests.has(id)) {
      res.writeHead(404).end()
      return
    }
    const state = { response: res, ended: false, closed: false }
    requests.set(id, state)
    res.on('close', () => {
      state.closed = true
    })
    res.setHeader('content-type', 'application/octet-stream')
    res.setHeader('cache-control', 'no-store')
    res.setHeader('access-control-allow-origin', '*')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return {
    baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    requests,
    first(id: string) {
      requests.get(id)!.response.write(new Uint8Array(streamPayload.slice(0, 3)))
    },
    middle(id: string) { requests.get(id)!.response.write(new Uint8Array(streamPayload.slice(3, 7))) },
    finish(id: string, empty = false) {
      const state = requests.get(id)!
      state.ended = true
      state.response.end(empty ? undefined : new Uint8Array(streamPayload.slice(7)))
    },
    disconnect(id: string) {
      requests.get(id)!.response.destroy()
    },
    async stop() {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    },
  }
}
