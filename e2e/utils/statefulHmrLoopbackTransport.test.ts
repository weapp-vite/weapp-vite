import type { Server as NetServer, Socket } from 'node:net'
import type { HeadlessSession, HeadlessWxRequestOption, HeadlessWxRequestSuccessResult } from '../../mpcore/packages/simulator/src'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { createServer as createTcpServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE } from '@weapp-core/constants'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installStatefulHmrTransport } from './statefulHmrTransport'

const cleanups: Array<() => void | Promise<void>> = []
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
  return `http://127.0.0.1:${address.port}/__weapp_vite_stateful_hmr__`
}

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'stateful-hmr-loopback-'))
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  await mkdir(path.dirname(path.join(root, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE)), { recursive: true })
  const original = vi.fn<ReturnType<HeadlessSession['getWx']>['request']>()
  const wx = { request: original as ReturnType<HeadlessSession['getWx']>['request'] }
  const evaluateRuntime = vi.fn()
  const session = { getWx: () => wx, evaluateRuntime } as unknown as HeadlessSession
  const dispose = installStatefulHmrTransport(session, root)
  cleanups.push(dispose)
  function send(url: string, data: unknown = { action: 'poll', version: 0 }) {
    return new Promise<HeadlessWxRequestSuccessResult>((resolve, reject) => {
      wx.request({ url, method: 'POST', data, success: resolve, fail: reject })
    })
  }
  return { root, original, wx, evaluateRuntime, dispose, send }
}

afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup()
  }
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

describe('stateful HMR loopback transport', () => {
  it.each([200, 503])('posts JSON and preserves response data and HTTP status %i', async (statusCode) => {
    const context = await fixture()
    const received: unknown[] = []
    const url = await listen(createServer((request, response) => {
      let body = ''
      request.setEncoding('utf8')
      request.on('data', (chunk) => {
        body += chunk
      })
      request.on('end', () => {
        received.push({ method: request.method, contentType: request.headers['content-type'], data: JSON.parse(body) })
        response.writeHead(statusCode, { 'content-type': 'application/json' })
        response.end('{"type":"registered","message":"已注册"}')
      })
    }))
    const data = { action: 'register', name: '测试宿主' }
    expect(await context.send(url, data)).toEqual({
      data: { type: 'registered', message: '已注册' },
      statusCode,
      header: {},
      cookies: [],
      errMsg: 'request:ok',
    })
    expect(received).toEqual([{ method: 'POST', contentType: 'application/json', data }])
    expect(context.evaluateRuntime).not.toHaveBeenCalled()
    await expect.poll(() => sockets.size).toBe(0)
  })

  it('applies the emitted update only after the batch-published success callback', async () => {
    const context = await fixture()
    const source = 'globalThis.received = "更新";'
    await writeFile(path.join(context.root, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE), source)
    const url = await listen(createServer((_request, response) => response.end('{"type":"batch-published"}')))
    const order: string[] = []
    context.evaluateRuntime.mockImplementation(() => order.push('runtime'))
    const fail = vi.fn()
    context.wx.request({ url, data: { action: 'poll' }, success: () => order.push('success'), fail })
    await expect.poll(() => order).toEqual(['success', 'runtime'])
    expect(context.evaluateRuntime).toHaveBeenCalledExactlyOnceWith(`() => {\n${source}\n}`)
    expect(fail).not.toHaveBeenCalled()
  })

  it('reports malformed JSON and runtime evaluation errors through the request failure callback', async () => {
    const context = await fixture()
    let reply = 'invalid json'
    const url = await listen(createServer((_request, response) => response.end(reply)))
    await expect(context.send(url)).rejects.toBeInstanceOf(SyntaxError)
    expect(context.evaluateRuntime).not.toHaveBeenCalled()
    reply = '{"type":"batch-published"}'
    await writeFile(path.join(context.root, WEAPP_VITE_STATEFUL_HMR_UPDATE_FILE), 'throw new Error("runtime failure")')
    const runtimeError = new Error('runtime failure')
    context.evaluateRuntime.mockImplementation(() => {
      throw runtimeError
    })
    const success = vi.fn()
    const fail = vi.fn()
    context.wx.request({ url, data: { action: 'poll' }, success, fail })
    await expect.poll(() => fail.mock.calls).toEqual([[runtimeError]])
    expect(success).toHaveBeenCalledTimes(1)
  })

  it('delegates requests outside the exact loopback endpoint to the original host', async () => {
    const context = await fixture()
    const url = await listen(createServer())
    for (const option of [
      { url: `${url}/other` },
      { url: url.replace('http:', 'https:') },
      { url: 'https://example.invalid/request' },
      { url: 'http://localhost/__weapp_vite_stateful_hmr__' },
    ] satisfies HeadlessWxRequestOption[]) {
      context.wx.request(option)
      expect(context.original).toHaveBeenLastCalledWith(option)
      expect(context.original.mock.contexts.at(-1)).toBe(context.wx)
    }
    expect(sockets.size).toBe(0)
  })

  it('aborts an individual long poll once and releases its socket', async () => {
    const context = await fixture()
    const url = await listen(createTcpServer(socket => socket.resume()))
    const success = vi.fn()
    const fail = vi.fn()
    const task = context.wx.request({ url, data: { action: 'poll' }, success, fail })
    await expect.poll(() => sockets.size).toBe(1)
    task.abort()
    task.abort()
    await expect.poll(() => fail.mock.calls).toMatchObject([[{ name: 'AbortError' }]])
    await expect.poll(() => sockets.size).toBe(0)
    expect(fail).toHaveBeenCalledTimes(1)
    expect(success).not.toHaveBeenCalled()
    expect(context.evaluateRuntime).not.toHaveBeenCalled()
  })

  it('disposes all pending polls without late callbacks and restores the original host', async () => {
    const context = await fixture()
    const url = await listen(createTcpServer(socket => socket.resume()))
    const success = vi.fn()
    const fail = vi.fn()
    for (let index = 0; index < 2; index++) {
      context.wx.request({ url, data: { action: 'poll' }, success, fail })
    }
    await expect.poll(() => sockets.size).toBe(2)
    context.dispose()
    context.dispose()
    await expect.poll(() => sockets.size).toBe(0)
    expect(context.wx.request).toBe(context.original)
    expect(success).not.toHaveBeenCalled()
    expect(fail).not.toHaveBeenCalled()
    expect(context.evaluateRuntime).not.toHaveBeenCalled()
  })

  it('reports repeated TCP resets without an uncaught socket QoS exception', async () => {
    const context = await fixture()
    // Node 内置 Undici 在 macOS 上的 reset/write 竞争可抛出 setTypeOfService EINVAL。
    // https://github.com/nodejs/undici/issues/5544
    const url = await listen(createTcpServer(socket => socket.resetAndDestroy()))
    for (let attempt = 0; attempt < 30; attempt++) {
      await expect(context.send(url)).rejects.toMatchObject({ code: expect.stringMatching(/^(?:ECONNRESET|EPIPE)$/) })
    }
    await expect.poll(() => sockets.size).toBe(0)
    expect(context.evaluateRuntime).not.toHaveBeenCalled()
  })

  it('reports a reset during an unfinished response body', async () => {
    const context = await fixture()
    const url = await listen(createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.write('{"type":', () => response.socket?.resetAndDestroy())
    }))
    await expect(context.send(url)).rejects.toMatchObject({ code: 'ECONNRESET' })
    await expect.poll(() => sockets.size).toBe(0)
    expect(context.evaluateRuntime).not.toHaveBeenCalled()
  })
})
