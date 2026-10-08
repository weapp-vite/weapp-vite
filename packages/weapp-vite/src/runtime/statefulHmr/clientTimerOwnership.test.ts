import { runInNewContext } from 'node:vm'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY, WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY } from '@weapp-core/constants'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createStatefulHmrControlSource } from './runtimeSource'

interface Batch {
  buildId: string
  fromVersion: number
  targetVersion: number
  changedIds: string[]
}

interface Client {
  receiveBatch: (batch: Batch, apply: () => void) => void
  getVersion: () => number
  stop: () => void
}

interface Request {
  data: { action: string, version: number, failure?: { reason: string } }
  success: (result: { statusCode: number, data: { type: string } }) => void
  fail: (error: { errMsg: string }) => void
}

let client: Client | undefined

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  client?.stop()
  client = undefined
  vi.useRealTimers()
})

function createClient() {
  const requests: Request[] = []
  const bridge = { ready: true, beginUpdate: vi.fn(), endUpdate: vi.fn() }
  const context: Record<string, unknown> = {
    console: { error: vi.fn() },
    setTimeout,
    clearTimeout,
    __rolldown_runtime__: { prepareUpdate: vi.fn(), applyPreparedUpdate: vi.fn() },
    [WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY]: bridge,
    wx: {
      request(options: Request) {
        requests.push(options)
        return { abort: vi.fn() }
      },
    },
  }
  runInNewContext(createStatefulHmrControlSource({ buildId: 'build', token: 'token', url: 'http://localhost/hmr' }), context)
  const current = context[WEAPP_VITE_STATEFUL_HMR_CLIENT_KEY] as Client
  client = current
  const respond = (type: string) => requests.at(-1)!.success({ statusCode: 200, data: { type } })
  const batch: Batch = { buildId: 'build', fromVersion: 0, targetVersion: 1, changedIds: [] }
  const publish = () => {
    respond('registered')
    respond('batch-published')
    expect(vi.getTimerCount()).toBe(1)
  }
  return { client: current, requests, bridge, respond, batch, publish }
}

describe('stateful client scheduled request ownership', () => {
  it('releases the publication watchdog as soon as its batch starts applying', async () => {
    const fixture = createClient()
    fixture.publish()
    let timerCountWhenApplying: number | undefined
    const apply = vi.fn(() => {
      timerCountWhenApplying = vi.getTimerCount()
    })
    fixture.client.receiveBatch(fixture.batch, apply)
    expect(apply).toHaveBeenCalledOnce()
    expect(timerCountWhenApplying).toBe(0)
    expect(fixture.client.getVersion()).toBe(1)
    expect(fixture.requests).toHaveLength(3)
    expect(fixture.requests[2]!.data).toMatchObject({ action: 'poll', version: 1 })
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(2500)
    expect(fixture.requests).toHaveLength(3)
  })

  it.each(['not delivered', 'different build', 'different version'])('keeps the watchdog when the batch is %s', async (scenario) => {
    const fixture = createClient()
    fixture.publish()
    const apply = vi.fn()
    if (scenario !== 'not delivered') {
      fixture.client.receiveBatch({
        ...fixture.batch,
        ...(scenario === 'different build' ? { buildId: 'other' } : { fromVersion: 1 }),
      }, apply)
    }
    const requestCount = fixture.requests.length
    expect(apply).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(1999)
    expect(fixture.requests).toHaveLength(requestCount)
    await vi.advanceTimersByTimeAsync(1)
    expect(fixture.requests).toHaveLength(requestCount + 1)
    expect(fixture.requests.at(-1)!.data).toMatchObject({ action: 'poll', version: 0 })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps registration recovery until a queued batch can be accepted', async () => {
    const fixture = createClient()
    fixture.requests[0]!.fail({ errMsg: 'register unavailable' })
    const apply = vi.fn()
    fixture.client.receiveBatch(fixture.batch, apply)
    expect(apply).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(500)
    expect(fixture.requests.at(-1)!.data.action).toBe('register')
    fixture.respond('registered')
    expect(apply).toHaveBeenCalledOnce()
    expect(fixture.requests.at(-1)!.data).toMatchObject({ action: 'poll', version: 1 })
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each(['missing bridge', 'failed patch'])('transfers recovery to the rebuild request after %s', async (scenario) => {
    const fixture = createClient()
    fixture.publish()
    fixture.bridge.ready = scenario !== 'missing bridge'
    fixture.client.receiveBatch(fixture.batch, () => {
      throw new Error('patch failed')
    })
    expect(fixture.requests.at(-1)!.data).toMatchObject({
      action: 'rebuild',
      version: 0,
      failure: { reason: scenario === 'missing bridge' ? 'bridge-not-ready' : 'patch-failed' },
    })
    expect(vi.getTimerCount()).toBe(0)
    fixture.requests.at(-1)!.fail({ errMsg: 'rebuild unavailable' })
    expect(vi.getTimerCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(500)
    expect(fixture.requests.at(-1)!.data).toMatchObject({ action: 'poll', version: 0 })
    const requestCount = fixture.requests.length
    await vi.advanceTimersByTimeAsync(2000)
    expect(fixture.requests).toHaveLength(requestCount)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('releases an undelivered watchdog on stop and ignores its late batch', async () => {
    const fixture = createClient()
    fixture.publish()
    fixture.client.stop()
    const apply = vi.fn()
    fixture.client.receiveBatch(fixture.batch, apply)
    expect(vi.getTimerCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(2500)
    expect(apply).not.toHaveBeenCalled()
    expect(fixture.requests).toHaveLength(2)
  })
})
