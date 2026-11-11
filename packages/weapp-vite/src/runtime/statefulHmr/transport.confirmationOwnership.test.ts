import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ViteDevServer } from 'vite'
import { Readable } from 'node:stream'
import { expect, it, vi } from 'vitest'
import { StatefulHmrTransport } from './transport'

function fixture() {
  const use = vi.fn()
  const rebuild = vi.fn()
  const fallback = vi.fn()
  const server = { middlewares: { use }, config: { server: {}, logger: { error: vi.fn(), warn: vi.fn() } } } as unknown as ViteDevServer
  const transport = new StatefulHmrTransport(server, vi.fn(async () => {}), rebuild, fallback)
  transport.install()
  const control = transport.createControl()
  const handler = use.mock.calls[0]![1] as (req: IncomingMessage, res: ServerResponse) => Promise<void>
  const report = async (action: string, overrides = {}) => {
    const request = Object.assign(Readable.from([JSON.stringify({ ...control, action, sessionId: 'client', version: 0, ...overrides })]), { method: 'POST' })
    const response = { on: vi.fn(), setHeader: vi.fn(), end: vi.fn(), statusCode: 0 }
    await handler(request as IncomingMessage, response as unknown as ServerResponse)
    const body = response.end.mock.calls[0]?.[0] as string | undefined
    return { status: response.statusCode, body: body ? JSON.parse(body) as { type: string, ready?: boolean } : undefined }
  }
  return { transport, report, rebuild, fallback }
}

it('does not let a retired initial confirmation consume the next build payloads', async () => {
  const { transport, report } = fixture()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const nextDelivered = vi.fn(async () => {})
  transport.registerInitialPayloads(['app.js'], async () => {
    entered.resolve()
    await release.promise
  })
  let registering: ReturnType<typeof report> | undefined
  try {
    registering = report('register', { payloads: ['app.js'], initialReady: false })
    await entered.promise
    transport.commitFullBuild('next-build')
    transport.registerInitialPayloads(['app.js'], nextDelivered)
    release.resolve()
    expect((await registering).status).toBe(409)
    const next = { buildId: 'next-build', sessionId: 'replacement', initialReady: false }
    expect((await report('register', { ...next, payloads: [] })).body).toMatchObject({ ready: false })
    expect((await report('register', { ...next, payloads: ['app.js'] })).body).toMatchObject({ ready: true })
    expect(nextDelivered).toHaveBeenCalledExactlyOnceWith('app.js')
  }
  finally {
    release.resolve()
    await registering
    transport.close()
  }
})

it('rejects stale registration instead of claiming the current runtime is registered', async () => {
  const { transport, report } = fixture()
  try {
    transport.commitFullBuild('next-build')
    const result = await report('register', { payloads: ['app.js'], initialReady: false })
    expect(result.status).toBe(409)
    expect(result.body?.type).toBe('rebuilding')
  }
  finally {
    transport.close()
  }
})

it.each(['stale-build', 'retired-session'])('rejects a %s rebuild without interrupting the active client', async (kind) => {
  const { transport, report, rebuild, fallback } = fixture()
  try {
    await report('register')
    if (kind === 'retired-session') {
      await report('register', { sessionId: 'replacement' })
    }
    const result = await report('rebuild', {
      ...(kind === 'stale-build' ? { buildId: 'retired-build' } : {}),
      failure: { reason: 'bridge-not-ready' },
    })
    expect(result.status).toBe(409)
    expect(rebuild).not.toHaveBeenCalled()
    expect(fallback).not.toHaveBeenCalled()
  }
  finally {
    transport.close()
  }
})
