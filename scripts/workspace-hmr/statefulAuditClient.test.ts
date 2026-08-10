import { describe, expect, it, vi } from 'vitest'
import { StatefulHmrAuditClient } from './statefulAuditClient'

describe('StatefulHmrAuditClient', () => {
  it('reuses one session and advances the version between published batches', async () => {
    const responses = [
      { type: 'registered' },
      { type: 'batch-published', targetVersion: 1 },
      { type: 'batch-published', targetVersion: 2 },
    ]
    const requests: Array<Record<string, unknown>> = []
    const request = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return new Response(JSON.stringify(responses.shift()), { status: 200 })
    })
    const client = new StatefulHmrAuditClient(request, () => 'audit-session')
    const control = {
      buildId: 'build-a',
      token: 'token-a',
      url: 'http://127.0.0.1:1234/__weapp_vite_hmr',
    }

    await client.ensureRegistered(control, 1_000)
    await client.poll(1_000)
    await client.ensureRegistered(control, 1_000)
    await client.poll(1_000)

    expect(request).toHaveBeenCalledTimes(3)
    expect(requests).toEqual([
      expect.objectContaining({ action: 'register', sessionId: 'audit-session', version: 0 }),
      expect.objectContaining({ action: 'poll', sessionId: 'audit-session', version: 0 }),
      expect.objectContaining({ action: 'poll', sessionId: 'audit-session', version: 1 }),
    ])
  })

  it('resets registration and version when the server control changes', async () => {
    const responses = [
      { type: 'registered' },
      { type: 'batch-published', targetVersion: 3 },
      { type: 'registered' },
      { type: 'batch-published', targetVersion: 1 },
    ]
    const requests: Array<Record<string, unknown>> = []
    const request = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      return new Response(JSON.stringify(responses.shift()), { status: 200 })
    })
    const client = new StatefulHmrAuditClient(request, () => 'audit-session')

    await client.ensureRegistered({ buildId: 'build-a', token: 'a', url: 'http://localhost/a' }, 1_000)
    await client.poll(1_000)
    await client.ensureRegistered({ buildId: 'build-b', token: 'b', url: 'http://localhost/b' }, 1_000)
    await client.poll(1_000)

    expect(requests).toEqual([
      expect.objectContaining({ action: 'register', buildId: 'build-a', version: 0 }),
      expect.objectContaining({ action: 'poll', buildId: 'build-a', version: 0 }),
      expect.objectContaining({ action: 'register', buildId: 'build-b', version: 0 }),
      expect.objectContaining({ action: 'poll', buildId: 'build-b', version: 0 }),
    ])
  })
})
