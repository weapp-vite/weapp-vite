import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ViteDevServer } from 'vite'
import { Buffer } from 'node:buffer'
import { Readable } from 'node:stream'
import { runInNewContext } from 'node:vm'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
import { describe, expect, it, vi } from 'vitest'
import { createStatefulHmrControlSource } from './runtimeSource'
import { StatefulHmrTransport } from './transport'

describe('stateful HMR client failure reporting', () => {
  it.each(['\u0000', '\u4E2D"\\'])('keeps rebuild requests deliverable with oversized diagnostics (%j)', async (character) => {
    const use = vi.fn()
    const requestFullBuild = vi.fn()
    const server = {
      middlewares: { use },
      config: { server: { port: 0 }, logger: { error: vi.fn() } },
    } as unknown as ViteDevServer
    const transport = new StatefulHmrTransport(server, async () => {}, requestFullBuild)
    transport.install()
    const control = transport.createControl()
    const requests: any[] = []
    const context: Record<string, any> = {
      console: { error: vi.fn() },
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
      expect(response.statusCode).toBe(202)
      expect(response.end).toHaveBeenCalledWith(JSON.stringify({ type: 'rebuilding' }))
      expect(requestFullBuild).toHaveBeenCalledOnce()
      expect(Buffer.byteLength(serialized)).toBeLessThan(64 * 1024)
      expect(client.getVersion()).toBe(0)
    }
    finally {
      client.stop()
      transport.close()
    }
  })

  it.each(['missing bridge', 'patch exception'])('retains the reason before restarting for %s', (scenario) => {
    const requests: any[] = []
    const endUpdate = vi.fn()
    const context: Record<string, any> = {
      console: { error: vi.fn() },
      setTimeout: vi.fn(),
      clearTimeout: vi.fn(),
      wx: {
        request: (options: unknown) => {
          requests.push(options)
          return { abort: vi.fn() }
        },
      },
    }
    if (scenario === 'patch exception') {
      context[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY] = { ready: true, beginUpdate: vi.fn(), endUpdate }
    }
    runInNewContext(createStatefulHmrControlSource({ buildId: 'build', token: 'test-token', url: 'http://localhost/hmr' }), context)
    requests[0].success({ statusCode: 200, data: { type: 'registered' } })
    const client = context[WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY]
    client.receiveBatch({ buildId: 'build', fromVersion: 0, targetVersion: 1, changedIds: [] }, () => {
      throw new TypeError('replacement setup failed')
    })
    expect(requests.at(-1).data).toMatchObject({
      action: 'rebuild',
      version: 0,
      failure: scenario === 'missing bridge'
        ? { reason: 'bridge-not-ready' }
        : { reason: 'patch-failed', message: 'replacement setup failed', stack: expect.stringContaining('TypeError') },
    })
    expect(client.getVersion()).toBe(0)
    expect(endUpdate).toHaveBeenCalledTimes(scenario === 'patch exception' ? 1 : 0)
    client.stop()
  })
})
