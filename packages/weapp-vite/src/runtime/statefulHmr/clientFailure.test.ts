import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ViteDevServer } from 'vite'
import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import { runInNewContext } from 'node:vm'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY, WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE } from '@weapp-core/constants'
import { describe, expect, it, vi } from 'vitest'
import { createStatefulHmrControlSource } from './runtimeSource'
import { StatefulHmrTransport } from './transport'

describe('stateful HMR client failure reporting', () => {
  it.each([200, 410, 422])('stops terminal clients without polling or re-registering (HTTP %s)', async (statusCode) => {
    vi.useFakeTimers()
    const requests: any[] = []
    const context: Record<string, any> = {
      console: { error: vi.fn(), warn: vi.fn() },
      setTimeout,
      clearTimeout,
      wx: {
        request(options: unknown) {
          requests.push(options)
          return { abort: vi.fn() }
        },
      },
    }
    try {
      runInNewContext(createStatefulHmrControlSource({ buildId: 'build', token: 'test-token', url: 'http://localhost/hmr' }), context)
      const client = context[WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY]
      requests[0].success({ statusCode: 200, data: { type: 'registered' } })
      const poll = requests[1]
      poll.success({ statusCode, data: { type: statusCode === 410 ? 'gone' : statusCode === 422 ? 'error' : 'retired' } })
      expect(client.getTransportState().phase).toBe('stopped')
      expect(context.console.error).toHaveBeenCalledTimes(statusCode === 422 ? 1 : 0)
      if (statusCode === 422) {
        expect(context.console.error).toHaveBeenCalledWith('[weapp-vite] stateful HMR stopped after a patch error')
      }
      expect(context.console.warn).not.toHaveBeenCalled()
      poll.fail({ errMsg: 'request:fail abort' })
      await vi.advanceTimersByTimeAsync(30_000)
      expect(requests).toHaveLength(2)
      expect(vi.getTimerCount()).toBe(0)
    }
    finally {
      context[WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY]?.stop()
      vi.useRealTimers()
    }
  })

  it('re-registers the current page after a full rebuild response', async () => {
    vi.useFakeTimers()
    const requests: any[] = []
    const context: Record<string, any> = {
      setTimeout,
      clearTimeout,
      wx: {
        request(options: any) {
          requests.push(options)
          return { abort: vi.fn() }
        },
      },
    }
    try {
      runInNewContext(createStatefulHmrControlSource({ buildId: 'build', token: 'test-token', url: 'http://localhost/hmr' }), context)
      requests[0].success({ statusCode: 200, data: { type: 'registered' } })
      expect(requests[1].data.action).toBe('poll')
      requests[1].success({ statusCode: 409, data: { type: 'rebuilding', buildId: 'next-build' } })
      await vi.advanceTimersByTimeAsync(0)
      expect(requests.at(-1).data).toMatchObject({ action: 'register', buildId: 'next-build', version: 0 })
    }
    finally {
      context[WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY]?.stop()
      vi.useRealTimers()
    }
  })

  it.each(['sync', 'async'] as const)('keeps stopped clients inactive when abort reports a %s failure, allowing a new client to register', async (abortTiming) => {
    vi.useFakeTimers()
    const requests: any[] = []
    const context: Record<string, any> = {
      setTimeout,
      clearTimeout,
      wx: {
        request(options: any) {
          requests.push(options)
          return {
            abort() {
              const fail = () => options.fail({ errMsg: 'request:fail abort' })
              if (abortTiming === 'sync') {
                fail()
              }
              else { setTimeout(fail, 0) }
            },
          }
        },
      },
    }
    const control = { buildId: 'build', token: 'test-token', url: 'http://localhost/hmr' }
    const source = createStatefulHmrControlSource(control)
    try {
      runInNewContext(source, context)
      const stopped = context[WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY]
      const staleRequest = requests[0]
      stopped.stop()
      await vi.advanceTimersByTimeAsync(1500)
      expect(requests).toHaveLength(1)
      expect(stopped.getTransportState().phase).toBe('stopped')
      expect(vi.getTimerCount()).toBe(0)

      runInNewContext(source, context)
      const current = context[WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY]
      expect(current).not.toBe(stopped)
      expect(requests).toHaveLength(2)
      expect(requests[1].data.action).toBe('register')
      staleRequest.success({ statusCode: 200, data: { type: 'registered' } })
      const apply = vi.fn()
      stopped.receiveBatch({ buildId: control.buildId, fromVersion: 0, targetVersion: 1, changedIds: [] }, apply)
      await vi.advanceTimersByTimeAsync(1500)
      expect(requests).toHaveLength(2)
      expect(apply).not.toHaveBeenCalled()
      expect(stopped.getTransportState().phase).toBe('stopped')

      requests[1].success({ statusCode: 200, data: { type: 'registered' } })
      expect(current.getTransportState().phase).toBe('polling')
      expect(requests).toHaveLength(3)
      expect(requests[2].data.action).toBe('poll')
      current.stop()
      await vi.advanceTimersByTimeAsync(1500)
      expect(requests).toHaveLength(3)
      expect(vi.getTimerCount()).toBe(0)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it.each(['\u0000', '\u4E2D"\\'])('keeps error reports deliverable without treating a business exception as a capability fallback (%j)', async (character) => {
    const use = vi.fn()
    const requestFullBuild = vi.fn()
    const requestClassic = vi.fn()
    const reportError = vi.fn()
    const logger = { error: vi.fn(), warn: vi.fn() }
    const server = {
      middlewares: { use },
      config: { server: { port: 0 }, logger },
    } as unknown as ViteDevServer
    const transport = new StatefulHmrTransport(server, async () => {}, requestFullBuild, requestClassic, reportError)
    transport.install()
    const control = transport.createControl()
    const requests: any[] = []
    const context: Record<string, any> = {
      console: { error: vi.fn(), warn: vi.fn() },
      __rolldown_runtime__: { prepareUpdate: vi.fn(), applyPreparedUpdate: vi.fn() },
      setTimeout: vi.fn(),
      clearTimeout: vi.fn(),
      wx: {
        request: (options: unknown) => {
          requests.push(options)
          return { abort: vi.fn() }
        },
      },
      [WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY]: { ready: true, beginUpdate: vi.fn(), endUpdate: vi.fn() },
    }
    runInNewContext(createStatefulHmrControlSource(control), context)
    requests[0].success({ statusCode: 200, data: { type: 'registered' } })
    const client = context[WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY]
    try {
      client.receiveBatch({ buildId: control.buildId, fromVersion: 0, targetVersion: 1, changedIds: [] }, () => {
        throw new Error(`diagnostic prefix: ${character.repeat(70_000)}`)
      })
      const payload = requests.at(-1).data
      expect(payload).toMatchObject({ action: 'rebuild', failure: { reason: 'patch-failed', message: expect.stringContaining('diagnostic prefix:') } })
      const serialized = JSON.stringify(payload)
      const request = Object.assign(Readable.from([Buffer.from(serialized)]), { method: 'POST' })
      const response = { statusCode: 0, setHeader: vi.fn(), end: vi.fn() }
      const handler = use.mock.calls[0]![1] as (request: IncomingMessage, response: ServerResponse) => Promise<void>
      await handler(request as IncomingMessage, response as unknown as ServerResponse)
      expect(response.statusCode).toBe(422)
      expect(response.end).toHaveBeenCalledWith(JSON.stringify({ type: 'error' }))
      expect(reportError).toHaveBeenCalledOnce()
      expect(reportError.mock.calls[0]![0].message).toContain('diagnostic prefix:')
      expect(requestFullBuild).not.toHaveBeenCalled()
      expect(requestClassic).not.toHaveBeenCalled()
      expect(context.console.error).toHaveBeenCalledExactlyOnceWith('[weapp-vite] stateful HMR patch failed', expect.objectContaining({ message: expect.stringContaining('diagnostic prefix:') }))
      expect(context.console.warn).not.toHaveBeenCalled()
      expect(logger.error).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('[weapp-vite] stateful HMR client patch-failed: diagnostic prefix:'))
      expect(logger.warn).not.toHaveBeenCalled()
      expect(Buffer.byteLength(serialized)).toBeLessThan(64 * 1024)
      expect(client.getVersion()).toBe(0)
    }
    finally {
      client.stop()
      transport.close()
    }
  })

  it.each(['missing bridge', 'patch exception', 'unsupported registration', 'registration-like business exception'])('retains the precise reason for %s', (scenario) => {
    const requests: any[] = []
    const endUpdate = vi.fn()
    const message = scenario === 'registration-like business exception' ? 'Native registration failed; classic rebuild is required.' : 'replacement setup failed'
    const context: Record<string, any> = {
      console: { error: vi.fn(), warn: vi.fn() },
      __rolldown_runtime__: { prepareUpdate: vi.fn(), applyPreparedUpdate: vi.fn() },
      setTimeout: vi.fn(),
      clearTimeout: vi.fn(),
      wx: {
        request: (options: unknown) => {
          requests.push(options)
          return { abort: vi.fn() }
        },
      },
    }
    if (scenario !== 'missing bridge') {
      context[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY] = { ready: true, beginUpdate: vi.fn(), endUpdate }
    }
    runInNewContext(createStatefulHmrControlSource({ buildId: 'build', token: 'test-token', url: 'http://localhost/hmr' }), context)
    requests[0].success({ statusCode: 200, data: { type: 'registered' } })
    const client = context[WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY]
    client.receiveBatch({ buildId: 'build', fromVersion: 0, targetVersion: 1, changedIds: [] }, () => {
      throw Object.assign(new TypeError(message), {
        code: scenario === 'unsupported registration' ? WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE : 'BUSINESS_ERROR',
      })
    })
    expect(requests.at(-1).data).toMatchObject({
      action: 'rebuild',
      version: 0,
      failure: scenario === 'missing bridge'
        ? { reason: 'bridge-not-ready' }
        : { reason: 'patch-failed', message, stack: expect.stringContaining('TypeError') },
    })
    expect(requests.at(-1).data.failure.code).toBe(scenario === 'unsupported registration'
      ? WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE
      : undefined)
    expect(client.getVersion()).toBe(0)
    expect(endUpdate).toHaveBeenCalledTimes(scenario === 'missing bridge' ? 0 : 1)
    if (scenario === 'missing bridge') {
      expect(context.console.warn).toHaveBeenCalledExactlyOnceWith('[weapp-vite] stateful HMR bridge is not ready; rebuilding in classic mode')
      expect(context.console.error).not.toHaveBeenCalled()
    }
    else if (scenario === 'unsupported registration') {
      expect(context.console.warn).toHaveBeenCalledExactlyOnceWith('[weapp-vite] stateful HMR registration requires a classic rebuild', expect.objectContaining({ code: WEAPP_VITE_STATEFUL_HMR_UNSUPPORTED_REGISTRATION_CODE }))
      expect(context.console.error).not.toHaveBeenCalled()
    }
    else {
      expect(context.console.error).toHaveBeenCalledExactlyOnceWith('[weapp-vite] stateful HMR patch failed', expect.objectContaining({ code: 'BUSINESS_ERROR' }))
      expect(context.console.warn).not.toHaveBeenCalled()
    }
    client.stop()
  })
})
