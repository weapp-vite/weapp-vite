import type { HeadlessSession, HeadlessWxRequestOption } from '../../mpcore/packages/simulator/src'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { installStatefulHmrTransport } from '../ide/statefulHmrDom/transport'

const cleanups: Array<() => Promise<unknown>> = []
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) {
    await cleanup()
  }
})

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'hmr-host-transport-'))
  const input = path.join(root, 'emitted-input.js')
  await writeFile(input, 'globalThis.received = true;')
  cleanups.push(() => rm(root, { recursive: true, force: true }))
  let response: string | undefined = '{"type":"registered"}'
  const received: unknown[] = []
  const server = createServer((request, reply) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => {
      received.push(JSON.parse(body))
      if (response !== undefined) {
        reply.setHeader('content-type', 'application/json')
        reply.end(response)
      }
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  cleanups.push(() => new Promise<void>((resolve, reject) => {
    server.closeAllConnections()
    server.close(error => error ? reject(error) : resolve())
  }))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Expected loopback server')
  }
  const endpoint = `http://127.0.0.1:${address.port}/__weapp_vite_stateful_hmr__`
  const original = vi.fn()
  const wx = { request: original as (option: HeadlessWxRequestOption) => unknown }
  const evaluateRuntime = vi.fn()
  const session = { getWx: () => wx, evaluateRuntime } as unknown as HeadlessSession
  const transport = installStatefulHmrTransport(session, endpoint, input)
  cleanups.push(() => transport.close())
  function send() {
    return new Promise((resolve, reject) => {
      wx.request({ url: endpoint, method: 'POST', data: { action: 'poll', version: 0 }, success: resolve, fail: reject })
    })
  }
  return {
    wx,
    endpoint,
    input,
    original,
    evaluateRuntime,
    received,
    send,
    transport,
    respond: (value: string | undefined) => {
      response = value
    },
  }
}

describe('stateful HMR headless host transport', () => {
  it('rejects a provisional zero port before replacing the mock-only host', () => {
    const getWx = vi.fn()
    const session = { getWx } as unknown as HeadlessSession
    expect(() => installStatefulHmrTransport(session, 'http://localhost:0/__weapp_vite_stateful_hmr__', 'emitted-input.js')).toThrow()
    expect(getWx).not.toHaveBeenCalled()
  })

  it('executes emitted source only after a real batch-published response', async () => {
    const context = await fixture()
    await context.send()
    expect(context.received).toEqual([{ action: 'poll', version: 0 }])
    await writeFile(context.input, 'globalThis.received = "updated";')
    context.respond('{"type":"changed"}')
    await context.send()
    expect(context.evaluateRuntime).not.toHaveBeenCalled()
    context.respond('{"type":"batch-published"}')
    await context.send()
    await vi.waitFor(() => expect(context.evaluateRuntime).toHaveBeenCalledExactlyOnceWith('() => {\nglobalThis.received = "updated";\n}'))
    context.transport.assertHealthy()
  })

  it('preserves failures and does not apply an invalid response', async () => {
    const context = await fixture()
    context.respond('invalid json')
    await expect(context.send()).rejects.toThrow()
    expect(context.evaluateRuntime).not.toHaveBeenCalled()
    context.respond('{"type":"batch-published"}')
    context.evaluateRuntime.mockImplementation(() => {
      throw new Error('runtime failure')
    })
    await context.send()
    await vi.waitFor(() => expect(() => context.transport.assertHealthy()).toThrow('runtime failure'))
  })

  it('delegates other URLs and methods to the original mock-only host', async () => {
    const context = await fixture()
    for (const option of [
      { url: context.endpoint, method: 'GET' },
      { url: `${context.endpoint}/other`, method: 'POST' },
      { url: 'https://example.invalid/request', method: 'POST' },
    ]) {
      context.wx.request(option)
      expect(context.original).toHaveBeenLastCalledWith(option)
    }
    expect(context.received).toEqual([])
  })

  it('aborts pending long polls and restores the original host on disposal', async () => {
    const context = await fixture()
    context.respond(undefined)
    const failure = context.send().catch(error => error)
    await vi.waitFor(() => expect(context.received).toHaveLength(1))
    await context.transport.close()
    expect(await failure).toMatchObject({ message: 'request:fail abort' })
    expect(context.wx.request).toBe(context.original)
    await context.transport.close()
  })
})
