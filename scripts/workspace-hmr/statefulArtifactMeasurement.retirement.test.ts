import { afterEach, describe, expect, it, vi } from 'vitest'
import { measureStatefulTemplateArtifact } from './statefulArtifactMeasurement'
import { StatefulHmrAuditClient } from './statefulAuditClient'

const control = { buildId: 'retiring-build', token: 'test-token', url: 'http://localhost/control' }

async function createRetiringClient(poll: typeof fetch) {
  const requests: string[] = []
  const client = new StatefulHmrAuditClient(async (url, init) => {
    const body = JSON.parse(String(init?.body)) as { action: string }
    requests.push(body.action)
    return body.action === 'register'
      ? new Response(JSON.stringify({ type: 'registered', acknowledgement: 'explicit-v1' }))
      : poll(url, init)
  })
  await client.ensureRegistered(control, 1_000)
  return { client, requests }
}

afterEach(() => vi.restoreAllMocks())

describe('terminal template audit retirement', () => {
  it('stops the old poll after a successful retired response and preserves the measured artifact', async () => {
    let retired = false
    const { client, requests } = await createRetiringClient(async () => {
      retired = true
      return new Response(JSON.stringify({ type: 'retired' }), { status: 200 })
    })
    const observed = vi.fn()
    const readControl = vi.fn(async () => control)
    await expect(measureStatefulTemplateArtifact({
      client,
      readControl,
      isCurrentUpdate: async () => false,
      isClassicFallback: async () => retired,
      measure: async () => 12.5,
      onEvent: observed,
      timeoutMs: 1_000,
    })).resolves.toBe(12.5)
    expect(requests).toEqual(['register', 'poll'])
    expect(readControl).toHaveBeenCalledOnce()
    expect(observed).toHaveBeenCalledExactlyOnceWith({ type: 'retired', targetVersion: undefined })
  })

  it('waits for delayed matching classic readiness without polling or reading the old control again', async () => {
    let retired = false
    const entered = Promise.withResolvers<void>()
    const ready = Promise.withResolvers<boolean>()
    const { client, requests } = await createRetiringClient(async () => {
      retired = true
      return new Response(JSON.stringify({ type: 'retired' }))
    })
    const readControl = vi.fn(async () => control)
    const result = measureStatefulTemplateArtifact({
      client,
      readControl,
      isCurrentUpdate: async () => false,
      isClassicFallback: async () => {
        if (!retired) {
          return false
        }
        entered.resolve()
        return ready.promise
      },
      measure: async () => 18.5,
      timeoutMs: 1_000,
    })
    try {
      await entered.promise
      expect(requests).toEqual(['register', 'poll'])
      expect(readControl).toHaveBeenCalledOnce()
    }
    finally {
      ready.resolve(true)
    }
    await expect(result).resolves.toBe(18.5)
    expect(requests).toEqual(['register', 'poll'])
  })

  it('fails within the original deadline when retirement has no matching classic readiness', async () => {
    const { client, requests } = await createRetiringClient(async () => new Response(JSON.stringify({ type: 'retired' })))
    await expect(measureStatefulTemplateArtifact({
      client,
      readControl: async () => control,
      isCurrentUpdate: async () => false,
      isClassicFallback: async () => false,
      measure: async () => 24.5,
      timeoutMs: 50,
    })).rejects.toThrow('Timed out consuming a stateful HMR batch')
    expect(requests).toEqual(['register', 'poll'])
  })

  it('preserves the original classic readiness failure after retirement', async () => {
    let retired = false
    const failure = new Error('classic publication failed')
    const { client, requests } = await createRetiringClient(async () => {
      retired = true
      return new Response(JSON.stringify({ type: 'retired' }))
    })
    await expect(measureStatefulTemplateArtifact({
      client,
      readControl: async () => control,
      isCurrentUpdate: async () => false,
      isClassicFallback: async () => {
        if (retired) {
          throw failure
        }
        return false
      },
      measure: async () => 30.5,
      timeoutMs: 1_000,
    })).rejects.toBe(failure)
    expect(requests).toEqual(['register', 'poll'])
  })

  it('rejects matching readiness that arrives after the original absolute deadline', async () => {
    let retired = false
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const { client, requests } = await createRetiringClient(async () => {
      retired = true
      return new Response(JSON.stringify({ type: 'retired' }))
    })
    await expect(measureStatefulTemplateArtifact({
      client,
      readControl: async () => control,
      isCurrentUpdate: async () => false,
      isClassicFallback: async (_signal, deadline) => {
        expect(deadline).toBe(50)
        if (retired) {
          now = 51
          return true
        }
        return false
      },
      measure: async () => 36.5,
      deadline: 50,
      timeoutMs: 1_000,
    })).rejects.toThrow('Timed out consuming a stateful HMR batch')
    expect(requests).toEqual(['register', 'poll'])
  })

  it('preserves arbitrary fetch failures even when classic readiness would later succeed', async () => {
    let failed = false
    const failure = new TypeError('fetch failed', { cause: Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }) })
    const { client, requests } = await createRetiringClient(async () => {
      failed = true
      throw failure
    })
    await expect(measureStatefulTemplateArtifact({
      client,
      readControl: async () => control,
      isCurrentUpdate: async () => false,
      isClassicFallback: async () => failed,
      measure: async () => 42.5,
      timeoutMs: 1_000,
    })).rejects.toBe(failure)
    expect(requests).toEqual(['register', 'poll'])
  })

  it('rejects an unsuccessful response carrying retired instead of treating it as a terminal success', async () => {
    let failed = false
    const { client, requests } = await createRetiringClient(async () => {
      failed = true
      return new Response(JSON.stringify({ type: 'retired' }), { status: 500 })
    })
    await expect(measureStatefulTemplateArtifact({
      client,
      readControl: async () => control,
      isCurrentUpdate: async () => false,
      isClassicFallback: async () => failed,
      measure: async () => 48.5,
      timeoutMs: 1_000,
    })).rejects.toThrow('poll failed with HTTP 500')
    expect(requests).toEqual(['register', 'poll'])
  })
})
