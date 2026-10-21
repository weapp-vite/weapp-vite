import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ViteDevServer } from 'vite'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import { WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE } from '@weapp-core/constants'
import { describe, expect, it, vi } from 'vitest'
import { renderBatch, StatefulHmrTransport } from './transport'

function createTransport() {
  let handler: ((request: IncomingMessage, response: ServerResponse) => Promise<void>) | undefined
  const fullBuild = vi.fn()
  const error = vi.fn()
  const logger = { error: vi.fn(), warn: vi.fn() }
  let transport: StatefulHmrTransport
  const classic = vi.fn(() => transport.retire())
  const server = {
    config: { server: { port: 0 }, logger },
    middlewares: { use: (_path: string, middleware: typeof handler) => { handler = middleware } },
  } as unknown as ViteDevServer
  transport = new StatefulHmrTransport(server, async () => {}, fullBuild, classic, error)
  transport.install()
  return {
    transport,
    fullBuild,
    error,
    classic,
    logger,
    async post(body: Record<string, unknown>) {
      let result = ''
      const request = Readable.from([JSON.stringify({ ...transport.createControl(), sessionId: 'test-session', version: 0, ...body })]) as IncomingMessage
      request.method = 'POST'
      const response = Object.assign(new EventEmitter(), {
        writableEnded: false,
        statusCode: 0,
        setHeader: vi.fn(),
        end(value: string) { result = value },
      })
      await handler!(request, response as unknown as ServerResponse)
      return { status: response.statusCode, value: result ? JSON.parse(result) as unknown : undefined }
    },
  }
}

describe('stateful hmr transport', () => {
  it('renders executable deltas only into the literal update module', () => {
    const source = renderBatch({
      buildId: 'build-a',
      deltas: [
        { changedIds: ['src/a.ts'], code: 'patchOne();' },
        { changedIds: ['src/b.ts', 'src/a.ts'], code: 'patchTwo();' },
      ],
      fromVersion: 2,
      targetVersion: 4,
    }, 'nonce-a')

    expect(source).toContain('// nonce-a')
    expect(source).toContain('"fromVersion":2')
    expect(source).toContain('"targetVersion":4')
    expect(source).toContain('"changedIds":["src/a.ts","src/b.ts"]')
    expect(source).toContain('patchOne();')
    expect(source).toContain('patchTwo();')
    expect(source).not.toContain('applyChangedModules(["src/a.ts","src/b.ts"])')
    expect(source).not.toMatch(/\beval\s*\(|new\s+Function|\bFunction\s*\(/)
  })

  it.each([
    { reason: 'bridge-not-ready', code: undefined, capability: 'runtime-contract' },
    { reason: 'patch-failed', code: WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE, capability: 'native-registration' },
  ])('retires the old transport after an explicit $capability failure', async ({ reason, code, capability }) => {
    const fixture = createTransport()
    expect(await fixture.post({ action: 'rebuild', failure: { reason, code, message: 'unsupported capability' } })).toEqual({ status: 410, value: { type: 'retired' } })
    expect(fixture.classic).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ code: capability }))
    expect(fixture.fullBuild).not.toHaveBeenCalled()
    expect(fixture.error).not.toHaveBeenCalled()
    expect(fixture.logger.warn).toHaveBeenCalledExactlyOnceWith(`[weapp-vite] stateful HMR capability fallback ${reason}: unsupported capability\n`)
    expect(fixture.logger.error).not.toHaveBeenCalled()
    expect(await fixture.post({ action: 'register' })).toEqual({ status: 410, value: { type: 'retired' } })
    expect(fixture.logger.warn).toHaveBeenCalledOnce()
    fixture.transport.close()
    fixture.transport.close()
  })

  it.each([
    { code: 'USER_ERROR', message: 'business callback failed' },
    { code: undefined, message: 'Native registration failed; classic rebuild is required.' },
  ])('reports ordinary patch exceptions without disguising them as fallback or rebuilding ($code)', async ({ code, message }) => {
    const fixture = createTransport()
    const pending = fixture.transport.addDelta('patch();', ['src/page.ts'])
    const rejected = expect(pending).rejects.toThrow(message)
    expect(await fixture.post({ action: 'rebuild', failure: { reason: 'patch-failed', code, message } })).toEqual({ status: 422, value: { type: 'error' } })
    await rejected
    expect(fixture.error).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message }))
    expect(fixture.logger.error).toHaveBeenCalledExactlyOnceWith(`[weapp-vite] stateful HMR client patch-failed: ${message}\n`)
    expect(fixture.logger.warn).not.toHaveBeenCalled()
    expect(fixture.classic).not.toHaveBeenCalled()
    expect(fixture.fullBuild).not.toHaveBeenCalled()
    fixture.transport.close()
  })

  it('preserves ordinary client version resynchronization without changing runtime mode', async () => {
    const fixture = createTransport()
    expect(await fixture.post({ action: 'rebuild' })).toEqual({ status: 202, value: { type: 'rebuilding' } })
    expect(fixture.fullBuild).toHaveBeenCalledOnce()
    expect(fixture.classic).not.toHaveBeenCalled()
    fixture.transport.close()
  })
})
