import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ViteDevServer } from 'vite'
import { Readable } from 'node:stream'
import { expect, it, vi } from 'vitest'
import { StatefulHmrTransport } from './transport'

function fixture() {
  const use = vi.fn()
  const write = vi.fn(async () => {})
  const rebuild = vi.fn()
  const server = { middlewares: { use }, config: { server: {}, logger: { error: vi.fn() } } } as unknown as ViteDevServer
  const transport = new StatefulHmrTransport(server, write, rebuild)
  transport.install()
  const control = transport.createControl()
  const handler = use.mock.calls[0]![1] as (req: IncomingMessage, res: ServerResponse) => Promise<void>
  const report = async (action: string, version = 0, overrides = {}) => {
    const request = Object.assign(Readable.from([JSON.stringify({ ...control, action, sessionId: 'client', version, ...overrides })]), { method: 'POST' })
    const response = { on: vi.fn(), setHeader: vi.fn(), end: vi.fn(), statusCode: 0 }
    await handler(request as IncomingMessage, response as unknown as ServerResponse)
    return response
  }
  return { transport, write, report, rebuild }
}

it('confirms a consumed batch without holding another poll open', async () => {
  const { transport, report, write } = fixture()
  const delivered = vi.fn(async () => {})
  try {
    const registered = await report('register')
    expect(JSON.parse(registered.end.mock.calls[0]![0])).toMatchObject({ acknowledgement: 'explicit-v1' })
    const completed = transport.addDelta('first()', [], delivered)
    expect((await report('ack', 1)).statusCode).toBe(409)
    expect(delivered).not.toHaveBeenCalled()
    await report('poll')
    expect((await report('ack', 1, { sessionId: 'retired' })).statusCode).toBe(409)
    expect((await report('ack', 2)).statusCode).toBe(409)
    expect(delivered).not.toHaveBeenCalled()
    const acknowledged = await report('ack', 1)
    expect(acknowledged.statusCode).toBe(200)
    expect(JSON.parse(acknowledged.end.mock.calls[0]![0])).toEqual({ type: 'acknowledged', version: 1 })
    await completed
    expect((await report('ack', 1)).statusCode).toBe(200)
    expect(delivered).toHaveBeenCalledOnce()
    expect(write).toHaveBeenCalledOnce()
  }
  finally {
    transport.close()
  }
})

it('acknowledges execution once, after successful publication and a valid client report', async () => {
  const { transport, report, write } = fixture()
  const delivered = vi.fn(async () => {})
  try {
    await report('register')
    const executed = transport.addDelta('first()', [], delivered)
    expect(delivered).not.toHaveBeenCalled()
    await report('poll')
    expect(write).toHaveBeenCalledOnce()
    expect(delivered).not.toHaveBeenCalled()
    await report('poll', 1, { sessionId: 'retired' })
    expect(delivered).not.toHaveBeenCalled()
    await report('poll', 1)
    await executed
    await report('poll', 1)
    expect(delivered).toHaveBeenCalledOnce()
    await report('poll', 0)
    expect(write).toHaveBeenCalledOnce()
  }
  finally {
    transport.close()
  }
})

it.each(['poll', 'ack'])('retries publication and %s confirmation without adding another delta', async (confirmation) => {
  const { transport, report, write } = fixture()
  const delivered = vi.fn().mockRejectedValueOnce(new Error('engine unavailable')).mockResolvedValue(undefined)
  try {
    await report('register')
    const executed = transport.addDelta('first()', [], delivered)
    write.mockRejectedValueOnce(new Error('disk unavailable'))
    expect((await report('poll')).statusCode).toBe(500)
    expect(delivered).not.toHaveBeenCalled()
    expect((await report('poll')).statusCode).toBe(200)
    expect((await report(confirmation, 1)).statusCode).toBe(500)
    await report(confirmation, 1)
    await executed
    expect(transport.retainedDeltaCount).toBe(1)
    expect(delivered).toHaveBeenCalledTimes(2)
  }
  finally {
    transport.close()
  }
})

it.each(['poll', 'ack'])('keeps %s confirmation pending when the host runs a patch before publication settles', async (action) => {
  const { transport, report, write } = fixture()
  const delivered = vi.fn(async () => {})
  const publication = Promise.withResolvers<void>()
  const publicationStarted = Promise.withResolvers<void>()
  write.mockImplementationOnce(async () => {
    publicationStarted.resolve()
    await publication.promise
  })
  try {
    await report('register')
    const executed = transport.addDelta('first()', [], delivered)
    const publishing = report('poll')
    await publicationStarted.promise
    // 宿主的文件监听可在 writeBundle 完成前执行已经写出的补丁。
    const early = await report(action, 1)
    expect(early.statusCode).toBe(202)
    expect(JSON.parse(early.end.mock.calls[0]![0])).toEqual({ type: 'publishing' })
    expect(delivered).not.toHaveBeenCalled()
    publication.resolve()
    await publishing
    await report('poll', 1)
    expect(delivered).toHaveBeenCalledOnce()
    await executed
    const second = transport.addDelta('second()', [], delivered)
    await report('poll', 1)
    await report('poll', 2)
    await second
    expect(delivered).toHaveBeenCalledTimes(2)
  }
  finally {
    publication.resolve()
    transport.close()
  }
})

it('confirms replayed execution after DevTools replaces its client session during publication', async () => {
  const { transport, report } = fixture()
  const delivered = vi.fn(async () => {})
  try {
    await report('register')
    const executed = transport.addDelta('first()', [], delivered)
    await report('poll')
    await report('register', 0, { sessionId: 'replacement' })
    await report('poll', 1, { sessionId: 'replacement' })
    expect(delivered).toHaveBeenCalledOnce()
    await executed
    expect((await report('ack', 1, { sessionId: 'client' })).statusCode).toBe(409)
    await report('register', 0, { sessionId: 'third' })
    const replay = await report('poll', 0, { sessionId: 'third' })
    expect(JSON.parse(replay.end.mock.calls[0]![0])).toMatchObject({ type: 'batch-published', targetVersion: 1 })
    expect((await report('ack', 1, { sessionId: 'third' })).statusCode).toBe(200)
    expect(delivered).toHaveBeenCalledOnce()
  }
  finally {
    transport.close()
  }
})
