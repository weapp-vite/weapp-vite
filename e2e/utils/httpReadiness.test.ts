import type { Server as NetServer, Socket } from 'node:net'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { createServer as createTcpServer } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { isHttpServerReady } from './httpReadiness'

const servers: NetServer[] = []
const sockets = new Set<Socket>()

async function listen(server: NetServer) {
  servers.push(server)
  server.on('connection', (socket) => {
    sockets.add(socket)
    socket.once('close', () => sockets.delete(socket))
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Expected a TCP test server')
  }
  return `http://127.0.0.1:${address.port}`
}

afterEach(async () => {
  for (const socket of sockets) {
    socket.destroy()
  }
  for (const server of servers.splice(0)) {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  }
  sockets.clear()
})

describe('HTTP readiness transport', () => {
  it.each([200, 204, 404, 503])('requires a successful HTTP status (%i)', async (status) => {
    const url = await listen(createServer((_request, response) => {
      response.writeHead(status)
      response.end()
    }))
    expect(await isHttpServerReady(url)).toBe(status < 300)
    await expect.poll(() => sockets.size).toBe(0)
  })

  it('follows relative redirects and rejects redirect loops', async () => {
    const url = await listen(createServer((request, response) => {
      if (request.url === '/ready') {
        response.writeHead(200)
      }
      else {
        response.writeHead(302, { location: request.url === '/loop' ? '/loop' : '/ready' })
      }
      response.end()
    }))
    expect(await isHttpServerReady(url)).toBe(true)
    await expect(isHttpServerReady(`${url}/loop`)).rejects.toThrow('redirect limit')
    await expect.poll(() => sockets.size).toBe(0)
  })

  it('returns connection refusal as a rejection that the startup loop can retry', async () => {
    const server = createTcpServer()
    const url = await listen(server)
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await expect(isHttpServerReady(url)).rejects.toMatchObject({ code: 'ECONNREFUSED' })
  })

  it('survives repeated resets without an uncaught socket QoS exception', async () => {
    // Node 内置 fetch 在 macOS 的同一真实 TCP 场景可抛出未捕获 setTypeOfService EINVAL。
    // https://github.com/nodejs/undici/issues/5544
    const url = await listen(createTcpServer(socket => socket.resetAndDestroy()))
    for (let attempt = 0; attempt < 30; attempt++) {
      // 重置先于写入时是 EPIPE，读取阶段观察到重置时是 ECONNRESET；二者都必须通过 Promise 拒绝。
      await expect(isHttpServerReady(url)).rejects.toMatchObject({ code: expect.stringMatching(/^(?:ECONNRESET|EPIPE)$/) })
    }
    await expect.poll(() => sockets.size).toBe(0)
  })

  it('aborts a silent server within the request deadline and releases its socket', async () => {
    // 消费请求字节才能观察客户端 FIN；服务端仍不发送任何响应。
    const url = await listen(createTcpServer(socket => socket.resume()))
    await expect(isHttpServerReady(url, 100)).rejects.toMatchObject({ name: 'AbortError' })
    await expect.poll(() => sockets.size).toBe(0)
  })

  it('releases an unfinished response body after receiving successful headers', async () => {
    const url = await listen(createServer((_request, response) => {
      response.writeHead(200)
      response.write('stream remains open')
    }))
    expect(await isHttpServerReady(url)).toBe(true)
    await expect.poll(() => sockets.size).toBe(0)
  })

  it('bounds the whole redirect chain with one deadline', async () => {
    const url = await listen(createServer((request, response) => {
      if (request.url === '/silent') {
        return
      }
      response.writeHead(307, { location: '/silent' })
      response.end()
    }))
    await expect(isHttpServerReady(url, 100)).rejects.toMatchObject({ name: 'AbortError' })
    await expect.poll(() => sockets.size).toBe(0)
  })

  it('rejects unsupported URLs and invalid deadlines', async () => {
    await expect(isHttpServerReady('file:///readiness')).rejects.toThrow('Unsupported readiness protocol')
    await expect(isHttpServerReady('invalid-url')).rejects.toThrow()
    await expect(isHttpServerReady('http://localhost', 0)).rejects.toThrow('positive and finite')
  })
})
